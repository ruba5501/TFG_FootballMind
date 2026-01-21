const fs = require('fs');
const path = require('path');
const Estadio = require('../models/estadio');

async function cargarEstadios() {
  try {
    const count = await Estadio.countDocuments();
    
    if (count > 0) {
        console.log('Estadios: Colección ya contiene datos. Omitiendo cargado.');
        return; 
    }
    
    const dataPath = path.join(__dirname, '../../base_datos/estadios.json');
    const estadios = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const estadiosAniadidos = await Estadio.insertMany(estadios);

    console.log(`Estadios: Se han cargado ${estadiosAniadidos.length} estadios.`);
  } catch (err) {
    console.error('Error cargando los estadios:', err.message);
    throw err; 
  }
}

module.exports = cargarEstadios;
