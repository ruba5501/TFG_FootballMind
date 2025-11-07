const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Competicion = require('../models/competicion');
const Club = require('../models/club');

async function cargarCompeticiones() {
  try {
    await connectDB();

    const dataPath = path.join(__dirname, '../../base_datos/competiciones.json');
    const competicionesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    await Competicion.deleteMany({});

    const nuevasCompeticiones = [];

    for (const comp of competicionesData) {
      const nueva = new Competicion({
        nombre: comp.nombre,
        pais: comp.pais || null,
        tipo: comp.tipo,
        logo: comp.logo || null
      });
      await nueva.save();
      nuevasCompeticiones.push(nueva);
    }

    console.log(`Se cargaron ${nuevasCompeticiones.length} competiciones.`);

    const clubes = await Club.find();

    for (const club of clubes) {
      if (!club.competiciones || club.competiciones.length === 0) continue;

      const comps = await Competicion.find({ nombre: { $in: club.competiciones } });

      for (const c of comps) {
        await Competicion.updateOne(
          { _id: c._id },
          { $addToSet: { clubes: club._id } }
        );
      }

      club.competiciones = comps.map(c => c._id);
      await club.save();
    }

    console.log(`Sincronización completa entre clubes y competiciones.`);
    process.exit();
  } catch (err) {
    console.error('Error cargando las competiciones:', err);
    process.exit(1);
  }
}

cargarCompeticiones();
