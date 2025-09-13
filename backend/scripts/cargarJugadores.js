const mongoose = require('mongoose');
const Jugador = require('../models/jugador');
const jugadoresData = require('../../base_datos/jugadores.json');
const connectDB = require('../db');

const cargarJugadores = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    // Limpiar la colección antes de cargar los datos
    await Jugador.deleteMany();
    // Insertar todos los jugadores del JSON
    await Jugador.insertMany(jugadoresData);

    console.log(`Se han cargado ${jugadoresData.length} jugadores en la base de datos`);
    process.exit();
  } catch (err) {
    console.error('Error cargando los jugadores:', err);
    process.exit(1);
  }
};
cargarJugadores();