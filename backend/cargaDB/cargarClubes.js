const fs = require('fs');
const path = require('path');
const Club = require('../models/club');
const Competicion = require('../models/competicion');
const Estadio = require('../models/estadio');

async function cargarClubes() {
  try {
    const count = await Club.countDocuments();
    
    if (count > 0) {
        console.log('Clubes: Colección ya contiene datos. Omitiendo cargado.');
        return;
    }
    
    const dataPath = path.join(__dirname, '../../base_datos/clubes.json');
    const clubesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Separar y preparar datos
    const clubesNormales = clubesData.filter(club => !club.esFilial);
    const clubesFiliales = clubesData.filter(club => club.esFilial);

    const clubesFinalNormales = [];
    
    // --- 1. PROCESAR CLUBES NORMALES ---
    for (const club of clubesNormales) {
      const [comps, estadio] = await Promise.all([
          Competicion.find({ nombre: { $in: club.competiciones || [] } }).lean(),
          Estadio.findOne({ nombre: club.estadio }).lean()
      ]);

      // Un club normal DEBE tener estadio, pero permitimos que no tenga competición 
      // por si es un club libre o de ligas bajas no cargadas.
      if (!estadio) {
        console.warn(`Clubes: No se encontró estadio para ${club.nombre}. Saltando club.`);
        continue;
      }
      
      clubesFinalNormales.push({
        ...club,
        estadio: estadio._id,
        competiciones: comps.map(c => c._id),
      });
    }

    const insertadosNormales = await Club.insertMany(clubesFinalNormales);
    
    const nombreToId = insertadosNormales.reduce((acc, club) => {
        acc[club.nombre] = club._id;
        return acc;
    }, {});

    // --- 2. PROCESAR CLUBES FILIALES ---
    const clubesFinalFiliales = [];
    for (const club of clubesFiliales) {
      const clubMatrizId = nombreToId[club.clubMatriz];
      
      if (!clubMatrizId) {
        console.warn(`Clubes Filial: No se encontró club matriz (${club.clubMatriz}) para ${club.nombre}.`);
        continue;
      }

      const [comps, estadio] = await Promise.all([
          Competicion.find({ nombre: { $in: club.competiciones || [] } }).lean(),
          Estadio.findOne({ nombre: club.estadio }).lean()
      ]);

      // LÓGICA FLEXIBLE PARA FILIALES:
      // Si no tiene estadio propio, intentamos buscar el estadio del club matriz
      let estadioFinalId = null;
      if (estadio) {
          estadioFinalId = estadio._id;
      } else {
          const matrizDoc = await Club.findById(clubMatrizId).lean();
          estadioFinalId = matrizDoc ? matrizDoc.estadio : null;
      }

      if (!estadioFinalId) {
          console.warn(`Clubes Filial: ${club.nombre} no tiene estadio y su matriz tampoco. Saltando.`);
          continue;
      }

      clubesFinalFiliales.push({
        ...club,
        estadio: estadioFinalId,
        competiciones: comps.map(c => c._id), // Ahora puede ser un array vacío []
        clubMatriz: clubMatrizId,
      });
    }

    const insertadosFiliales = await Club.insertMany(clubesFinalFiliales);

    // --- 3. SINCRONIZAR COMPETICIONES ---
    const todosClubes = [...insertadosNormales, ...insertadosFiliales];
    const bulkOps = [];
    
    for (const club of todosClubes) {
      if (club.competiciones && club.competiciones.length > 0) {
        for (const compId of club.competiciones) {
          bulkOps.push({
            updateOne: {
              filter: { _id: compId },
              update: { $addToSet: { clubes: club._id } }
            }
          });
        }
      }
    }
    
    if (bulkOps.length > 0) {
        await Competicion.bulkWrite(bulkOps);
    }

    console.log(`Clubes: Cargados ${todosClubes.length} en total (Normales: ${insertadosNormales.length}, Filiales: ${insertadosFiliales.length}).`);
  } catch (err) {
    console.error('Error cargando clubes:', err.message);
    throw err;
  }
}

module.exports = cargarClubes;