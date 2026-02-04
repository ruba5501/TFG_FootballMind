const fs = require('fs');
const path = require('path');
const Club = require('../models/club');
const Competicion = require('../models/competicion');
const Estadio = require('../models/estadio');

async function cargarClubes(partidaId, estadios, competiciones, nombrePartida) {
  try {
    const dataPath = path.join(__dirname, '../../base_datos/clubes.json');
    const clubesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const estadioMap = {}; 
    const compMap = {};
    estadios.forEach(e => estadioMap[e.nombre] = e._id);
    competiciones.forEach(c => compMap[c.nombre] = c._id);

    const clubesParaInsertar = clubesData.map(club => ({
        ...club,
        partidaId: partidaId,
        estadio: estadioMap[club.estadio] || null,
        competiciones: (club.competiciones || []).map(name => compMap[name]).filter(id => id),
        clubMatriz: null
    }));

    const clubesInsertados = await Club.insertMany(clubesParaInsertar);
    console.log(`Clubes: ${clubesInsertados.length} creados para partida ${nombrePartida}.`);

    const nombreToIdMap = {};
    clubesInsertados.forEach(c => {
        nombreToIdMap[c.nombre] = { id: c._id, estadio: c.estadio };
    });

    const bulkUpdateClubes = [];
    const bulkUpdateComps = [];

    for (const clubJson of clubesData) {
        const clubInsertadoId = nombreToIdMap[clubJson.nombre].id;

        // Víncular Club y Filial
        if (clubJson.esFilial && clubJson.clubMatriz) {
            const matrizInfo = nombreToIdMap[clubJson.clubMatriz];
            if (matrizInfo) {
                bulkUpdateClubes.push({
                    updateOne: {
                        filter: { _id: clubInsertadoId },
                        update: { $set: { clubMatriz: matrizInfo.id } }
                    }
                });
            }
        }
        // Víncular con Competiciones
        if (clubJson.competiciones) {
            clubJson.competiciones.forEach(compNombre => {
                const compId = compMap[compNombre];
                if (compId) {
                    bulkUpdateComps.push({
                        updateOne: {
                            filter: { _id: compId },
                            update: { $addToSet: { clubes: clubInsertadoId } }
                        }
                    });
                }
            });
        }
    }

    if (bulkUpdateClubes.length > 0) await Club.bulkWrite(bulkUpdateClubes);
    if (bulkUpdateComps.length > 0) await Competicion.bulkWrite(bulkUpdateComps);

    return clubesInsertados;
     
  } catch (err) {
    console.error('Error cargando clubes:', err.message);
    throw err;
  }
}

module.exports = cargarClubes;