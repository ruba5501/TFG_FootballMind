const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Club = require('../models/club');

async function cargarClubes() {
  try {
    await connectDB();

    const dataPath = path.join(__dirname, '../../base_datos/clubes.json');
    const clubes = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    await Club.deleteMany({});
    const clubesAniadidos = await Club.insertMany(clubes);

    console.log(`Se han cargado ${clubesAniadidos.length} clubes`);
    process.exit();
  } catch (err) {
    console.error('Error cargando los clubes:', err);
    process.exit(1);
  }
}

cargarClubes();