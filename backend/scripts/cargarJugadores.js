const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Jugador = require('../models/jugador');

async function cargarJugadores() {
  try {
    await connectDB();

    const dataPath = path.join(__dirname, '../../base_datos/jugadores.json');
    const jugadores = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    await Jugador.deleteMany({});
    const jugadorAniadidos = await Jugador.insertMany(jugadores);

    console.log(`Se han cargado ${jugadorAniadidos.length} jugadores`);
    process.exit();
  } catch (err) {
    console.error('Error cargando los jugadores:', err);
    process.exit(1);
  }
}

cargarJugadores();