const fs = require('fs');
const path = require('path');
const Estadio = require('../models/estadio'); // Ajusta la ruta a tu modelo

async function cargarEstadios() {
  try {
    const count = await Estadio.countDocuments();
    
    if (count > 0) {
        console.log('Estadios: Colección ya contiene datos. Omitiendo cargado.');
        return; // Salir si ya hay datos
    }
    
    const dataPath = path.join(__dirname, '../../base_datos/estadios.json');
    const estadios = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // No necesitamos deleteMany si usamos el chequeo de count > 0
    const estadiosAniadidos = await Estadio.insertMany(estadios);

    console.log(`Estadios: Se han cargado ${estadiosAniadidos.length} estadios.`);
  } catch (err) {
    // Es crucial lanzar el error para detener el proceso principal
    console.error('Error cargando los estadios:', err.message);
    throw err; 
  }
}

module.exports = cargarEstadios;
