const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Club = require('../models/club');
const Competicion = require('../models/competicion');
const Estadio = require('../models/estadio');

async function cargarClubes() {
  try {
    await connectDB();

    const dataPath = path.join(__dirname, '../../base_datos/clubes.json');
    const clubesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Limpiar coleccion de clubes
    await Club.deleteMany({});

    // Primero creamos un mapa de clubes normales con su _id
    const clubesNormales = [];
    const clubesFiliales = [];

    for (const club of clubesData) {
      if (club.esFilial) {
        clubesFiliales.push(club);
      } else {
        clubesNormales.push(club);
      }
    }

    // Generamos _id para todos los clubes normales
    const clubesFinalNormales = [];
    for (const club of clubesNormales) {
      const comps = await Competicion.find({ nombre: { $in: club.competiciones } });
      if (!comps.length) {
        console.warn(`No se encontraron competiciones para ${club.nombre}`);
        continue;
      }

      const estadio = await Estadio.findOne({ nombre: club.estadio });
      if (!estadio) {
        console.warn(`No se encontró estadio para ${club.nombre}`);
        continue;
      }

      clubesFinalNormales.push({
        ...club,
        estadio: estadio._id,
        competiciones: comps.map(c => c._id),
        _id: new Club()._id // Generamos _id manualmente
      });
    }

    // Insertamos clubes normales primero para poder asignar clubMatriz a filiales
    const insertadosNormales = await Club.insertMany(clubesFinalNormales);

    // Creamos un mapa de nombre -> _id para los clubes normales
    const nombreToId = {};
    for (const club of insertadosNormales) {
      nombreToId[club.nombre] = club._id;
    }

    // Ahora generamos los filiales con clubMatriz
    const clubesFinalFiliales = [];
    for (const club of clubesFiliales) {
      const comps = await Competicion.find({ nombre: { $in: club.competiciones } });
      if (!comps.length) {
        console.warn(`No se encontraron competiciones para ${club.nombre}`);
        continue;
      }

      const estadio = await Estadio.findOne({ nombre: club.estadio });
      if (!estadio) {
        console.warn(`No se encontró estadio para ${club.nombre}`);
        continue;
      }

      const clubMatrizId = nombreToId[club.clubMatrizNombre];
      if (!clubMatrizId) {
        console.warn(`No se encontró club matriz para ${club.nombre}`);
        continue;
      }

      clubesFinalFiliales.push({
        ...club,
        estadio: estadio._id,
        competiciones: comps.map(c => c._id),
        clubMatriz: clubMatrizId,
        _id: new Club()._id
      });
    }

    // Insertamos los filiales
    const insertadosFiliales = await Club.insertMany(clubesFinalFiliales);

    console.log(`Se han cargado ${insertadosNormales.length + insertadosFiliales.length} clubes correctamente.`);

    // Sincronizar competiciones con clubes
    const todosClubes = [...insertadosNormales, ...insertadosFiliales];
    for (const club of todosClubes) {
      for (const compId of club.competiciones) {
        await Competicion.updateOne(
          { _id: compId },
          { $addToSet: { clubes: club._id } } // Evita duplicados
        );
      }
    }

    console.log('Competiciones sincronizadas con clubes.');
    process.exit();
  } catch (err) {
    console.error('Error cargando clubes:', err);
    process.exit(1);
  }
}

cargarClubes();
