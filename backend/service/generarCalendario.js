const Partido = require('../models/partido');
const Club = require('../models/club');
const Partida = require('../models/partida');
const Competicion = require('../models/competicion');

async function generarCalendario(partidaId) {
    try {
        await Partido.deleteMany({ partidaId: partidaId });
        console.log("Limpiando partidos antiguos...");

        const partida = await Partida.findById(partidaId);
        const anioInicio = partida.fechaActual.getFullYear();

        const competiciones = await Competicion.find({});
        for (const comp of competiciones) {
            switch (comp.tipo) {
                case 'liga':
                    await generarLiga(partidaId, comp, anioInicio);
                    break;
                case 'internacional_america':
                    await generarFaseGrupos(partidaId, comp, anioInicio);
                    break;
                case 'internacional_europa':
                    await generarFaseSuiza(partidaId, comp, anioInicio);
                    break;
                case 'copa':
                    await generarRondaInicialCopa(partidaId, comp, anioInicio);
                    break;
                default:
                    console.warn(`Tipo de competición desconocido: ${comp.tipo} en ${comp.nombre}`);
            }
        }
        console.log("Calendario de temporada generado correctamente.");
        return true;

    } catch (err) {
        console.error('Error en generarCalendario:', err.message);
        throw err;
    }
}

async function generarLiga(partidaId, competicion, anioInicio) {
    const equipos = await Club.find({ partidaId, competiciones: competicion._id });
    if (equipos.length % 2 !== 0) equipos.push({ nombre: 'DESCANSO', _id: null });

    const numEquipos = equipos.length;
    const numJornadas = numEquipos - 1;
    let partidos = [];
    let fechaBase = new Date(anioInicio, 7, 15);

    for (let j = 0; j < numJornadas; j++) {
        for (let i = 0; i < numEquipos / 2; i++) {
            const local = equipos[(j + i) % (numEquipos - 1)];
            const visitante = (i === 0) ? equipos[numEquipos - 1] : equipos[(numEquipos - 1 - i + j) % (numEquipos - 1)];

            if (local._id && visitante._id) {
                partidos.push(crearObjeto(partidaId, competicion._id, j + 1, local._id, visitante._id, fechaBase, 'LIGA'));
                
                let fechaVuelta = new Date(fechaBase);
                fechaVuelta.setMonth(fechaVuelta.getMonth() + 5);
                partidos.push(crearObjeto(partidaId, competicion._id, j + 1 + numJornadas, visitante._id, local._id, fechaVuelta, 'LIGA'));
            }
        }
        fechaBase.setDate(fechaBase.getDate() + 7);
    }
    await Partido.insertMany(partidos);
}

async function generarRondaInicialCopa(partidaId, competicion, anioInicio) {
    const equipos = await Club.find({ 
            partidaId, 
            competiciones: competicion._id, 
            esFilial: false,
            pais: competicion.pais
        }).sort({ division: 1, reputacion: -1 });    
    const N = equipos.length;
    const OBJETIVO = 32;

    if (N > OBJETIVO) {
        const numParaEliminar = N - OBJETIVO;
        const numEquiposEnPrevia = numParaEliminar * 2;
        const participantesPrevia = equipos.slice(N - numEquiposEnPrevia);
        const clasificadosDirectos = equipos.slice(0, N - numEquiposEnPrevia);
        
        let partidosParaInsertar = [];
        let fecha = new Date(anioInicio, 8, 10);

        const sorteoPrevia = participantesPrevia.sort(() => Math.random() - 0.5);

        for (let i = 0; i < sorteoPrevia.length; i += 2) {
            if (sorteoPrevia[i+1]) {
                partidosParaInsertar.push(crearObjeto(
                    partidaId, 
                    competicion._id, 
                    0,
                    sorteoPrevia[i]._id, 
                    sorteoPrevia[i+1]._id, 
                    fecha, 
                    'ELIMINATORIA'
                ));
            }
        }

        if (partidosParaInsertar.length > 0) {
            await Partido.insertMany(partidosParaInsertar);
        }
    }
}

async function generarFaseGrupos(partidaId, competicion, anioInicio) {
    const equiposConsultados = await Club.find({ partidaId, competiciones: competicion._id });
    const equipos = equiposConsultados.sort(() => Math.random() - 0.5);

    let partidos = [];
    let fechaInicio = new Date(anioInicio, 2, 5); // Marzo

    for (let g = 0; g < 8; g++) {
        const grupo = equipos.slice(g * 4, (g + 1) * 4);
        if (grupo.length < 4) continue;

        const enfrentamientos = [
            { j: 1, loc: 0, vis: 1 }, { j: 1, loc: 2, vis: 3 },
            { j: 2, loc: 1, vis: 2 }, { j: 2, loc: 3, vis: 0 },
            { j: 3, loc: 0, vis: 2 }, { j: 3, loc: 1, vis: 3 },
            { j: 4, loc: 1, vis: 0 }, { j: 4, loc: 3, vis: 2 },
            { j: 5, loc: 2, vis: 1 }, { j: 5, loc: 0, vis: 3 },
            { j: 6, loc: 2, vis: 0 }, { j: 6, loc: 3, vis: 1 }
        ];

        enfrentamientos.forEach(e => {
            let fechaPartido = new Date(fechaInicio);
            fechaPartido.setDate(fechaPartido.getDate() + (e.j - 1) * 14); // Una jornada cada 2 semanas

            partidos.push(crearObjeto(
                partidaId, 
                competicion._id, 
                e.j,
                grupo[e.loc]._id, 
                grupo[e.vis]._id, 
                fechaPartido, 
                'LIGA' 
            ));
        });
    }
    
    if (partidos.length > 0) {
        await Partido.insertMany(partidos);
    }
}

async function generarFaseSuiza(partidaId, competicion, anioInicio) {
    const equipos = await Club.find({ partidaId, competiciones: competicion._id }).sort({ reputacion: -1 });

    if (equipos.length < 36) {
        console.warn(`Competición ${competicion.nombre} no tiene suficientes equipos (36 necesarios).`);
        return;
    }

    const bombos = [
        equipos.slice(0, 9),   // Bombo 1
        equipos.slice(9, 18),  // Bombo 2
        equipos.slice(18, 27), // Bombo 3
        equipos.slice(27, 36)  // Bombo 4
    ];

    let partidosMap = new Set();
    let partidosParaInsertar = [];
    let fechaBase = new Date(anioInicio, 8, 15); 

    equipos.forEach(equipo => {
        bombos.forEach((bombo, indiceBombo) => {
            const rivalesDisponibles = bombo
                .filter(r => r._id.toString() !== equipo._id.toString())
                .sort(() => Math.random() - 0.5)
                .slice(0, 2);

            rivalesDisponibles.forEach(rival => {
                const IDs = [equipo._id.toString(), rival._id.toString()].sort();
                const partidoKey = `${IDs[0]}-${IDs[1]}`;

                if (!partidosMap.has(partidoKey)) {
                    partidosMap.add(partidoKey);
                    
                    const esLocal = equipo._id.toString() < rival._id.toString();
                    
                    partidosParaInsertar.push(crearObjeto(
                        partidaId, 
                        competicion._id, 
                        1,
                        esLocal ? equipo._id : rival._id, 
                        esLocal ? rival._id : equipo._id, 
                        fechaBase, 
                        'LIGA'
                    ));
                }
            });
        });
    });

    if (partidosParaInsertar.length > 0) {
        await Partido.insertMany(partidosParaInsertar);
    }
}

function crearObjeto(partidaId, compId, jornada, localId, visitanteId, fecha, tipo) {
    return {
        partidaId,
        competicionId: compId,
        tipo: tipo,
        jornada: jornada,
        equipoLocal: localId,
        equipoVisitante: visitanteId,
        fecha: new Date(fecha),
        jugado: false
    };
}

module.exports = generarCalendario;