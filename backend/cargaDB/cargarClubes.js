const fs = require('fs');
const path = require('path');
const Club = require('../models/club');
const Competicion = require('../models/competicion');
const Estadio = require('../models/estadio');

async function cargarClubes() {
  try {
    const count = await Club.countDocuments();
    
    if (count > 0) {
        console.log('Clubes: Colección ya contiene datos. Omitiendo seeding.');
        return;
    }
    
    // ⚠️ ATENCIÓN: La lógica aquí asume que los Estadios y Competiciones ya están en la DB.

    const dataPath = path.join(__dirname, '../../base_datos/clubes.json');
    const clubesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Separar y preparar datos
    const clubesNormales = clubesData.filter(club => !club.esFilial);
    const clubesFiliales = clubesData.filter(club => club.esFilial);

    const clubesFinalNormales = [];
    
    // --- 1. PROCESAR CLUBES NORMALES ---
    for (const club of clubesNormales) {
      // Búsqueda de referencias (asumiendo que las colecciones ya están cargadas)
      const [comps, estadio] = await Promise.all([
          Competicion.find({ nombre: { $in: club.competiciones } }).lean(),
          Estadio.findOne({ nombre: club.estadio }).lean()
      ]);

      if (!comps.length) {
        // console.warn(`Clubes: No se encontraron competiciones para ${club.nombre}.`);
        continue;
      }

      if (!estadio) {
        console.warn(`Clubes: No se encontró estadio para ${club.nombre}. Saltando club.`);
        continue;
      }
      
      // Creamos el objeto listo para insertar con las IDs referenciadas
      clubesFinalNormales.push({
        ...club,
        estadio: estadio._id,
        competiciones: comps.map(c => c._id),
      });
    }

    const insertadosNormales = await Club.insertMany(clubesFinalNormales);
    console.log(`Clubes: ${insertadosNormales.length} clubes normales insertados.`);
    
    // Creamos un mapa de nombre -> _id para los clubes normales insertados
    const nombreToId = insertadosNormales.reduce((acc, club) => {
        acc[club.nombre] = club._id;
        return acc;
    }, {});

    // --- 2. PROCESAR CLUBES FILIALES ---
    const clubesFinalFiliales = [];
    for (const club of clubesFiliales) {
      const clubMatrizId = nombreToId[club.clubMatrizNombre];
      
      if (!clubMatrizId) {
        console.warn(`Clubes: No se encontró club matriz (${club.clubMatrizNombre}) para ${club.nombre}. Saltando filial.`);
        continue;
      }

      const [comps, estadio] = await Promise.all([
          Competicion.find({ nombre: { $in: club.competiciones } }).lean(),
          Estadio.findOne({ nombre: club.estadio }).lean()
      ]);

      if (!comps.length || !estadio) {
          // Si faltan comps o estadio, ya se mostró un warning antes, simplemente saltamos
          continue;
      }

      clubesFinalFiliales.push({
        ...club,
        estadio: estadio._id,
        competiciones: comps.map(c => c._id),
        clubMatriz: clubMatrizId,
      });
    }

    const insertadosFiliales = await Club.insertMany(clubesFinalFiliales);
    console.log(`Clubes: ${insertadosFiliales.length} clubes filiales insertados.`);

    // --- 3. SINCRONIZAR COMPETICIONES (Actualizar los arrays 'clubes' en Competicion) ---
    const todosClubes = [...insertadosNormales, ...insertadosFiliales];
    const bulkOps = [];
    
    for (const club of todosClubes) {
      for (const compId of club.competiciones) {
        bulkOps.push({
          updateOne: {
            filter: { _id: compId },
            update: { $addToSet: { clubes: club._id } }
          }
        });
      }
    }
    
    if (bulkOps.length > 0) {
        await Competicion.bulkWrite(bulkOps);
        console.log('Clubes: Competiciones sincronizadas con clubes.');
    }


    console.log(`✅ Clubes: Se han cargado un total de ${todosClubes.length} clubes correctamente.`);

  } catch (err) {
    console.error('❌ Error cargando clubes:', err.message);
    throw err;
  }
}

module.exports = cargarClubes;