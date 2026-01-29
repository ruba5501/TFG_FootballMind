const fs = require('fs');
const path = require('path');
const Club = require('../models/club');
const Competicion = require('../models/competicion');
const Estadio = require('../models/estadio');

async function cargarClubes() {
  try {
    const count = await Club.countDocuments();
    
    if (count > 0) {
        console.log('Clubes: Colección ya contiene datos. Omitiendo cargado.');
        return;
    }
    
    const dataPath = path.join(__dirname, '../../base_datos/clubes.json');
    const clubesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const todosEstadios = await Estadio.find().lean();
    const todasComps = await Competicion.find().lean();

    const estadioMap = {}; 
    const compMap = {}; 
    todosEstadios.forEach(e => estadioMap[e.nombre] = e._id);
    todasComps.forEach(c => compMap[c.nombre] = c._id);

    const clubesParaInsertar = [];
    
    for (const club of clubesData) {
      let estadioId = estadioMap[club.estadio];

      if (!estadioId && !club.esFilial) {
          console.warn(`Clubes: No se encontró estadio para ${club.nombre}.`);
          continue; 
      }

      clubesParaInsertar.push({
        ...club,
        estadio: estadioId, 
        competiciones: (club.competiciones || []).map(name => compMap[name]).filter(id => id),
        clubMatriz: null
      });
    }

    const insertados = await Club.insertMany(clubesParaInsertar);
    console.log(`Clubes: Se han cargado ${insertados.length} clubes.`);

    const nombreToIdMap = {};
    insertados.forEach(c => nombreToIdMap[c.nombre] = { id: c._id, estadio: c.estadio });

    const bulkUpdateOps = [];
    const bulkCompOps = [];

    for (const clubJson of clubesData) {
        const clubInsertadoId = nombreToIdMap[clubJson.nombre].id;

        if (clubJson.esFilial && clubJson.clubMatriz) {
            const matrizInfo = nombreToIdMap[clubJson.clubMatriz];
            if (matrizInfo) {
                bulkUpdateOps.push({
                    updateOne: {
                        filter: { _id: clubInsertadoId },
                        update: { $set: { 
                            clubMatriz: matrizInfo.id,
                            estadio: nombreToIdMap[clubJson.nombre].estadio || matrizInfo.estadio
                        }}
                    }
                });
            }
        }
        if (clubJson.competiciones) {
            clubJson.competiciones.forEach(compNombre => {
                const compId = compMap[compNombre];
                if (compId) {
                    bulkCompOps.push({
                        updateOne: {
                            filter: { _id: compId },
                            update: { $addToSet: { clubes: clubInsertadoId } }
                        }
                    });
                }
            });
        }
    }

    if (bulkUpdateOps.length > 0) await Club.bulkWrite(bulkUpdateOps);
    if (bulkCompOps.length > 0) await Competicion.bulkWrite(bulkCompOps);

  } catch (err) {
    console.error('Error cargando clubes:', err.message);
    throw err;
  }
}

module.exports = cargarClubes;