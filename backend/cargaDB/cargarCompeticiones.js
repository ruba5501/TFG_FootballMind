const fs = require('fs');
const path = require('path');
const Competicion = require('../models/competicion'); // Asegura la ruta a tu modelo

async function cargarCompeticiones() {
  try {
    const count = await Competicion.countDocuments();
    
    if (count > 0) {
        console.log('Competiciones: Colección ya contiene datos. Omitiendo seeding.');
        return; // Salir si ya hay datos
    }

    const dataPath = path.join(__dirname, '../../base_datos/competiciones.json');
    const competicionesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const nuevasCompeticiones = competicionesData.map(comp => ({
      nombre: comp.nombre,
      pais: comp.pais || null,
      tipo: comp.tipo,
      logo: comp.logo || null
    }));

    const insertadas = await Competicion.insertMany(nuevasCompeticiones);
    console.log(`✅ Competiciones: Se cargaron ${insertadas.length} competiciones.`);
    
    // Devolvemos las competiciones insertadas para el módulo de clubes, si es necesario
    return insertadas; 
  } catch (err) {
    console.error('❌ Error cargando las competiciones:', err.message);
    throw err;
  }
}

module.exports = cargarCompeticiones;