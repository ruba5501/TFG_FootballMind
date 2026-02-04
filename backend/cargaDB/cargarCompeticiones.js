const fs = require('fs');
const path = require('path');
const Competicion = require('../models/competicion'); 

async function cargarCompeticiones(partidaId, nombrePartida) {
  try {
    const dataPath = path.join(__dirname, '../../base_datos/competiciones.json');
    const compsJson = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const competicionesParaInsertar = compsJson.map(c => ({ ...c, partidaId, clubes: [] }));

    const competiciones = await Competicion.insertMany(competicionesParaInsertar);
    console.log(`Competiciones: ${competiciones.length} cargadas para partida ${nombrePartida}`);

    return competiciones;
  } catch (err) {
    console.error('Error cargando las competiciones:', err.message);
    throw err;
  }
}

module.exports = cargarCompeticiones;