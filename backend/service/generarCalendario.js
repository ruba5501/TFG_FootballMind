const Partido = require('../models/partido');
const Club = require('../models/club');
const Partida = require('../models/partida');
const Competicion = require('../models/competicion');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// CALENDARIO MAESTRO ABSOLUTO DE LA TEMPORADA
const CALENDARIO_MAESTRO = {
    COPA: { 
        0: 13,   // Ronda Previa
        1: 16,  // 1/16
        2: 19,  // 1/8
        3: 25,  // 1/4
        4: 29,  // 1/2 Ida
        5: 36,  // 1/2 Vuelta
        6: 40   // Final
    },
    LIGA_EUROPA: {
        ucl: [5, 7, 10, 12, 15, 17, 22, 23], 
        uel: [6, 7, 10, 12, 15, 17, 22, 23],
        uec: [7, 10, 12, 15, 17, 18]
    },
    ELIMINATORIAS_EUROPA: {
        playoffs: { ida: 26, vuelta: 27, jIda: 9, jVuelta: 10 },   
        octavos:  { ida: 30, vuelta: 31, jIda: 11, jVuelta: 12 },
        cuartos:  { ida: 34, vuelta: 35, jIda: 13, jVuelta: 14 },
        semis:    { ida: 38, vuelta: 39, jIda: 15, jVuelta: 16 },
        final:    { ucl: 42, uel: 41, uec: 41 }
    },
    LIGA_SUDAMERICA: {
        copas: [7, 10, 12, 15, 17, 22]
    }
};

// Helper para generar una matriz con el Lunes de inicio de cada semana de la temporada
function generarFechasSemanas(fechaReferencia) {
    let anioInicio;

    // BLINDAJE: Si es un objeto Date válido
    if (fechaReferencia instanceof Date && !isNaN(fechaReferencia)) {
        anioInicio = fechaReferencia.getFullYear();
        const mes = fechaReferencia.getMonth(); // 0 = Enero, 11 = Diciembre

        // Si está entre Enero y Junio, la temporada empezó el año anterior
        if (mes >= 0 && mes <= 5) {
            anioInicio = anioInicio - 1;
        }
    } 
    // BLINDAJE: Si le pasaste un string de fecha válido, lo convertimos
    else if (typeof fechaReferencia === 'string' && !isNaN(Date.parse(fechaReferencia))) {
        const fechaParseada = new Date(fechaReferencia);
        anioInicio = fechaParseada.getFullYear();
        const mes = fechaParseada.getMonth();
        if (mes >= 0 && mes <= 5) anioInicio = anioInicio - 1;
    }
    // BLINDAJE: Si lo que llegó es directamente el año (número o string numérico)
    else if (!isNaN(fechaReferencia)) {
        anioInicio = parseInt(fechaReferencia, 10);
    } 
    // Por si llega undefined, null o algo raro, usamos el año actual por defecto
    else {
        console.warn("[Calendario] fechaReferencia inválida o no definida. Usando año actual por defecto.");
        anioInicio = new Date().getFullYear();
    }

    const fechas = [];
    // Temporada arranca estimadamente el 11 de Agosto del año de inicio
    let fechaBucle = new Date(anioInicio, 7, 11); 
    
    // Ajustar al primer lunes
    while (fechaBucle.getDay() !== 1) {
        fechaBucle.setDate(fechaBucle.getDate() - 1); 
    }

    for (let i = 0; i <= 45; i++) { 
        fechas.push(new Date(fechaBucle));
        fechaBucle.setDate(fechaBucle.getDate() + 7);
    }
    return fechas;
}

function llamarOrTools(equipos, enfrentamientos) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(__dirname, 'sorteo_uefa.py'); 

        if (!fs.existsSync(scriptPath)) {
            return reject(`ERROR: El archivo ${scriptPath} no existe.`);
        }

        const pythonExecutable = process.platform === "win32" ? "python" : "python3";
        const pythonProcess = spawn(pythonExecutable, [scriptPath]);
        
        pythonProcess.stdin.write(JSON.stringify({ equipos, enfrentamientos }));
        pythonProcess.stdin.end();

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => { dataString += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { errorString += data.toString(); });

        pythonProcess.on('error', (err) => {
            reject(`Fallo al iniciar el proceso de Python: ${err.message}`);
        });

        pythonProcess.on('close', (code) => {
            if (errorString) console.error("Python reportó (stderr):", errorString);

            if (code !== 0) {
                return reject(`Python cerró con código ${code}. Error: ${errorString}`);
            }

            try {
                if (!dataString.trim()) throw new Error("Salida vacía");
                resolve(JSON.parse(dataString.trim()));
            } catch (e) {
                reject(`Error procesando JSON. Respuesta original: ${dataString}`);
            }
        });
    });
}

function obtenerFechaRealista(fechaBase, tipoCompeticion, nombreCompeticion = '', indicePartido = 0, esUltimaJornada = false, jornada = 0, totalPartidos = 10, bloquearLunes = false, bloquearViernes = false) {
    const nuevaFecha = new Date(fechaBase);
    const nombre = nombreCompeticion.toLowerCase();

    // COMPETICIONES EUROPEAS (UEFA)
    if (tipoCompeticion === 'internacional_europa') {
        const esChampions = nombre.includes('champions');
        const esEuropa = nombre.includes('europa');
        const esConference = nombre.includes('conference');
        
        if (esUltimaJornada) {
            nuevaFecha.setDate(nuevaFecha.getDate() + (esChampions ? 2 : 3));
            nuevaFecha.setHours(21, 0, 0, 0); 
            nuevaFecha.setSeconds(0, 0);
            return nuevaFecha;
        }
        
        if (jornada === 1) {
            if (esChampions) {
                if (indicePartido < 6) nuevaFecha.setDate(nuevaFecha.getDate() + 1); 
                else if (indicePartido < 12) nuevaFecha.setDate(nuevaFecha.getDate() + 2); 
                else nuevaFecha.setDate(nuevaFecha.getDate() + 3); 
                
                const esTurnoTarde = (indicePartido % 6 < 2);
                nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0, 0);
            } else if (esEuropa) {
                const esMiercoles = (indicePartido < 9);
                nuevaFecha.setDate(nuevaFecha.getDate() + (esMiercoles ? 2 : 3)); 
                
                const esTurnoTarde = (esMiercoles ? indicePartido < 2 : (indicePartido >= 9 && indicePartido < 11));
                nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0, 0);
            } else {
                nuevaFecha.setDate(nuevaFecha.getDate() + 3);
                const esTurnoTarde = (indicePartido < 9);
                nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0, 0);
            }
            nuevaFecha.setSeconds(0, 0);
            return nuevaFecha;
        } 
        
        if (jornada <= (esConference ? 6 : 8)) {
            if (esChampions) {
                nuevaFecha.setDate(nuevaFecha.getDate() + (indicePartido < 9 ? 1 : 2));
                const esTarde = (indicePartido % 9 < 2);
                nuevaFecha.setHours(esTarde ? 18 : 21, esTarde ? 45 : 0, 0, 0);
            } else {
                nuevaFecha.setDate(nuevaFecha.getDate() + 3);
                const esTarde = (indicePartido < 9);
                nuevaFecha.setHours(esTarde ? 18 : 21, esTarde ? 45 : 0, 0, 0);
            }
            nuevaFecha.setSeconds(0, 0);
            return nuevaFecha;
        } 

        const esVuelta = (jornada % 2 === 0);

        if (esChampions) {
            if (jornada >= 13) {
                const esMartesIda = (indicePartido % 2 === 0);
                if (!esVuelta) {
                    nuevaFecha.setDate(nuevaFecha.getDate() + (esMartesIda ? 1 : 2));
                } else {
                    nuevaFecha.setDate(nuevaFecha.getDate() + (esMartesIda ? 2 : 1));
                }
                nuevaFecha.setHours(21, 0, 0, 0);
            } else {
                const esMartesIda = (indicePartido < 4);
                if (!esVuelta) {
                    nuevaFecha.setDate(nuevaFecha.getDate() + (esMartesIda ? 1 : 2));
                } else {
                    nuevaFecha.setDate(nuevaFecha.getDate() + (esMartesIda ? 2 : 1));
                }
                
                let esTurnoTarde = (indicePartido === 0 || indicePartido === 4);
                if (esVuelta) {
                    esTurnoTarde = (indicePartido === 1 || indicePartido === 5);
                }
                nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0, 0);
            }
        } else {
            nuevaFecha.setDate(nuevaFecha.getDate() + 3);

            if (jornada >= 15) {
                nuevaFecha.setHours(21, 0, 0, 0);
            } else {
                const limiteTarde = (jornada >= 13) ? 2 : 4; 
                let esTurnoTarde = (indicePartido < limiteTarde);
                
                if (esVuelta) esTurnoTarde = !esTurnoTarde;
                
                nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0, 0);
            }
        }
    }
    else if (tipoCompeticion === 'internacional_america') {
        const esLibertadores = nombre.includes('libertadores');
        if (esUltimaJornada) {
            nuevaFecha.setDate(nuevaFecha.getDate() + (esLibertadores ? 2 : 3)); 
            nuevaFecha.setHours(21, 0, 0, 0); 
        } 
        else {
            const esMartes = (indicePartido % 2 === 0);
            nuevaFecha.setDate(nuevaFecha.getDate() + (esMartes ? 1 : 2));
            
            const esTurnoTarde = (Math.floor(indicePartido / 2) % 2 === 0);
            nuevaFecha.setHours(esTurnoTarde ? 19 : 21, 0, 0, 0);
        }
    }
    else if (tipoCompeticion === 'copa') {
        const esSemis = (jornada === 4 || jornada === 5); 
        const esFinal = (jornada === 6);

        if (esFinal) {
            nuevaFecha.setDate(nuevaFecha.getDate() + 5); // Desplazar al fin de semana asignado
            nuevaFecha.setHours(21, 0, 0, 0);
        } else {
            let diaExtra;
            if (esSemis) {
                diaExtra = (indicePartido % 2 === 0) ? 2 : 3; // Miércoles o Jueves
            } else {
                diaExtra = (indicePartido % 3) + 1; // Martes, Miércoles o Jueves equitativo
            }
            
            nuevaFecha.setDate(nuevaFecha.getDate() + diaExtra);
            const esTarde = (indicePartido % 2 === 0 && !esSemis);
            nuevaFecha.setHours(esTarde ? 19 : 21, 0, 0, 0);
        }
        nuevaFecha.setSeconds(0, 0);
        return nuevaFecha;
    }
    else if (tipoCompeticion === 'liga') {
        if (esUltimaJornada) {
            const diaActual = nuevaFecha.getDay();
            if (diaActual !== 0) {
                const diasHastaDomingo = (7 - diaActual) % 7;
                nuevaFecha.setDate(nuevaFecha.getDate() + diasHastaDomingo);
            }
            nuevaFecha.setHours(18, 0, 0, 0);
        } 
        else {
            // CORREGIDO: Rompemos la asignación lineal. Si está bloqueado el Viernes o Lunes por torneos europeos,
            // forzamos a que el partido sea reubicado equitativamente en el fin de semana.
            if (indicePartido === 0 && !bloquearViernes) {
                nuevaFecha.setDate(nuevaFecha.getDate() + 4); // Viernes normal
                nuevaFecha.setHours(21, 0, 0); 
            } 
            else if (indicePartido === totalPartidos - 1 && !bloquearLunes) {
                nuevaFecha.setDate(nuevaFecha.getDate() + 7); // Lunes normal
                nuevaFecha.setHours(21, 0, 0);
            } 
            else {
                // CORREGIDO: Evitamos el "Efecto Real Madrid". Balanceamos dinámicamente usando 
                // operadores modulares basándonos en el índice para alternar slots entre Sábado y Domingo.
                if (indicePartido % 2 === 0) {
                    nuevaFecha.setDate(nuevaFecha.getDate() + 5); // Sábado
                    const slotsSabado = [14, 16, 18, 21];
                    const hora = slotsSabado[Math.floor(indicePartido / 2) % slotsSabado.length];
                    nuevaFecha.setHours(hora, 0, 0);
                } else {
                    nuevaFecha.setDate(nuevaFecha.getDate() + 6); // Domingo
                    const slotsDomingo = [14, 16, 18, 21];
                    const hora = slotsDomingo[Math.floor(indicePartido / 2) % slotsDomingo.length];
                    nuevaFecha.setHours(hora, 0, 0);
                }
            }
        }
    } else {
        nuevaFecha.setHours(21, 0, 0);
    }

    nuevaFecha.setSeconds(0, 0);
    return nuevaFecha;
}

async function obtenerCampeonesVigentes(partidaId, anioActual, anioInicio) {
    if (anioActual === anioInicio) {
        return { champions: 'Paris Saint-Germain FC', europaLeague: 'Tottenham Hotspur', conference: 'Chelsea FC' };
    }

    const buscarGanador = async (nombreComp) => {
        const comp = await Competicion.findOne({ nombre: new RegExp(nombreComp, 'i') });
        if (!comp) return null;

        const final = await Partido.findOne({
            partidaId,
            competicionId: comp._id,
            tipo: 'FINAL',
            jugado: true
        }).sort({ fecha: -1 });

        if (!final) return null;

        const ganadorId = final.golesLocal > final.golesVisitante 
            ? final.equipoLocal 
            : final.equipoVisitante;

        const club = await Club.findById(ganadorId);
        return club ? club.nombre : null;
    };

    return {
        champions: await buscarGanador('Champions League'),
        europaLeague: await buscarGanador('Europa League'),
        conference: await buscarGanador('Conference League')
    };
}

async function generarCalendario(partidaId) {
    try {
        const partida = await Partida.findById(partidaId);
        const anioActual = partida.fechaActual.getFullYear();
        const anioInicioSimulacion = 2025; 
        const campeonesVigentes = await obtenerCampeonesVigentes(partidaId, anioActual, anioInicioSimulacion);
        await Partido.deleteMany({ partidaId: partidaId });
        console.log("Limpiando partidos antiguos...");

        const competiciones = await Competicion.find({});
        for (const comp of competiciones) {
            switch (comp.tipo) {
                case 'liga':
                    await generarLiga(partidaId, comp, anioActual);
                    break;
                case 'internacional_america':
                    await generarFaseSudamerica(partidaId, comp, anioActual);
                    break;
                case 'internacional_europa':
                    await generarFaseEuropa(partidaId, comp, anioActual, campeonesVigentes);
                    break;
                case 'copa':
                    await generarRondaInicialCopa(partidaId, comp, anioActual);
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
    let equipos = await Club.find({ partidaId, competiciones: competicion._id });
    equipos.sort(() => Math.random() - 0.5);
    
    if (equipos.length % 2 !== 0) {
        equipos.push({ nombre: 'DESCANSO', _id: null });
    }
    
    const numEquipos = equipos.length;
    const numJornadasVuelta = numEquipos - 1;
    const esSoloIda = numEquipos > 24;
    const numJornadasTotal = esSoloIda ? numJornadasVuelta : numJornadasVuelta * 2;
    
    let partidosIda = [];
    let retrasoInicioSemanas = (numEquipos <= 18 && !esSoloIda) ? 1 : 0; 
    let duracionParon = (numEquipos <= 18 && !esSoloIda) ? 3 : 1;

    const semanasFechas = generarFechasSemanas(anioInicio);

    // Mapeamos todas las semanas que contienen actividad UEFA para proteger a sus participantes
    const semanasConEuropa = new Set([
        ...CALENDARIO_MAESTRO.LIGA_EUROPA.ucl,
        ...CALENDARIO_MAESTRO.LIGA_EUROPA.uel,
        ...CALENDARIO_MAESTRO.LIGA_EUROPA.uec,
        CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.playoffs.ida,
        CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.playoffs.vuelta,
        CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.octavos.ida,
        CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.octavos.vuelta,
        CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.cuartos.ida,
        CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.cuartos.vuelta,
        CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.semis.ida,
        CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.semis.vuelta,
    ]);

    // Generar Ida (Round Robin)
    let pool = [...equipos];
    for (let j = 0; j < numJornadasVuelta; j++) {
        for (let i = 0; i < numEquipos / 2; i++) {
            let local, visitante;
            if (j % 2 === 0) {
                local = pool[i]; visitante = pool[numEquipos - 1 - i];
            } else {
                local = pool[numEquipos - 1 - i]; visitante = pool[i];
            }
            if (local._id && visitante._id) {
                partidosIda.push({ local: local._id, visitante: visitante._id, jornada: j + 1 });
            }
        }
        pool.splice(1, 0, pool.pop());
    }

    let todosLosPartidos = [...partidosIda];

    if (!esSoloIda) {
        let partidosVuelta = [];
        let vuelta = Array.from({length: numJornadasVuelta}, (_, i) => i + 1 + numJornadasVuelta);
        let jornadasVueltaAux = [];
        for (let i = 0; i < vuelta.length; i += 4) {
            let bloque = vuelta.slice(i, i + 4);
            bloque.sort(() => Math.random() - 0.5);
            jornadasVueltaAux.push(...bloque);
        }
        for (let j = 1; j <= numJornadasVuelta; j++) {
            const jornadaDestino = jornadasVueltaAux[j-1];
            const partidosDeEstaRonda = partidosIda.filter(p => p.jornada === j);
            partidosDeEstaRonda.forEach(p => {
                partidosVuelta.push({ local: p.visitante, visitante: p.local, jornada: jornadaDestino });
            });
        }
        todosLosPartidos = [...partidosIda, ...partidosVuelta];
    }

    let listaFinal = [];
    let semanaBucleMaestra = retrasoInicioSemanas; 

    for (let j = 1; j <= numJornadasTotal; j++) {
        let esIntersemanal = false;

        // CONFIGURACIÓN DE JORNADAS INTERSEMANALES
        if (numEquipos === 22) {
            if (j === 14) esIntersemanal = true;
        } else if (numEquipos === 24) {
            // INCREMENTADO: Ahora hay 5 jornadas intersemanales bien repartidas cada 8 jornadas
            // Esto adelanta el final de la liga regular unas 2 semanas completas.
            if (j === 8 || j === 16 || j === 24 || j === 32 || j === 40) esIntersemanal = true;
        }

        let fechaJornadaBase = new Date(semanasFechas[semanaBucleMaestra]);

        if (esIntersemanal) {
            fechaJornadaBase.setDate(fechaJornadaBase.getDate() + 1); // Martes/Miércoles
        }

        const partidosDeLaJornada = todosLosPartidos.filter(p => p.jornada === j);

        // Previsiones para bloquear Lunes/Viernes en base a la jornada adyacente
        let proximaEsIntersemanal = false;
        const proxJ = j + 1;
        if (numEquipos === 22 && proxJ === 14) proximaEsIntersemanal = true;
        if (numEquipos === 24 && (proxJ === 8 || proxJ === 16 || proxJ === 24 || proxJ === 32 || proxJ === 40)) proximaEsIntersemanal = true;

        let anteriorFueIntersemanal = false;
        const antJ = j - 1;
        if (numEquipos === 22 && antJ === 14) anteriorFueIntersemanal = true;
        if (numEquipos === 24 && (antJ === 8 || antJ === 16 || antJ === 24 || antJ === 32 || antJ === 40)) anteriorFueIntersemanal = true;

        partidosDeLaJornada.forEach((p, i) => {
            let fechaReal;
            if (esIntersemanal) {
                fechaReal = new Date(fechaJornadaBase);
                fechaReal.setDate(fechaReal.getDate() + (i % 2)); 
                fechaReal.setHours(20, 0, 0);
            } else {
                const estaSemanaTieneEuropa = semanasConEuropa.has(semanaBucleMaestra);
                const localClub = equipos.find(e => e._id?.toString() === p.local.toString());
                const visClub = equipos.find(e => e._id?.toString() === p.visitante.toString());

                const localEnEuropa = localClub?.competiciones?.length > 1;
                const visEnEuropa = visClub?.competiciones?.length > 1;

                let forzarBloqueoViernes = proximaEsIntersemanal;
                let forzarBloqueoLunes = anteriorFueIntersemanal;

                if (estaSemanaTieneEuropa && (localEnEuropa || visEnEuropa)) {
                    forzarBloqueoViernes = true;
                }

                fechaReal = obtenerFechaRealista(
                    fechaJornadaBase, 
                    'liga', 
                    competicion.nombre, 
                    i, 
                    (j === numJornadasTotal), 
                    j, 
                    partidosDeLaJornada.length, 
                    forzarBloqueoLunes,
                    forzarBloqueoViernes
                );
            }
            listaFinal.push(crearObjeto(partidaId, competicion._id, j, p.local, p.visitante, fechaReal, 'LIGA'));
        });

        // CONTROL DE AVANCE DE SEMANAS
        if (esIntersemanal) {
            semanaBucleMaestra++; 
        } else {
            if (!proximaEsIntersemanal) {
                semanaBucleMaestra++;
            }
        }

        // Parón de invierno invariable (Fin de la primera vuelta / Jornada 19)
        if (j === 19) {
            semanaBucleMaestra += duracionParon;
        }
    }

    await Partido.insertMany(listaFinal);
    console.log(`[${competicion.nombre}] Generados ${listaFinal.length} partidos de liga.`);
}

async function buscarFechaLibre(partidaId, fechaEstimada, equipoLocId, equipoVisId) {
    let fechaFinal = new Date(fechaEstimada);
    let conflicto = true;
    let intentos = 0;

    while (conflicto && intentos < 15) { 
        const inicioDia = new Date(fechaFinal); inicioDia.setHours(0,0,0,0);
        const finDia = new Date(fechaFinal); finDia.setHours(23,59,59,999);

        const partidoExistente = await Partido.findOne({
            partidaId,
            fecha: { $gte: inicioDia, $lte: finDia },
            $or: [
                { equipoLocal: equipoLocId }, { equipoVisitante: equipoLocId },
                { equipoLocal: equipoVisId }, { equipoVisitante: equipoVisId }
            ]
        });

        if (partidoExistente) {
            fechaFinal.setDate(fechaFinal.getDate() + 1);
            intentos++;
        } else {
            conflicto = false;
        }
    }
    return fechaFinal;
}

async function generarRondaInicialCopa(partidaId, competicion, anioInicio) {
    const equiposRaw = await Club.find({ partidaId, competiciones: competicion._id, esFilial: false, pais: competicion.pais });
    if (equiposRaw.length === 0) return;

    const semanasFechas = generarFechasSemanas(anioInicio);
    const tieneHistorial = equiposRaw.some(e => e.statsTemporada?.length > 0);
    let equiposOrdenados = [...equiposRaw].sort((a, b) => {
        if (!tieneHistorial) {
            if (a.division !== b.division) return a.division - b.division;
            return b.reputacion - a.reputacion;
        } else {
            const statsA = a.statsTemporada[0]?.puntos || 0; 
            const statsB = b.statsTemporada[0]?.puntos || 0;
            return statsB - statsA; 
        }
    });

    const N = equiposOrdenados.length;
    let OBJETIVO = 32;
    if (N < 32) OBJETIVO = 16;

    let partidosParaInsertar = [];
    let enfrentamientos = [];

    if (N > OBJETIVO) {
        // Hay ronda previa (Ronda 0 - 1/32)
        const numParaEliminar = N - OBJETIVO;
        const numEquiposEnPrevia = numParaEliminar * 2;
        const participantesPrevia = equiposOrdenados.slice(N - numEquiposEnPrevia);
        
        const numSemana = CALENDARIO_MAESTRO.COPA[0]; 
        let fechaBaseRonda = new Date(semanasFechas[numSemana]);

        const equiposSorteados = [...participantesPrevia].sort(() => Math.random() - 0.5);
        for (let i = 0; i < equiposSorteados.length; i += 2) {
            if (equiposSorteados[i+1]) {
                enfrentamientos.push({ loc: equiposSorteados[i], vis: equiposSorteados[i+1] });
            }
        }
        enfrentamientos.sort(() => Math.random() - 0.5);

        for (let i = 0; i < enfrentamientos.length; i++) {
            const p = enfrentamientos[i];
            const fechaEstimada = obtenerFechaRealista(fechaBaseRonda, 'copa', competicion.nombre, i, false, 0);
            const fechaSegura = await buscarFechaLibre(partidaId, fechaEstimada, p.loc._id, p.vis._id);
            const llaveCopaId = `COPA_0_LLAVE_${i + 1}`;
            
            partidosParaInsertar.push(crearObjeto(partidaId, competicion._id, 0, p.loc._id, p.vis._id, fechaSegura, 'ELIMINATORIA', llaveCopaId));
        }
    } else {
        // No hay previa, saltamos directos a los Dieciseisavos (Ronda 1 - 1/16)
        const numSemana = CALENDARIO_MAESTRO.COPA[1]; 
        let fechaBaseRonda = new Date(semanasFechas[numSemana]);

        const equiposSorteados = [...equiposOrdenados].sort(() => Math.random() - 0.5);
        for (let i = 0; i < equiposSorteados.length; i += 2) {
            if (equiposSorteados[i+1]) {
                const indicePartido = Math.floor(i / 2);
                const fechaEstimada = obtenerFechaRealista(fechaBaseRonda, 'copa', competicion.nombre, indicePartido, false, 1);
                const fechaSegura = await buscarFechaLibre(partidaId, fechaEstimada, equiposSorteados[i]._id, equiposSorteados[i+1]._id);
                const llaveCopaId = `COPA_1_LLAVE_${indicePartido + 1}`;

                partidosParaInsertar.push(crearObjeto(partidaId, competicion._id, 1, equiposSorteados[i]._id, equiposSorteados[i+1]._id, fechaSegura, 'ELIMINATORIA', llaveCopaId));
            }
        }
    }

    if (partidosParaInsertar.length > 0) {
        await Partido.insertMany(partidosParaInsertar);
        console.log(`[${competicion.nombre}] Generados con éxito ${partidosParaInsertar.length} partidos iniciales.`);
    }
}

async function generarFaseSudamerica(partidaId, competicion, anioInicio) {
    const equiposConsultados = await Club.find({ partidaId, competiciones: competicion._id });
    let bolsaEquipos = [...equiposConsultados].sort(() => Math.random() - 0.5);

    let todosLosPartidosTemporales = []; 
    const letrasGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const semanasFechas = generarFechasSemanas(anioInicio);

    for (let g = 0; g < 8; g++) {
        let grupo = [];
        let intentosGrupo = 0;
        let nombreGrupo = `Grupo ${letrasGrupos[g]}`;

        while (grupo.length < 4 && bolsaEquipos.length > 0) {
            const candidato = bolsaEquipos.pop();
            const yaHayPais = grupo.some(e => e.pais === candidato.pais);
            if (!yaHayPais || intentosGrupo > 50) {
                grupo.push(candidato);
                intentosGrupo = 0;
            } else {
                bolsaEquipos.unshift(candidato);
                intentosGrupo++;
            }
        }

        const enfrentamientos = [
            { j: 1, loc: 0, vis: 1 }, { j: 1, loc: 2, vis: 3 },
            { j: 2, loc: 1, vis: 2 }, { j: 2, loc: 3, vis: 0 },
            { j: 3, loc: 0, vis: 2 }, { j: 3, loc: 1, vis: 3 },
            { j: 4, loc: 1, vis: 0 }, { j: 4, loc: 3, vis: 2 },
            { j: 5, loc: 2, vis: 1 }, { j: 5, loc: 0, vis: 3 },
            { j: 6, loc: 2, vis: 0 }, { j: 6, loc: 3, vis: 1 }
        ];

        enfrentamientos.forEach(e => {
            if (grupo[e.loc] && grupo[e.vis]) {
                todosLosPartidosTemporales.push({ 
                    jornada: e.j, 
                    local: grupo[e.loc]._id, 
                    visitante: grupo[e.vis]._id, 
                    grupo: nombreGrupo 
                });
            }
        });
    }

    let listaFinal = [];
    const semanasCopa = CALENDARIO_MAESTRO.LIGA_SUDAMERICA.copas; 

    for (let j = 1; j <= 6; j++) {
        let partidosDeLaJornada = todosLosPartidosTemporales.filter(p => p.jornada === j);
        partidosDeLaJornada.sort(() => Math.random() - 0.5);

        partidosDeLaJornada.forEach((p, idx) => {
            const offsetSemanas = semanasCopa[j - 1];
            let fechaBaseJornada = new Date(semanasFechas[offsetSemanas]);

            const esUltimaJornada = (j === 6);
            const indiceEnvio = esUltimaJornada ? Math.floor(idx / 2) : idx;

            const fechaPartido = obtenerFechaRealista(fechaBaseJornada, 'internacional_america', competicion.nombre, indiceEnvio, esUltimaJornada, j);
            listaFinal.push(crearObjeto(partidaId, competicion._id, p.jornada, p.local, p.visitante, fechaPartido, 'LIGA', null, p.grupo));
        });
    }

    await Partido.insertMany(listaFinal);
    console.log(`[${competicion.nombre}] Fase de grupos generada: ${listaFinal.length} partidos.`);
}

function esEnfrentamientoValido(hA, hB, bRivalIdx, bAIdx, limites, historial) {
    if (hA.id === hB.id) return false;
    if (hA.rivales.has(hB.id)) return false;
    if (hA.pais === hB.pais) return false;
    if (hA.cuposBombo[bRivalIdx] >= limites.porBombo) return false;
    if (hB.cuposBombo[bAIdx] >= limites.porBombo) return false;
    
    let pA = 0, pB = 0;
    for (let rId of hA.rivales) if (historial[rId].pais === hB.pais) pA++;
    if (pA >= 2) return false;
    for (let rId of hB.rivales) if (historial[rId].pais === hA.pais) pB++;
    if (pB >= 2) return false;

    return true;
}

function ejecutarSorteoRecursivo(historial, bombos, limites, control) {
    control.iteraciones++;
    if (control.iteraciones > 5000) return false; 

    const equipos = Object.values(historial);
    const numBombos = bombos.length;
    const totalRivales = numBombos * limites.porBombo;
    
    const equiposIncompletos = equipos
    .filter(e => e.rivales.size < totalRivales)
    .sort((a, b) => {
        const contarPais = (p) => equipos.filter(e => e.pais === p).length;
        return contarPais(b.pais) - contarPais(a.pais) || b.rivales.size - a.rivales.size;
    });

    if (equiposIncompletos.length === 0) return true; 

    const hA = equiposIncompletos[0]; 
    const bAIdx = hA.bomboPertenece;

    let bRivalIdx = -1;
    for (let i = 0; i < numBombos; i++) {
        if (hA.cuposBombo[i] < limites.porBombo) {
            bRivalIdx = i;
            break;
        }
    }

    if (bRivalIdx === -1) return false;

    let candidatos = bombos[bRivalIdx]
        .map(c => historial[c._id.toString()])
        .filter(hB => esEnfrentamientoValido(hA, hB, bRivalIdx, bAIdx, limites, historial));

    candidatos.sort(() => Math.random() - 0.5);

    for (let hB of candidatos) {
        hA.rivales.add(hB.id); hB.rivales.add(hA.id);
        hA.cuposBombo[bRivalIdx]++; hB.cuposBombo[bAIdx]++;

        if (ejecutarSorteoRecursivo(historial, bombos, limites, control)) return true;

        hA.rivales.delete(hB.id); hB.rivales.delete(hA.id);
        hA.cuposBombo[bRivalIdx]--; hB.cuposBombo[bAIdx]--;
    }
    return false;
}

function equilibrarLocalias(historial, limites) {
    const equipos = Object.values(historial);
    if (!equipos || equipos.length === 0 || !equipos[0].cuposBombo) return [];
    const partidos = [];
    const procesados = new Set();
    const balance = {};
    
    const numBombos = equipos[0].cuposBombo.length;
    const maxL = (numBombos * limites.porBombo) / 2;

    equipos.forEach(h => {
        balance[h.id] = { totalL: 0, totalV: 0, porBombo: Array.from({length: numBombos}, () => ({ L: 0, V: 0 })) };
    });

    const listaCruces = [];
    equipos.forEach(hA => {
        hA.rivales.forEach(idB => {
            const pair = [hA.id, idB].sort().join('-');
            if (!procesados.has(pair)) {
                listaCruces.push({ a: hA.id, b: idB });
                procesados.add(pair);
            }
        });
    });

    listaCruces.forEach(({ a, b }) => {
        const hA = historial[a]; const hB = historial[b];
        const bA = hA.bomboPertenece; const bB = hB.bomboPertenece;

        let local, visita;
        const aPuedeL = balance[a].totalL < maxL && balance[a].porBombo[bB].L < (limites.porBombo / 2);
        const bPuedeV = balance[b].totalV < maxL && balance[b].porBombo[bA].V < (limites.porBombo / 2);

        if (aPuedeL && bPuedeV) { local = a; visita = b; } else { local = b; visita = a; }

        balance[local].totalL++;
        balance[local].porBombo[historial[visita].bomboPertenece].L++;
        balance[visita].totalV++;
        balance[visita].porBombo[historial[local].bomboPertenece].V++;
        partidos.push({ loc: local, vis: visita });
    });
    return partidos;
}

function asignarJornadas(partidosConJornada, competicion, anio, partidaId) {
    const nombre = (competicion.nombre || "").toLowerCase();
    const resultadoFinal = [];
    const semanasFechas = generarFechasSemanas(anio);
    
    const partidosPorJornada = {};
    for (const p of partidosConJornada) {
        if (!partidosPorJornada[p.jornada]) partidosPorJornada[p.jornada] = [];
        partidosPorJornada[p.jornada].push(p);
    }

    let miCalendario = CALENDARIO_MAESTRO.LIGA_EUROPA.uec;
    if (nombre.includes('champions')) miCalendario = CALENDARIO_MAESTRO.LIGA_EUROPA.ucl;
    else if (nombre.includes('europa')) miCalendario = CALENDARIO_MAESTRO.LIGA_EUROPA.uel;

    const maxJ = nombre.includes('conference') ? 6 : 8;

    Object.keys(partidosPorJornada).forEach(numJornada => {
        const j = parseInt(numJornada);
        const partidos = partidosPorJornada[j];
        partidos.sort(() => Math.random() - 0.5);

        partidos.forEach((p, idxEnJornada) => {
            const offsetAbsoluto = miCalendario[j - 1];
            let fechaLunesBase = new Date(semanasFechas[offsetAbsoluto]);

            const fechaFinal = obtenerFechaRealista(fechaLunesBase, 'internacional_europa', nombre, idxEnJornada, j === maxJ, j);

            resultadoFinal.push({
                partidaId: partidaId, competicionId: competicion._id, jornada: j,
                equipoLocal: p.loc, equipoVisitante: p.vis, fecha: fechaFinal, tipo: 'LIGA' 
            });
        });
    });

    return resultadoFinal;
}

async function generarFaseEuropa(partidaId, competicion, anioInicio, campeonesVigentes) {
    const nombreComp = competicion.nombre.toLowerCase();
    const esChampions = nombreComp.includes('champions');
    const esConference = nombreComp.includes('conference');

    const numBombos = esConference ? 6 : 4;
    const limites = { porBombo: esConference ? 1 : 2 };

    let equipos = await Club.find({ partidaId, competiciones: competicion._id });
    let bombo1Forzados = [];

    if (esChampions) {
       const idxChampions = equipos.findIndex(e => e.nombre === campeonesVigentes.champions);
        if (idxChampions !== -1) {
            const [equipo] = equipos.splice(idxChampions, 1);
            bombo1Forzados.push(equipo);
        }
    } 
    equipos.sort((a, b) => b.reputacion - a.reputacion);

    const tamanoBombo = 36 / numBombos;
    let bombos = Array.from({ length: numBombos }, () => []);
    bombos[0] = [...bombo1Forzados, ...equipos.splice(0, tamanoBombo - bombo1Forzados.length)];

    for (let i = 1; i < numBombos; i++) {
        bombos[i] = equipos.splice(0, tamanoBombo);
    }

    let exito = false;
    let historialFinal = null;
    let intentosGlobales = 0;

    while (!exito && intentosGlobales < 1000) {
        intentosGlobales++;
        let hIntento = {};
        bombos.forEach((b, idx) => b.forEach(e => {
            hIntento[e._id.toString()] = {
                id: e._id.toString(), pais: e.pais, bomboPertenece: idx,
                rivales: new Set(), cuposBombo: new Array(numBombos).fill(0)
            };
        }));

        if (ejecutarSorteoRecursivo(hIntento, bombos, limites, { iteraciones: 0 })) {
            historialFinal = hIntento;
            exito = true;
        }
    }

    if (exito && historialFinal) {
        const partidosFinales = equilibrarLocalias(historialFinal, limites);
        const equiposSimplificados = Object.values(historialFinal).map(e => ({ id: e.id, pais: e.pais }));
        
        try {
            const partidosConJornada = await llamarOrTools(equiposSimplificados, partidosFinales);
            if (partidosConJornada && partidosConJornada.length > 0) {
                const partidosDB = asignarJornadas(partidosConJornada, competicion, anioInicio, partidaId);
                if (partidosDB.length > 0) {
                    await Partido.insertMany(partidosDB);
                    console.log(`[${competicion.nombre}] ${partidosDB.length} partidos generados.`);
                }
            }
        } catch (error) {
            console.error(`[${competicion.nombre}] Error en el puente con Python:`, error);
        }
    }
}

async function generarDieciseisavosEuropa(partidaId, competicion, tablaPosiciones, fechaUltimaJornada) {
    const bloquesPlayoff = [
        { nombre: 'A', cabezas: [tablaPosiciones[8], tablaPosiciones[9]], rivales: [tablaPosiciones[22], tablaPosiciones[23]] },
        { nombre: 'B', cabezas: [tablaPosiciones[10], tablaPosiciones[11]], rivales: [tablaPosiciones[20], tablaPosiciones[21]] },
        { nombre: 'C', cabezas: [tablaPosiciones[12], tablaPosiciones[13]], rivales: [tablaPosiciones[18], tablaPosiciones[19]] },
        { nombre: 'D', cabezas: [tablaPosiciones[14], tablaPosiciones[15]], rivales: [tablaPosiciones[16], tablaPosiciones[17]] }
    ];
    
    let partidosParaInsertar = [];
    const semanasFechas = generarFechasSemanas(fechaUltimaJornada);    
    
    const configSem = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.playoffs;
    let fechaBaseIda = new Date(semanasFechas[configSem.ida]);
    let fechaBaseVuelta = new Date(semanasFechas[configSem.vuelta]);

    let llaves = [];
    bloquesPlayoff.forEach(bloque => {
        let cabezasMezclados = [...bloque.cabezas].sort(() => Math.random() - 0.5);
        let rivalesMezclados = [...bloque.rivales].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 2; i++) {
            llaves.push({ cabeza: cabezasMezclados[i], rival: rivalesMezclados[i], llaveId: `${bloque.nombre}${i + 1}` });
        }
    });
    llaves.sort(() => Math.random() - 0.5);

    llaves.forEach((llave, idx) => {
        let fechaIda = obtenerFechaRealista(fechaBaseIda, 'internacional_europa', competicion.nombre, idx, false, configSem.jIda);
        let fechaVuelta = obtenerFechaRealista(fechaBaseVuelta, 'internacional_europa', competicion.nombre, idx, false, configSem.jVuelta);

        partidosParaInsertar.push(crearObjeto(partidaId, competicion._id, configSem.jIda, llave.rival.clubId, llave.cabeza.clubId, fechaIda, 'ELIMINATORIA', llave.llaveId));
        partidosParaInsertar.push(crearObjeto(partidaId, competicion._id, configSem.jVuelta, llave.cabeza.clubId, llave.rival.clubId, fechaVuelta, 'ELIMINATORIA', llave.llaveId));
    });

    await Partido.insertMany(partidosParaInsertar);
} 

async function generarOctavosEuropa(partidaId, competicion, tablaPosiciones, ganadoresPlayoff, fechaUltimaJornada) {
    let partidosParaInsertar = [];
    const semanasFechas = generarFechasSemanas(fechaUltimaJornada);   

    const configSem = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.octavos;
    let fechaBaseIda = new Date(semanasFechas[configSem.ida]);
    let fechaBaseVuelta = new Date(semanasFechas[configSem.vuelta]);

    const rutasOctavos = [
        { posicionLiga: 0, llavePO: 'D1', idRuta: 'RUTA_1' }, { posicionLiga: 1, llavePO: 'C1', idRuta: 'RUTA_2' },
        { posicionLiga: 2, llavePO: 'B1', idRuta: 'RUTA_3' }, { posicionLiga: 3, llavePO: 'A1', idRuta: 'RUTA_4' },
        { posicionLiga: 4, llavePO: 'A2', idRuta: 'RUTA_5' }, { posicionLiga: 5, llavePO: 'B2', idRuta: 'RUTA_6' },
        { posicionLiga: 6, llavePO: 'C2', idRuta: 'RUTA_7' }, { posicionLiga: 7, llavePO: 'D2', idRuta: 'RUTA_8' }
    ];
    rutasOctavos.sort(() => Math.random() - 0.5);

    rutasOctavos.forEach((ruta, idx) => {
        const cabezaClubId = tablaPosiciones[ruta.posicionLiga].clubId;
        const rivalClubId = ganadoresPlayoff[ruta.llavePO];
        
        let fechaIda = obtenerFechaRealista(fechaBaseIda, 'internacional_europa', competicion.nombre, idx, false, configSem.jIda);
        let fechaVuelta = obtenerFechaRealista(fechaBaseVuelta, 'internacional_europa', competicion.nombre, idx, false, configSem.jVuelta);

        partidosParaInsertar.push(crearObjeto(partidaId, competicion._id, configSem.jIda, rivalClubId, cabezaClubId, fechaIda, 'ELIMINATORIA', ruta.idRuta));
        partidosParaInsertar.push(crearObjeto(partidaId, competicion._id, configSem.jVuelta, cabezaClubId, rivalClubId, fechaVuelta, 'ELIMINATORIA', ruta.idRuta));
    });

    await Partido.insertMany(partidosParaInsertar);
    console.log(`[${competicion.nombre}] Octavos de final generados.`);
}

async function generarCuadroFinalEuropa(partidaId, competicion, ganadoresRondaAnterior, faseNombre, fechaBaseRondaAnterior) {
    const nombreComp = competicion.nombre.toLowerCase();
    const esChampions = nombreComp.includes('champions');

    let partidosParaInsertar = [];
    const semanasFechas = generarFechasSemanas(fechaBaseRondaAnterior);

    let configSem;
    if (faseNombre === 'CUARTOS') configSem = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.cuartos;
    else if (faseNombre === 'SEMIFINAL') configSem = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.semis;

    if (faseNombre === 'FINAL') {
        const indexSemana = esChampions ? CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.final.ucl : CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.final.uel;
        let fechaFinal = new Date(semanasFechas[indexSemana]);
        
        fechaFinal.setDate(fechaFinal.getDate() + (esChampions ? 5 : 2)); 
        fechaFinal.setHours(21, 0, 0, 0);

        const arrayFinalistas = Object.values(ganadoresRondaAnterior); 
        if (!arrayFinalistas[0] || !arrayFinalistas[1]) return;

        const partidoFinal = crearObjeto(partidaId, competicion._id, 17, arrayFinalistas[0], arrayFinalistas[1], fechaFinal, 'FINAL');
        return await Partido.create(partidoFinal);
    }

    let emparejamientos = [];
    if (faseNombre === 'CUARTOS') {
        emparejamientos = [
            { t1: ganadoresRondaAnterior['RUTA_1'], t2: ganadoresRondaAnterior['RUTA_8'], rutaSig: 'SEM_1', localVuelta: 't1' },
            { t1: ganadoresRondaAnterior['RUTA_4'], t2: ganadoresRondaAnterior['RUTA_5'], rutaSig: 'SEM_1', localVuelta: 't1' },
            { t1: ganadoresRondaAnterior['RUTA_2'], t2: ganadoresRondaAnterior['RUTA_7'], rutaSig: 'SEM_2', localVuelta: 't1' },
            { t1: ganadoresRondaAnterior['RUTA_3'], t2: ganadoresRondaAnterior['RUTA_6'], rutaSig: 'SEM_2', localVuelta: 't1' }
        ];
    } else if (faseNombre === 'SEMIFINAL') {
        const equiposSem1 = ganadoresRondaAnterior['SEM_1'] || [];
        const equiposSem2 = ganadoresRondaAnterior['SEM_2'] || [];
        if (equiposSem1.length < 2 || equiposSem2.length < 2) return;

        emparejamientos = [
            { t1: equiposSem1[0], t2: equiposSem1[1], rutaSig: 'FINAL', localVuelta: 't1' },
            { t1: equiposSem2[0], t2: equiposSem2[1], rutaSig: 'FINAL', localVuelta: 't1' }
        ];
    }

    let fechaBaseIda = new Date(semanasFechas[configSem.ida]);
    let fechaBaseVuelta = new Date(semanasFechas[configSem.vuelta]);
    emparejamientos.sort(() => Math.random() - 0.5);

    emparejamientos.forEach((cruce, idx) => {
        let fechaIda = obtenerFechaRealista(fechaBaseIda, 'internacional_europa', competicion.nombre, idx, false, configSem.jIda);
        let fechaVuelta = obtenerFechaRealista(fechaBaseVuelta, 'internacional_europa', competicion.nombre, idx, false, configSem.jVuelta);

        const localVueltaId = cruce.localVuelta === 't1' ? cruce.t1 : cruce.t2;
        const visitaVueltaId = cruce.localVuelta === 't1' ? cruce.t2 : cruce.t1;

        partidosParaInsertar.push(crearObjeto(partidaId, competicion._id, configSem.jIda, visitaVueltaId, localVueltaId, fechaIda, 'ELIMINATORIA', cruce.rutaSig));
        partidosParaInsertar.push(crearObjeto(partidaId, competicion._id, configSem.jVuelta, localVueltaId, visitaVueltaId, fechaVuelta, 'ELIMINATORIA', cruce.rutaSig));
    });

    await Partido.insertMany(partidosParaInsertar);
    console.log(`[${competicion.nombre}] Generada fase de ${faseNombre}.`);
}

async function generarPlayoffsSudamericana(partidaId, compSudamericanaId, nombreCompeticion, resultadosLib, resultadosSud, fechaUltimaJornada) {
    let partidos = [];
    const semanasFechas = generarFechasSemanas(fechaUltimaJornada);

    let fechaBaseIda = new Date(semanasFechas[CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.playoffs.ida]);
    let fechaBaseVuelta = new Date(semanasFechas[CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.playoffs.vuelta]);

    const bombosSud = [...resultadosSud].sort(() => Math.random() - 0.5);
    const bombosLib = [...resultadosLib].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 8; i++) {
        if (!bombosSud[i] || !bombosLib[i]) break;

        const localId = bombosSud[i].clubId;
        const visitanteId = bombosLib[i].clubId;
        const llaveId = `PO_SUD_${i + 1}`;
        
        const fechaIda = obtenerFechaRealista(fechaBaseIda, 'internacional_america', nombreCompeticion, i, false, 9);
        const fechaVuelta = obtenerFechaRealista(fechaBaseVuelta, 'internacional_america', nombreCompeticion, i, false, 10);
        
        partidos.push(crearObjeto(partidaId, compSudamericanaId, 9, localId, visitanteId, fechaIda, 'ELIMINATORIA', llaveId));
        partidos.push(crearObjeto(partidaId, compSudamericanaId, 10, visitanteId, localId, fechaVuelta, 'ELIMINATORIA', llaveId));
    }
    await Partido.insertMany(partidos);
    console.log(`[Sudamericana] Play-offs.`);
}

async function generarRondaEliminatoriaSudamerica(partidaId, competicion, equiposGanadores, jornadaNombre, fechaBase, numJornada) {
    let partidos = [];
    let bolsa = [...equiposGanadores].sort(() => Math.random() - 0.5);
    const semanasFechas = generarFechasSemanas(fechaBase);

    if (jornadaNombre.toUpperCase() === 'FINAL') {
        let fechaBaseFinal = new Date(semanasFechas[CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.final.ucl]); 
        const fechaFinal = obtenerFechaRealista(fechaBaseFinal, 'internacional_america', competicion.nombre, 0, false, 17);
        partidos.push(crearObjeto(partidaId, competicion._id, numJornada, bolsa[0], bolsa[1], fechaFinal, 'FINAL'));
    } 
    else {
        let indexSemanaIda = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.octavos.ida;
        let indexSemanaVuelta = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.octavos.vuelta;

        if (jornadaNombre.toUpperCase().includes('CUARTOS')) {
            indexSemanaIda = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.cuartos.ida;
            indexSemanaVuelta = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.cuartos.vuelta;
        } else if (jornadaNombre.toUpperCase().includes('SEMIFINAL')) {
            indexSemanaIda = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.semis.ida;
            indexSemanaVuelta = CALENDARIO_MAESTRO.ELIMINATORIAS_EUROPA.semis.vuelta;
        }

        let fechaBaseIda = new Date(semanasFechas[indexSemanaIda]);
        let fechaBaseVuelta = new Date(semanasFechas[indexSemanaVuelta]);

        for (let i = 0; i < bolsa.length; i += 2) {
            if (bolsa[i+1]) {
                const indicePartidoEntero = Math.floor(i / 2);
                const fechaIda = obtenerFechaRealista(fechaBaseIda, 'internacional_america', competicion.nombre, indicePartidoEntero, false, numJornada);
                const fechaVuelta = obtenerFechaRealista(fechaBaseVuelta, 'internacional_america', competicion.nombre, indicePartidoEntero, false, numJornada + 1);
                const llaveId = `LLAVE_${jornadaNombre.toUpperCase()}_${indicePartidoEntero + 1}`;
                
                partidos.push(crearObjeto(partidaId, competicion._id, numJornada, bolsa[i], bolsa[i+1], fechaIda, 'ELIMINATORIA', llaveId));
                partidos.push(crearObjeto(partidaId, competicion._id, numJornada + 1, bolsa[i+1], bolsa[i], fechaVuelta, 'ELIMINATORIA', llaveId));
            }
        }
    }
    await Partido.insertMany(partidos);
    console.log(`[${competicion.nombre}] Ronda de ${jornadaNombre} generada.`);
}

async function generarSiguienteRondaCopa(partidaId, competicion, equiposGanadores, jornadaNombre, fechaUltimaJornada, numJornada) {
    if (numJornada === 5) {
        console.log(`[${competicion.nombre}] La ronda de vuelta (5) ya fue generada previamente junto con la ida.`);
        return;
    }

    let bolsa = [...equiposGanadores].sort(() => Math.random() - 0.5);
    let partidos = [];
    
    const semanasFechas = generarFechasSemanas(fechaUltimaJornada);
    const nombreComp = competicion.nombre.toLowerCase();
    
    const esSemifinal = (numJornada === 4); 
    const esFinal = (numJornada === 6);

    let tieneVuelta = false;
    if (esSemifinal) {
        const paisesDobleSemi = ['españa', 'italia', 'portugal', 'paises bajos', 'brasil'];
        tieneVuelta = paisesDobleSemi.some(p => nombreComp.includes(p));
    } else if (esFinal) {
        tieneVuelta = nombreComp.includes('brasil');
    }
    
    const semanaIdaMapeada = CALENDARIO_MAESTRO.COPA[numJornada];
    let fechaBaseIda = new Date(semanasFechas[semanaIdaMapeada]);

    for (let i = 0; i < bolsa.length; i += 2) {
        if (bolsa[i+1]) {
            const indicePartidoEntero = Math.floor(i / 2);
            
            const fechaEstimadaIda = obtenerFechaRealista(fechaBaseIda, 'copa', competicion.nombre, indicePartidoEntero, false, numJornada);
            // Cambiado de 'llaveCopaId' a 'llave' para mantener coherencia con el motor y consultas
            const llave = `COPA_${numJornada}_LLAVE_${indicePartidoEntero + 1}`;
            const tipoPartido = (esFinal && !tieneVuelta) ? 'FINAL' : 'ELIMINATORIA';

            const fechaSeguraIda = await buscarFechaLibre(partidaId, fechaEstimadaIda, bolsa[i], bolsa[i+1]);
            // Asegúrate de que tu función crearObjeto asigne este valor a la propiedad 'llave'
            partidos.push(crearObjeto(partidaId, competicion._id, numJornada, bolsa[i], bolsa[i+1], fechaSeguraIda, tipoPartido, llave));

            if (tieneVuelta) {
                const semanaVueltaMapeada = CALENDARIO_MAESTRO.COPA[numJornada + 1];
                let fechaBaseVuelta;

                if (semanasFechas[semanaVueltaMapeada]) {
                    fechaBaseVuelta = new Date(semanasFechas[semanaVueltaMapeada]);
                } else {
                    fechaBaseVuelta = new Date(fechaBaseIda.getTime());
                    fechaBaseVuelta.setDate(fechaBaseVuelta.getDate() + 21);
                }

                const fechaEstimadaVuelta = obtenerFechaRealista(fechaBaseVuelta, 'copa', competicion.nombre, indicePartidoEntero, false, numJornada + 1);
                const fechaSeguraVuelta = await buscarFechaLibre(partidaId, fechaEstimadaVuelta, bolsa[i+1], bolsa[i]);

                // Se guarda explícitamente etiquetado como ronda 5 y con la misma 'llave'
                partidos.push(crearObjeto(partidaId, competicion._id, numJornada + 1, bolsa[i+1], bolsa[i], fechaSeguraVuelta, 'ELIMINATORIA', llave));
            }
        }
    }
    
    if (partidos.length > 0) {
        await Partido.insertMany(partidos);
        console.log(`[${competicion.nombre}] Siguiente ronda (${jornadaNombre}) creada correctamente con jornadas y fechas limpias.`);
    }
}

function crearObjeto(partidaId, competicionId, jornada, equipoLocal, equipoVisitante, fecha, tipo, llave = null, grupo = null) {
    return {
        partidaId,
        competicionId,
        jornada,
        equipoLocal,
        equipoVisitante,
        fecha,
        tipo,    
        llave,   
        grupo,
        jugado: false,
        golesLocal: 0,
        golesVisitante: 0
    };
}

module.exports = {
    generarCalendario,
    generarDieciseisavosEuropa,
    generarOctavosEuropa,
    generarCuadroFinalEuropa,
    generarPlayoffsSudamericana,
    generarRondaEliminatoriaSudamerica,
    generarSiguienteRondaCopa
};