const fs = require('fs');
const path = require('path');
const Estadio = require('../models/estadio');

async function cargarEstadios(partidaId, nombrePartida) {
  try {
    const dataPath = path.join(__dirname, '../../base_datos/estadios.json');
    const estadiosJson = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const estadiosParaInsertar = estadiosJson.map(e => ({ ...e, partidaId }));

    const estadios = await Estadio.insertMany(estadiosParaInsertar);
    console.log(`Estadios: ${estadios.length} cargados para partida ${nombrePartida}`);
    
    return estadios;
  } catch (err) {
    console.error('Error cargando los estadios:', err.message);
    throw err; 
  }
}

module.exports = cargarEstadios;
