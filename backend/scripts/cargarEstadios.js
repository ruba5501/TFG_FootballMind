const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Estadio = require('../models/estadio');

async function cargarEstadios() {
  try {
    await connectDB();

    const dataPath = path.join(__dirname, '../../base_datos/estadios.json');
    const estadios = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    await Estadio.deleteMany({});
    const estadiosAniadidos = await Estadio.insertMany(estadios);

    console.log(`Se han cargado ${estadiosAniadidos.length} estadios`);
    process.exit();
  } catch (err) {
    console.error('Error cargando los estadios:', err);
    process.exit(1);
  }
}

cargarEstadios();