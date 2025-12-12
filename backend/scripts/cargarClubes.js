const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Club = require('../models/club');
const Competicion = require('../models/competicion'); 
const Estadio = require('../models/estadio');
const Jugador = require('../models/jugador');
const Empleado = require('../models/empleado');

async function cargarClubes() {
  try {
    await connectDB();

    const dataPath = path.join(__dirname, '../../base_datos/clubes.json');
    const clubes = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    await Club.deleteMany({});

    const clubesFinal = [];

    for (const club of clubes) {
      const comps = await Competicion.find({ nombre: { $in: club.competiciones } });
      if (comps.length === 0) {
        console.warn(`No se encontraron competiciones para ${club.nombre}`);
        continue;
      }

      const estadio = await Estadio.findOne({ nombre: club.estadio });
      if (!estadio) {
        console.warn(`No se encontró estadio para ${club.nombre}`);
        continue;
      }

      /* POR AHORA NO HAY JUGADORES NI EMPLEADOS

      // Buscar jugadores (por nombre o por club, según cómo los guardes)
      let jugadoresIds = [];
      if (club.plantilla && club.plantilla.length > 0) {
        const jugadores = await Jugador.find({ nombre: { $in: club.plantilla } });
        jugadoresIds = jugadores.map(j => j._id);
      }

      // Buscar empleados
      let empleadosIds = [];
      if (club.empleados && club.empleados.length > 0) {
        const empleados = await Empleado.find({ nombre: { $in: club.empleados } });
        empleadosIds = empleados.map(e => e._id);
      }*/

      clubesFinal.push({
        ...club,
        estadio: estadio._id,
        competiciones: comps.map(c => c._id),
        escudo: club.escudo || null
        //plantilla: jugadoresIds,
        //empleados: empleadosIds
      });
    }

    const insertados = await Club.insertMany(clubesFinal);
    console.log(`Se han cargado ${insertados.length} clubes correctamente.`);

    for (const club of insertados) {
      for (const compId of club.competiciones) {
        await Competicion.updateOne(
          { _id: compId },
          { $addToSet: { clubes: club._id } } // Evita duplicados
        );
      }
    }

    console.log(`Se han sincronizado las competiciones con los clubes participantes.`);


    process.exit();
  } catch (err) {
    console.error('Error cargando los clubes:', err);
    process.exit(1);
  }
}

cargarClubes();
