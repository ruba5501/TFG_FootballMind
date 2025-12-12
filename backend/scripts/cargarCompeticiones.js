const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Competicion = require('../models/competicion');

async function cargarCompeticiones() {
  try {
    await connectDB();

    const dataPath = path.join(__dirname, '../../base_datos/competiciones.json');
    const competicionesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    await Competicion.deleteMany({});

    const nuevasCompeticiones = competicionesData.map(comp => ({
      nombre: comp.nombre,
      pais: comp.pais || null,
      tipo: comp.tipo,
      logo: comp.logo || null
    }));

    await Competicion.insertMany(nuevasCompeticiones);

    console.log(`Se cargaron ${nuevasCompeticiones.length} competiciones.`);
    process.exit();
  } catch (err) {
    console.error('Error cargando las competiciones:', err);
    process.exit(1);
  }
}

cargarCompeticiones();
