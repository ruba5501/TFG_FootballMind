const Partido = require('../models/partido');
const Club = require('../models/club');
const Partida = require('../models/partida');
const Competicion = require('../models/competicion');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SEMANAS_COPA = {
    0: 7,  // Ronda Previa
    1: 9,  // 1/32 -> Diciembre
    2: 14, // 1/16
    3: 16, // 1/8
    4: 20, // 1/4
    5: 24, // 1/2 Ida
    6: 28, // 1/2 Vuelta
    7: 35  // Final
};


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

function obtenerFechaRealista(fechaBase, tipoCompeticion, nombreCompeticion = '', indicePartido = 0, esUltimaJornada = false, jornada = 0, totalPartidos = 10, bloquearLunes = false) {
    const nuevaFecha = new Date(fechaBase);
    const nombre = nombreCompeticion.toLowerCase();


    // EUROPA
    if (tipoCompeticion === 'internacional_europa') {
        const esChampions = nombre.includes('champions');
        const esEuropa = nombre.includes('europa');
        const esConference = nombre.includes('conference');
        // ULTIMA JORNADA DE LIGA EUROPA
        if (esUltimaJornada) {
            // Champions: Miércoles, Europa/Conf: Jueves 
            nuevaFecha.setDate(nuevaFecha.getDate() + (esChampions ? 2 : 3));
            nuevaFecha.setHours(21, 0, 0, 0); 
        }
        // PRIMERA JORNADA DE LIGA EUROPA
        else if (jornada === 1) {
            if (esChampions) {
                //martes, miercoles y jueves con dos partidos a las 18:45 cada dia y el resto 21:00
                if (indicePartido < 6) nuevaFecha.setDate(nuevaFecha.getDate() + 1); 
                else if (indicePartido < 12) nuevaFecha.setDate(nuevaFecha.getDate() + 2); 
                else nuevaFecha.setDate(nuevaFecha.getDate() + 3); 
                
                const esTurnoTarde = (indicePartido % 6 < 2);
                nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0, 0);
            } else if (esEuropa) {
                //miercoles y jueves con dos partidos 18:45 y el resto 21:00
                const esMiercoles = (indicePartido < 9);
                nuevaFecha.setDate(nuevaFecha.getDate() + (esMiercoles ? 2 : 3)); 
                
                const esTurnoTarde = (esMiercoles ? indicePartido < 2 : (indicePartido >= 9 && indicePartido < 11));
                nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0, 0);
            } else {
                //jueves con mitad 18:45 y mitad 21:00
                nuevaFecha.setDate(nuevaFecha.getDate() + 3);
                
                const esTurnoTarde = (indicePartido < 9);
                nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0, 0);
            }
        } 
        else if (jornada <= (nombre.includes('conference') ? 6 : 8)) {
            if (esChampions) {
                // Martes (mitad martes y mitad miercoles con 2 y 2 partidos por la tarde)
                nuevaFecha.setDate(nuevaFecha.getDate() + (indicePartido < 9 ? 1 : 2));
                const esTarde = (indicePartido % 9 < 2);
                nuevaFecha.setHours(esTarde ? 18 : 21, esTarde ? 45 : 0, 0, 0);
            } else {
                // Jueves para Europa y Conference (mitad tarde, mitad noche)
                nuevaFecha.setDate(nuevaFecha.getDate() + 3);
                const esTarde = (indicePartido < 9);
                nuevaFecha.setHours(esTarde ? 18 : 21, esTarde ? 45 : 0, 0, 0);
            }
        } 
        // FASES ELIMINATORIAS
        else {
            if (esChampions) {
                const diaExtra = (indicePartido % 2);
                nuevaFecha.setDate(nuevaFecha.getDate() + diaExtra);
                
                if (jornada >= 13) { // 9, 10, 11 y 12 son Playoffs y Octavos
                    nuevaFecha.setHours(21, 0, 0);
                } else {
                    const esTurnoTarde = (indicePartido === 0);
                    nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0);
                }
            } else {
                nuevaFecha.setDate(nuevaFecha.getDate() + 2);
                const limitePrime = esEuropa ? 13 : 15;
                if (jornada >= limitePrime) {
                    nuevaFecha.setHours(21, 0, 0);
                } else {
                    const esTurnoTarde = (indicePartido % 2 === 0);
                    nuevaFecha.setHours(esTurnoTarde ? 18 : 21, esTurnoTarde ? 45 : 0, 0);
                }
            }
        }
    }
    //SUDAMERICA
    else if (tipoCompeticion === 'internacional_america') {
        const esLibertadores = nombre.includes('libertadores');
        if (esUltimaJornada) {
            if(esLibertadores){
                nuevaFecha.setDate(nuevaFecha.getDate() + 1); 
                nuevaFecha.setHours(21, 0, 0, 0); 
            }
            else{
                nuevaFecha.setDate(nuevaFecha.getDate() + 2); 
                nuevaFecha.setHours(21, 0, 0, 0); 
            }
        } 
        else {
            const esMartes = (indicePartido % 2 === 0);
            nuevaFecha.setDate(nuevaFecha.getDate() + (esMartes ? 1 : 2));
            
            const esTurnoTarde = (Math.floor(indicePartido / 2) % 2 === 0);
            nuevaFecha.setHours(esTurnoTarde ? 19 : 21, 0, 0, 0);
        }
    }
    //COPAS NACIONALES
    else if (tipoCompeticion === 'copa') {
        const esFinal = (jornada === 7);
        const esSemis = (jornada === 5 || jornada === 6);

        if (esFinal) {
            nuevaFecha.setDate(nuevaFecha.getDate() + 1);
            nuevaFecha.setHours(21, 0, 0, 0);
        } else {
            // Martes, Miércoles o Jueves
            let diaExtra;
            if (esSemis) {
                // Semis solo Miércoles y Jueves
                diaExtra = (indicePartido % 2 === 0) ? 5 : 6;
            } else {
                diaExtra = (indicePartido % 3) + 4;
            }
            
            nuevaFecha.setDate(nuevaFecha.getDate() + diaExtra);
            
            const esTarde = (indicePartido % 2 === 0 && !esSemis);
            nuevaFecha.setHours(esTarde ? 19 : 21, 0, 0, 0);
        }
    }
    // LIGAS
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
            // 1. VIERNES: Primer partido del array (índice 0)
            if (indicePartido === 0) {
                nuevaFecha.setHours(21, 0, 0); 
            } 
            
            // 2. LUNES: Último partido del array (si hay flexibilidad)
            else if (indicePartido === totalPartidos - 1 && !bloquearLunes) {
                nuevaFecha.setDate(nuevaFecha.getDate() + 3);
                nuevaFecha.setHours(21, 0, 0);
            } 
            
            // 3. SÁBADO: La primera mitad de los partidos restantes
            // Si hay 10 partidos, del 1 al 4. Si hay 9, del 1 al 4.
            else if (indicePartido < totalPartidos / 2) {
                nuevaFecha.setDate(nuevaFecha.getDate() + 1); 
                
                // Reparto de horas dinámico entre 14h y 21h
                const slotsSabado = [14, 16, 18, 21];
                const hora = slotsSabado[(indicePartido - 1) % slotsSabado.length];
                nuevaFecha.setHours(hora, 0, 0);
            } 
            
            // 4. DOMINGO: La segunda mitad de los partidos restantes
            else {
                nuevaFecha.setDate(nuevaFecha.getDate() + 2);
                
                // Reparto de horas dinámico entre 14h y 21h
                const slotsDomingo = [14, 16, 18, 21];
                const baseIndex = Math.floor(totalPartidos / 2);
                const hora = slotsDomingo[(indicePartido - baseIndex) % slotsDomingo.length];
                nuevaFecha.setHours(hora, 0, 0);
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
    const compsInternacionales = await Competicion.find({ 
        tipo: { $in: ['internacional_europa', 'internacional_america'] } 
    }).select('_id');

    const idsInternacionales = compsInternacionales.map(c => c._id.toString());

    const equiposInternacionalesIds = equipos
        .filter(e => e.competiciones.some(cId => idsInternacionales.includes(cId.toString())))
        .map(e => e._id.toString());

    const numEquipos = equipos.length;
    const numJornadasVuelta = numEquipos - 1;
    const esSoloIda = numEquipos > 24;
    const numJornadasTotal = esSoloIda ? numJornadasVuelta : numJornadasVuelta * 2;
    
    let partidosIda = [];
    let retrasoInicioSemanas = (numEquipos <= 18 && !esSoloIda) ? 1 : 0; 
    let duracionParon = (numEquipos <= 18 && !esSoloIda) ? 3 : 1;
    let fechaBaseCompeticion = new Date(anioInicio, 7, 16);
    fechaBaseCompeticion.setDate(fechaBaseCompeticion.getDate() + (retrasoInicioSemanas * 7));

    while(fechaBaseCompeticion.getDay() !== 5) {
        fechaBaseCompeticion.setDate(fechaBaseCompeticion.getDate() + 1);
    }

    // Generar Ida (Round Robin)
    let pool = [...equipos];
    for (let j = 0; j < numJornadasVuelta; j++) {
        for (let i = 0; i < numEquipos / 2; i++) {
            let local, visitante;
            
            if (j % 2 === 0) {
                local = pool[i];
                visitante = pool[numEquipos - 1 - i];
            } else {
                local = pool[numEquipos - 1 - i];
                visitante = pool[i];
            }

            if (local._id && visitante._id) {
                partidosIda.push({ 
                    local: local._id, 
                    visitante: visitante._id, 
                    jornada: j + 1 
                });
            }
        }
        pool.splice(1, 0, pool.pop());
    }

    let todosLosPartidos = [...partidosIda];

    if (!esSoloIda) {
        let partidosVuelta = [];
        let vuelta = Array.from({length: numJornadasVuelta}, (_, i) => i + 1 + numJornadasVuelta);

        // Mezclar para evitar mas de 4 jornadas seguidas local/visitante
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
                partidosVuelta.push({
                    local: p.visitante,
                    visitante: p.local,
                    jornada: jornadaDestino
                });
            });
        }
        todosLosPartidos = [...partidosIda, ...partidosVuelta];
    }

    let listaFinal = [];
    let semanaActual = 0;
    for (let j = 1; j <= numJornadasTotal; j++) {
        let esIntersemanal = false;
        let finalCopa = false;
        if (numEquipos > 20 && numEquipos < 25) {
            //Hueco para final de copa
            if (j === 41){
                esIntersemanal = true;
                finalCopa = true;
            }
            if (numEquipos === 22) { // España (Segunda)
                // Solo 2 jornadas extra: jornada 9 y en la 39
                if (j === 8 || j === 39) esIntersemanal = true;
            } else if (numEquipos === 24) { // Inglaterra (Championship)
                //  cada 5 jornadas antes de la 20, la 39 y la 44
                if ((j % 5 === 0 && j < 20) || j === 39 || j === 44) esIntersemanal = true;
            }
        }

        let fechaJornadaBase = new Date(fechaBaseCompeticion);

        if (esIntersemanal) {
            if (finalCopa) {
                fechaJornadaBase.setDate(fechaJornadaBase.getDate() + (semanaActual * 7) + 4);
                semanaActual++;
            }
            else fechaJornadaBase.setDate(fechaJornadaBase.getDate() + (semanaActual * 7) - 3);
        } else {
            fechaJornadaBase.setDate(fechaJornadaBase.getDate() + (semanaActual * 7));
        }

        const partidosDeLaJornada = todosLosPartidos.filter(p => p.jornada === j);
        
        const esSemanaDeCopa = Object.values(SEMANAS_COPA).includes(semanaActual + retrasoInicioSemanas);
        let equiposConCopa = [];
        
        if (esSemanaDeCopa) {
            const inicioSemana = new Date(fechaJornadaBase);
            const finSemana = new Date(fechaJornadaBase);
            finSemana.setDate(finSemana.getDate() + 7);

            const partidosCopa = await Partido.find({ 
                partidaId, 
                tipo: 'ELIMINATORIA',
                fecha: { $gte: inicioSemana, $lt: finSemana }
            }).select('local visitante');

            equiposConCopa = partidosCopa.flatMap(p => {
                const ids = [];
                if (p.local) ids.push(p.local.toString());
                if (p.visitante) ids.push(p.visitante.toString());
                return ids;
            });
        }

        let restringidos = []; // Van a Sábado/Domingo
        let flexibles = [];    // Candidatos a Viernes/Lunes

        partidosDeLaJornada.forEach(p => {
            const involucraInternacional = equiposInternacionalesIds.includes(p.local.toString()) || 
                                          equiposInternacionalesIds.includes(p.visitante.toString());
            
            const involucraCopa = equiposConCopa.includes(p.local.toString()) || 
                             equiposConCopa.includes(p.visitante.toString());

            if (involucraInternacional || involucraCopa) {
                restringidos.push(p);
            } else {
                flexibles.push(p);
            }
        });

        flexibles.sort(() => Math.random() - 0.5);
        restringidos.sort(() => Math.random() - 0.5);

        let jornadaOrdenada = [];
        if (flexibles.length >= 2 && !esIntersemanal) {
            const partidoViernes = flexibles.pop();
            const partidoLunes = flexibles.pop();
            const bloqueCentral = [...restringidos, ...flexibles].sort(() => Math.random() - 0.5);
            jornadaOrdenada = [partidoViernes, ...bloqueCentral, partidoLunes];
        } else {
            jornadaOrdenada = [...restringidos, ...flexibles].sort(() => Math.random() - 0.5);
        }

        if (!esIntersemanal) semanaActual++;
        if (j === 19) semanaActual += duracionParon;

        // Detectar si la siguiente jornada es intersemanal para bloquear el Lunes de esta
        let proximaEsIntersemanal = false;
        if (numEquipos === 22 && (j + 1 === 8 || j + 1 === 39 || j + 1 === 41)) proximaEsIntersemanal = true;
        if (numEquipos === 24 && (((j + 1) % 5 === 0 && (j + 1) < 20) || j + 1 === 39 || j + 1 === 41 || j + 1 === 44)) proximaEsIntersemanal = true;

        jornadaOrdenada.forEach((p, i) => {
            let fechaReal;
            if (esIntersemanal) {
                fechaReal = new Date(fechaJornadaBase);
                fechaReal.setDate(fechaReal.getDate() + (i % 2)); // Repartir en Martes/Miércoles o Miércoles/Jueves
                fechaReal.setHours(20, 0, 0);
            } else {
                const esEquipoCansado = restringidos.includes(p);
                fechaReal = obtenerFechaRealista(
                    fechaJornadaBase, 
                    'liga', 
                    competicion.nombre, 
                    i,
                    (j === numJornadasTotal), 
                    j, 
                    jornadaOrdenada.length,
                    proximaEsIntersemanal // Si mañana es martes de liga, hoy no se juega lunes
                );
            }

            listaFinal.push(crearObjeto(partidaId, competicion._id, j, p.local, p.visitante, fechaReal, 'LIGA'));
        });
    }

    await Partido.insertMany(listaFinal);
    console.log(`[${competicion.nombre}] Generados ${listaFinal.length} partidos.`);
}

async function generarRondaInicialCopa(partidaId, competicion, anioInicio) {
    const equiposRaw = await Club.find({ 
        partidaId, 
        competiciones: competicion._id, 
        esFilial: false, 
        pais: competicion.pais 
    });

    if (equiposRaw.length === 0) return;

    const tieneHistorial = equiposRaw.some(e => e.statsTemporada?.length > 0);
    let equiposOrdenados = [...equiposRaw].sort((a, b) => {
        if (!tieneHistorial) {
            if (a.division !== b.division) return a.division - b.division;
            return b.reputacion - a.reputacion;
        }
        else {
            const statsA = a.statsTemporada[0]?.puntos || 0; 
            const statsB = b.statsTemporada[0]?.puntos || 0;
            return statsB - statsA; 
        }
    });

    const N = equiposOrdenados.length;
    
    let OBJETIVO = 32;
    if (N < 32) OBJETIVO = 16;

    if (N > OBJETIVO) {
        const numParaEliminar = N - OBJETIVO;
        const numEquiposEnPrevia = numParaEliminar * 2;
        
        const participantesPrevia = equiposOrdenados.slice(N - numEquiposEnPrevia);
        
        let partidosParaInsertar = [];
        const numSemana = SEMANAS_COPA[0]; 
        let fechaBaseRonda = new Date(anioInicio, 8, 15);
        fechaBaseRonda.setDate(fechaBaseRonda.getDate() + (numSemana * 7));

        while(fechaBaseRonda.getDay() !== 5) {
            fechaBaseRonda.setDate(fechaBaseRonda.getDate() + 1);
        }

        const equiposSorteados = [...participantesPrevia].sort(() => Math.random() - 0.5);
        let enfrentamientos = [];
        for (let i = 0; i < equiposSorteados.length; i += 2) {
            if (equiposSorteados[i+1]) {
                enfrentamientos.push({ loc: equiposSorteados[i], vis: equiposSorteados[i+1] });
            }
        }
        enfrentamientos.sort(() => Math.random() - 0.5);

        for (let i = 0; i < enfrentamientos.length; i++) {
            const p = enfrentamientos[i];
            const fechaPartido = obtenerFechaRealista(fechaBaseRonda, 'copa', competicion.nombre, i, false, 0);
            partidosParaInsertar.push(crearObjeto(
                partidaId, 
                competicion._id, 
                0, 
                p.loc._id,
                p.vis._id, 
                fechaPartido, 
                'ELIMINATORIA'
            ));
        }

        await Partido.insertMany(partidosParaInsertar);
        console.log(`[${competicion.nombre}] Generados ${partidosParaInsertar.length} partidos.`);
    }
}

async function generarFaseSudamerica(partidaId, competicion, anioInicio) {
    const equiposConsultados = await Club.find({ partidaId, competiciones: competicion._id });
    let bolsaEquipos = [...equiposConsultados].sort(() => Math.random() - 0.5);

    let todosLosPartidosTemporales = []; 
    let fechaInicio = new Date(anioInicio, 8, 15);
    const letrasGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    while (fechaInicio.getDay() !== 1) fechaInicio.setDate(fechaInicio.getDate() + 1);

    for (let g = 0; g < 8; g++) {
        let grupo = [];
        let intentosGrupo = 0;
        let nombreGrupo = `Grupo ${letrasGrupos[g]}`;

        while (grupo.length < 4 && bolsaEquipos.length > 0) {
            const candidato = bolsaEquipos.pop();
            const yaHayPais = grupo.some(e => e.pais === candidato.pais);
            if (!yaHayPais|| intentosGrupo > 50) {
                grupo.push(candidato);
                intentosGrupo = 0;
            }
            else {
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

    todosLosPartidosTemporales.sort(() => Math.random() - 0.5);

    let listaFinal = [];
    const semanasCopa = [2, 5, 7, 10, 12, 13]

    for (let j = 1; j <= 6; j++) {
        let partidosDeLaJornada = todosLosPartidosTemporales.filter(p => p.jornada === j);

        if (j === 6) {
            partidosDeLaJornada.forEach((p, idx) => {
                let fechaJornada = new Date(fechaInicio);
                const offsetSemanas = semanasCopa[j - 1];
                fechaJornada.setDate(fechaInicio.getDate() + (offsetSemanas * 7));

                const indiceGrupo = Math.floor(idx / 2);

                const fechaPartido = obtenerFechaRealista(
                    new Date(fechaJornada), 
                    'internacional_america', 
                    competicion.nombre, 
                    indiceGrupo, 
                    true,
                    j
                );

                listaFinal.push(crearObjeto(
                    partidaId, competicion._id, p.jornada, p.local, p.visitante, fechaPartido, 'LIGA', null, p.grupo
                ));
            });
        } 
        else {
            partidosDeLaJornada.sort(() => Math.random() - 0.5);
            
            partidosDeLaJornada.forEach((p, idx) => {
                let fechaJornada = new Date(fechaInicio);
                const offsetSemanas = semanasCopa[j - 1];
                fechaJornada.setDate(fechaInicio.getDate() + (offsetSemanas * 7));

                const fechaPartido = obtenerFechaRealista(
                    new Date(fechaJornada), 
                    'internacional_america', 
                    competicion.nombre, 
                    idx, 
                    false,
                    j
                );

                listaFinal.push(crearObjeto(
                    partidaId, competicion._id, p.jornada, p.local, p.visitante, fechaPartido, 'LIGA', null, p.grupo
                ));
            });
        }
    }

    await Partido.insertMany(listaFinal);
    console.log(`[${competicion.nombre}] Generados ${listaFinal.length} partidos.`);
}

function esEnfrentamientoValido(hA, hB, bRivalIdx, bAIdx, limites, historial) {
    if (hA.id === hB.id) return false;
    if (hA.rivales.has(hB.id)) return false;
    if (hA.pais === hB.pais) return false;
    
    if (hA.cuposBombo[bRivalIdx] >= limites.porBombo) return false;
    if (hB.cuposBombo[bAIdx] >= limites.porBombo) return false;
    
    // Límite de 2 por país (Heurística rápida)
    let pA = 0, pB = 0;
    for (let rId of hA.rivales) if (historial[rId].pais === hB.pais) pA++;
    if (pA >= 2) return false;
    for (let rId of hB.rivales) if (historial[rId].pais === hA.pais) pB++;
    if (pB >= 2) return false;

    return true;
}


// El motor de Backtracking
function ejecutarSorteoRecursivo(historial, bombos, limites, control) {
    control.iteraciones++;
    if (control.iteraciones > 5000) return false; 

    const equipos = Object.values(historial);
    const numBombos = bombos.length;
    const totalRivales = numBombos * limites.porBombo;
    
    // Buscar equipos que aun necesiten partidos
    const equiposIncompletos = equipos
    .filter(e => e.rivales.size < totalRivales)
    .sort((a, b) => {
        const contarPais = (p) => equipos.filter(e => e.pais === p).length;
        return contarPais(b.pais) - contarPais(a.pais) || b.rivales.size - a.rivales.size;
    });

    if (equiposIncompletos.length === 0) return true; 

    const hA = equiposIncompletos[0]; 
    const bAIdx = hA.bomboPertenece;

    // Buscar en que bombo le faltan rivales
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
        hA.rivales.add(hB.id);
        hB.rivales.add(hA.id);
        hA.cuposBombo[bRivalIdx]++;
        hB.cuposBombo[bAIdx]++;

        if (ejecutarSorteoRecursivo(historial, bombos, limites, control)) return true;

        // BACKTRACK
        hA.rivales.delete(hB.id);
        hB.rivales.delete(hA.id);
        hA.cuposBombo[bRivalIdx]--;
        hB.cuposBombo[bAIdx]--;
    }
    return false;
}

function equilibrarLocalias(historial, limites) {
    const equipos = Object.values(historial);
    if (!equipos || equipos.length === 0 || !equipos[0].cuposBombo) {
        return [];
    }
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
        const hA = historial[a];
        const hB = historial[b];
        const bA = hA.bomboPertenece;
        const bB = hB.bomboPertenece;

        let local, visita;

        const aPuedeL = balance[a].totalL < maxL && balance[a].porBombo[bB].L < (limites.porBombo / 2);
        const bPuedeV = balance[b].totalV < maxL && balance[b].porBombo[bA].V < (limites.porBombo / 2);

        if (aPuedeL && bPuedeV) {
            local = a; visita = b;
        } else {
            local = b; visita = a;
        }

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
    
    const partidosPorJornada = {};
    for (const p of partidosConJornada) {
        if (!partidosPorJornada[p.jornada]) partidosPorJornada[p.jornada] = [];
        partidosPorJornada[p.jornada].push(p);
    }

    const calendarios = {
        ucl: [0, 2, 5, 7, 10, 12, 18, 19], 
        uel: [1, 2, 5, 7, 10, 12, 18, 19],
        uec: [2, 5, 7, 10, 12, 13]
    };

    let miCalendario = calendarios.uec;
    if (nombre.includes('champions')) miCalendario = calendarios.ucl;
    else if (nombre.includes('europa')) miCalendario = calendarios.uel;

    const maxJ = nombre.includes('conference') ? 6 : 8;
    let fechaBaseSept = new Date(anio, 8, 15);
    while (fechaBaseSept.getDay() !== 1) fechaBaseSept.setDate(fechaBaseSept.getDate() + 1);

    Object.keys(partidosPorJornada).forEach(numJornada => {
        const j = parseInt(numJornada);
        const partidos = partidosPorJornada[j];

        partidos.sort(() => Math.random() - 0.5);

        partidos.forEach((p, idxEnJornada) => {
            const offset = miCalendario[j - 1] !== undefined ? miCalendario[j - 1] : (j * 2);
            let fechaLunes = new Date(fechaBaseSept);
            fechaLunes.setDate(fechaBaseSept.getDate() + (offset * 7));

            const fechaFinal = obtenerFechaRealista(fechaLunes, 'internacional_europa', nombre, idxEnJornada, j === maxJ, j);

            resultadoFinal.push({
                partidaId: partidaId,
                competicionId: competicion._id,
                jornada: j,
                equipoLocal: p.loc,
                equipoVisitante: p.vis,
                fecha: fechaFinal,
                tipo: 'LIGA' 
            });
        });
    });

    return resultadoFinal;
}

async function generarFaseEuropa(partidaId, competicion, anioInicio, campeonesVigentes) {
    const nombreComp = competicion.nombre.toLowerCase();
    const esChampions = nombreComp.includes('champions');
    const esEuropa = nombreComp.includes('europa');
    const esConference = nombreComp.includes('conference');

    const numBombos = esConference ? 6 : 4;
    const jornadasTotales = esConference ? 6 : 8;
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

    const historial = {};
    bombos.forEach((bombo, bIdx) => {
        bombo.forEach(e => {
            historial[e._id.toString()] = {
                id: e._id.toString(),
                pais: e.pais,
                bomboPertenece: bIdx,
                rivales: new Set(),
                cuposBombo: Array.from({ length: numBombos }, () => ({ total: 0, L: 0, V: 0 })),
                partidosReferencia: []
            };
        });
    });

    let exito = false;
    let historialFinal = null;
    let intentosGlobales = 0;

    while (!exito && intentosGlobales < 1000) {
        intentosGlobales++;
        let hIntento = {};
        bombos.forEach((b, idx) => b.forEach(e => {
            hIntento[e._id.toString()] = {
                id: e._id.toString(), pais: e.pais, bomboPertenece: idx,
                rivales: new Set(),
                cuposBombo: new Array(numBombos).fill(0)
            };
        }));

        if (ejecutarSorteoRecursivo(hIntento, bombos, limites, { iteraciones: 0 })) {
            historialFinal = hIntento;
            exito = true;
        }
    }

    if (exito && historialFinal) {
        const partidosFinales = equilibrarLocalias(historialFinal, limites);
        const equiposSimplificados = Object.values(historialFinal).map(e => ({ 
            id: e.id, 
            pais: e.pais 
        }));
        
        try {
            const partidosConJornada = await llamarOrTools(equiposSimplificados, partidosFinales);
            
            if (partidosConJornada && partidosConJornada.length > 0) {
                const partidosDB = asignarJornadas(partidosConJornada, competicion, anioInicio, partidaId);
                
                if (partidosDB.length > 0) {
                    await Partido.insertMany(partidosDB);
                    console.log(`[${competicion.nombre}] ${partidosDB.length} partidos generados con OR-Tools.`);
                }
            } else {
                console.error(`[${competicion.nombre}] OR-Tools no pudo encontrar una solución de calendario.`);
            }
        } catch (error) {
            console.error(`[${competicion.nombre}] Error en el puente con Python:`, error);
        }
    } else {
        console.error(`[${competicion.nombre}] No se pudo generar un sorteo válido tras varios intentos.`);
    }
}

//ESTAS FUNCIONES DE AQUI PARA ABAJO NO SE SI ESTAN DEL TODO BIEN, HAY QUE COMPROBAR CUANDO SE TENGA LA LOGICA DE SIMULACION
// OJO CON LAS FECHAS
//ESTA FUNCION ES SOLO PARA LOS DIECISEISAVOS
async function generarDieciseisavosEuropa(partidaId, competicion, tablaPosiciones, fechaUltimaJornada) {
    const bloquesPlayoff = [
        { nombre: 'A', cabezas: [tablaPosiciones[8], tablaPosiciones[9]], rivales: [tablaPosiciones[22], tablaPosiciones[23]] }, // (9-10) vs (23-24)
        { nombre: 'B', cabezas: [tablaPosiciones[10], tablaPosiciones[11]], rivales: [tablaPosiciones[20], tablaPosiciones[21]] }, // (11-12) vs (21-22)
        { nombre: 'C', cabezas: [tablaPosiciones[12], tablaPosiciones[13]], rivales: [tablaPosiciones[18], tablaPosiciones[19]] }, // (13-14) vs (19-20)
        { nombre: 'D', cabezas: [tablaPosiciones[14], tablaPosiciones[15]], rivales: [tablaPosiciones[16], tablaPosiciones[17]] }  // (15-16) vs (17-18)
    ];
    
    let partidosParaInsertar = [];
    let fechaBase = new Date(fechaUltimaJornada);

    bloquesPlayoff.forEach((bloque, bloqueIdx) => {
        let cabezasMezclados = [...bloque.cabezas].sort(() => Math.random() - 0.5);
        let rivalesMezclados = [...bloque.rivales].sort(() => Math.random() - 0.5);

        for (let i = 0; i < 2; i++) {
            const cabeza = cabezasMezclados[i];
            const rival = rivalesMezclados[i];
            const fechaIda = obtenerFechaRealista(fechaBase, 'internacional_europa', competicion.nombre, i + bloqueIdx * 2, false, 9);
            const llaveId = `${bloque.nombre}${i + 1}`;
            // IDA: El peor juega primero en casa
            partidosParaInsertar.push(crearObjeto(
                partidaId, 
                competicion._id, 
                'PLAYOFF_IDA', 
                rival.clubId, 
                cabeza.clubId, 
                fechaIda, 
                'ELIMINATORIA',
                llaveId
            ));

            // VUELTA: El mejor cierra en casa
            let fechaVuelta = new Date(fechaIda);
            fechaVuelta.setDate(fechaVuelta.getDate() + 7);
            partidosParaInsertar.push(crearObjeto(
                partidaId, 
                competicion._id, 
                'PLAYOFF_VUELTA', 
                cabeza.clubId, 
                rival.clubId, 
                fechaVuelta, 
                'ELIMINATORIA',
                llaveId
            ));
        }
    });

    await Partido.insertMany(partidosParaInsertar);
}

//ESTA ES PARA GENERAR LOS EMPAREJAMIENTOS DE OCTAVOS
async function generarOctavosEuropa(partidaId, competicion, tablaPosiciones, ganadoresPlayoff, fechaUltimaJornada) {
    // ganadoresPlayoff es un objeto: { 'A1': id, 'A2': id, 'B1': id, ... }
    let partidosParaInsertar = [];
    let fechaBase = new Date(fechaUltimaJornada);

    const rutas = [
        { bloqueCerrado: [0, 1], llavesPO: ['D1', 'D2'], idRuta: 'R1' }, // 1º/2º vs Ganadores Bloque D
        { bloqueCerrado: [2, 3], llavesPO: ['C1', 'C2'], idRuta: 'R2' }, // 3º/4º vs Ganadores Bloque C
        { bloqueCerrado: [4, 5], llavesPO: ['B1', 'B2'], idRuta: 'R3' }, // 5º/6º vs Ganadores Bloque B
        { bloqueCerrado: [6, 7], llavesPO: ['A1', 'A2'], idRuta: 'R4' }  // 7º/8º vs Ganadores Bloque A
    ];

    rutas.forEach((ruta) => {
        let cabezas = [tablaPosiciones[ruta.bloqueCerrado[0]], tablaPosiciones[ruta.bloqueCerrado[1]]].sort(() => Math.random() - 0.5);
        let rivales = [ganadoresPlayoff[ruta.llavesPO[0]], ganadoresPlayoff[ruta.llavesPO[1]]].sort(() => Math.random() - 0.5);

        for (let i = 0; i < 2; i++) {
            const cabeza = cabezas[i];
            const rivalId = rivales[i];
            const subRutaId = `${ruta.idRuta}_${i + 1}`;

            const fechaIda = obtenerFechaRealista(fechaBase, 'internacional_europa', competicion.nombre, i, false, 11);
            
            partidosParaInsertar.push(crearObjeto(
                partidaId, 
                competicion._id, 
                'OCTAVOS_IDA', 
                rivalId, 
                cabeza.clubId, 
                fechaIda, 
                'ELIMINATORIA', 
                subRutaId
            ));

            let fechaVuelta = new Date(fechaIda);
            fechaVuelta.setDate(fechaVuelta.getDate() + 7);
            partidosParaInsertar.push(crearObjeto(
                partidaId, 
                competicion._id, 
                'OCTAVOS_VUELTA', 
                cabeza.clubId, 
                rivalId, 
                fechaVuelta, 
                'ELIMINATORIA', 
                subRutaId
            ));
        }
    });

    await Partido.insertMany(partidosParaInsertar);
}

//ESTA ES YA PARA EL RESTO DE RONDAS CON EL CUADRO FINAL YA DEFINIDO
async function generarCuadroFinalEuropa(partidaId, competicion, ganadoresRondaAnterior, faseNombre, fechaBase) {
    let partidosParaInsertar = [];
    let emparejamientos = [];

    if (faseNombre === 'CUARTOS') {
        // ganadoresRondaAnterior viene indexado por R1_1, R1_2, etc. (de los Octavos)
        emparejamientos = [
            { t1: ganadoresRondaAnterior['R1_1'], t2: ganadoresRondaAnterior['R4_1'], ruta: 'SEM_1' },
            { t1: ganadoresRondaAnterior['R1_2'], t2: ganadoresRondaAnterior['R4_2'], ruta: 'SEM_1' },
            { t1: ganadoresRondaAnterior['R2_1'], t2: ganadoresRondaAnterior['R3_1'], ruta: 'SEM_2' },
            { t1: ganadoresRondaAnterior['R2_2'], t2: ganadoresRondaAnterior['R3_2'], ruta: 'SEM_2' }
        ];
    } else if (faseNombre === 'SEMIFINAL') {
        // ganadoresRondaAnterior viene como { 'SEM_1': [id, id], 'SEM_2': [id, id] }
        Object.keys(ganadoresRondaAnterior).forEach((rutaId) => {
            const equipos = ganadoresRondaAnterior[rutaId].sort(() => Math.random() - 0.5);
            emparejamientos.push({ 
                t1: equipos[0], 
                t2: equipos[1], 
                ruta: 'FINAL'
            });
        });
    } else if (faseNombre === 'FINAL') {
        return await Partido.create(crearObjeto(
            partidaId, competicion._id, 'FINAL', 
            ganadoresRondaAnterior[0], ganadoresRondaAnterior[1], fechaBase, 'FINAL_UNICA'
        ));
    }

    emparejamientos.forEach((cruce, i) => {
        const numJornada = faseNombre === 'CUARTOS' ? 13 : (faseNombre === 'SEMIFINAL' ? 15 : 17);
        const fechaIda = obtenerFechaRealista(fechaBase, 'internacional_europa', competicion.nombre, i, numJornada);
        partidosParaInsertar.push(crearObjeto(
            partidaId, 
            competicion._id, 
            `${faseNombre}_IDA`, 
            cruce.t2, 
            cruce.t1, 
            fechaIda, 
            'ELIMINATORIA',
            cruce.ruta
        ));
        
        let fechaVuelta = new Date(fechaIda);
        fechaVuelta.setDate(fechaVuelta.getDate() + 7);
        partidosParaInsertar.push(crearObjeto(
            partidaId, 
            competicion._id, 
            `${faseNombre}_VUELTA`, 
            cruce.t1, 
            cruce.t2, 
            fechaVuelta, 
            'ELIMINATORIA', 
            cruce.ruta
        ));
    });

    await Partido.insertMany(partidosParaInsertar);
}

//ESTA ES PARA CREAR COMO UNOS DIECISEISAVOS QUE ENFRENTA LOS 3 DE LIBERTADORES CONTRAS LOS 2 DE SUDAMERICANA
async function generarPlayoffsSudamericana(partidaId, compSudamericanaId, resultadosLib, resultadosSud, fechaUltimaJornada) {

    let partidos = [];
    let fechaBase = new Date(fechaUltimaJornada);

   
    const bombosSud = [...resultadosSud].sort(() => Math.random() - 0.5);
    const bombosLib = [...resultadosLib].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 8; i++) {
        const localId = bombosSud[i].clubId;
        const visitanteId = bombosLib[i].clubId;

        const llaveId = `PO_SUD_${i + 1}`;
        const fechaIda = obtenerFechaRealista(fechaBase, 'internacional_america', 'sudamericana', i);
        
        // Ida y Vuelta
        partidos.push(crearObjeto(
            partidaId, 
            compSudamericanaId, 
            'PO_IDA', 
            localId, 
            visitanteId, 
            fechaIda, 
            'ELIMINATORIA',
            llaveId
        ));
        
        let fechaVuelta = new Date(fechaIda);
        fechaVuelta.setDate(fechaVuelta.getDate() + 7);
        partidos.push(crearObjeto(
            partidaId, 
            compSudamericanaId, 
            'PO_VUELTA', 
            visitanteId, 
            localId, 
            fechaVuelta, 
            'ELIMINATORIA',
            llaveId
        ));
    }

    await Partido.insertMany(partidos);
}

//ESTA ES YA CUANDO HAN ACABDO LOS "DIECISEISAVOS" HACER LAS SIGUIENTES RONDAS QUE ES IGUAL PARA LIBERTADORES COMO PARA SUDAMERICANA
async function generarRondaEliminatoriaSudamerica(partidaId, competicionId, equiposGanadores, jornadaNombre, fechaBase) {
    let partidos = [];
    
    let bolsa = [...equiposGanadores].sort(() => Math.random() - 0.5);

    if (jornadaNombre.toUpperCase() === 'FINAL') {
        partidos.push(crearObjeto(
            partidaId, 
            competicionId, 
            'FINAL', 
            bolsa[0], 
            bolsa[1], 
            fechaBase, 
            'FINAL_UNICA'
        ));
    } 
    else {
        for (let i = 0; i < bolsa.length; i += 2) {
            if (bolsa[i+1]) {
                const fechaIda = obtenerFechaRealista(fechaBase, 'internacional_america', '', i/2);
                
                partidos.push(crearObjeto(
                    partidaId, 
                    competicionId, 
                    `${jornadaNombre}_IDA`, 
                    bolsa[i], 
                    bolsa[i+1], 
                    fechaIda, 
                    'ELIMINATORIA'
                ));

                let fechaVuelta = new Date(fechaIda);
                fechaVuelta.setDate(fechaVuelta.getDate() + 7);
                partidos.push(crearObjeto(
                    partidaId, 
                    competicionId, 
                    `${jornadaNombre}_VUELTA`, 
                    bolsa[i+1], 
                    bolsa[i], 
                    fechaVuelta, 
                    'ELIMINATORIA'
                ));
            }
        }
    }

    await Partido.insertMany(partidos);
}
/*IGUAL HAY QUE BORRARLO
async function obtenerSiguienteSemanaLibre(partidaId, fechaReferencia) {
    let fechaBusqueda = new Date(fechaReferencia);
    let encontrada = false;

    while (!encontrada) {
        fechaBusqueda.setDate(fechaBusqueda.getDate() + 7);
        
        const inicioSemana = new Date(fechaBusqueda);
        const dia = inicioSemana.getDay();
        const diff = inicioSemana.getDate() - dia + (dia === 0 ? -6 : 1);
        inicioSemana.setDate(diff);
        inicioSemana.setHours(0, 0, 0, 0);

        const finSemana = new Date(inicioSemana);
        finSemana.setDate(finSemana.getDate() + 4); 
        finSemana.setHours(23, 59, 59, 999);

        const conflictoInternacional = await Partido.findOne({
            partidaId,
            fecha: { $gte: inicioSemana, $lte: finSemana },
            tipo: { $in: ['LIGA', 'ELIMINATORIA'] }, 
            competicionId: { $in: await obtenerIdsInternacionales() } 
        });

        if (!conflictoInternacional) {
            encontrada = true;
        }
    }
    return fechaBusqueda;
}

// Función auxiliar para identificar qué IDs corresponden a competiciones internacionales
async function obtenerIdsInternacionales() {
    const comps = await Competicion.find({ 
        tipo: { $in: ['internacional_europa', 'internacional_america'] } 
    }).select('_id');
    return comps.map(c => c._id);
}*/

//ESTA ES PARA LAS RONDAD DE COPA
//INTENTAR CUADRAR LAS FECHAS PARA QUE SEA ENTRE MEDIADOS DE DICIEMBRE Y MEDIADOS DE ENERO QUE ES EL PARON DE EUROPA
async function generarSiguienteRondaCopa(partidaId, competicion, equiposGanadores, jornadaNombre, fechaUltimaJornada, numJornada) {
    const numSemana = SEMANAS_COPA[rondaActual];
    let bolsa = [...equiposGanadores].sort(() => Math.random() - 0.5);
    let partidos = [];
    const fechaBase = new Date(anioInicio, 7, 16);
    fechaBase.setDate(fechaBase.getDate() + (numSemana * 7));

    const nombreComp = competicion.nombre.toLowerCase();
    const esSemifinal = jornadaNombre.toLowerCase().includes('semifinal');
    const esFinal = jornadaNombre.toLowerCase().includes('final') && !esSemifinal;

    let tieneVuelta = false;
    if (esSemifinal) {
        // Países con Semis a doble partido
        const paisesDobleSemi = ['españa', 'italia', 'portugal', 'paises bajos', 'brasil'];
        tieneVuelta = paisesDobleSemi.some(p => nombreComp.includes(p));
    } else if (esFinal) {
        // Brasil tiene la final a doble partido
        tieneVuelta = nombreComp.includes('brasil');
    }
    const semanasIntervalo = (esSemifinal && !nombreComp.includes('brasil')) ? 3 : 1;

    for (let i = 0; i < bolsa.length; i += 2) {
        if (bolsa[i+1]) {
            const fechaIda = obtenerFechaRealista(fechaBase, 'copa', competicion.nombre, i/2, numJornada);
            const nombreJornadaIda = esSemifinal ? `${jornadaNombre}_IDA` : jornadaNombre;

            partidos.push(crearObjeto(
                partidaId, 
                competicion._id, 
                nombreJornadaIda, 
                bolsa[i], 
                bolsa[i+1], 
                fechaIda, 
                tieneVuelta ? 'ELIMINATORIA' : 'FINAL'
            ));

            if (tieneVuelta) {
                let fechaVuelta = new Date(fechaIda);
                fechaVuelta.setDate(fechaVuelta.getDate() + (semanasIntervalo * 7));

                partidos.push(crearObjeto(
                    partidaId, 
                    competicion._id, 
                    `${jornadaNombre}_VUELTA`, 
                    bolsa[i+1], 
                    bolsa[i], 
                    fechaVuelta, 
                    'ELIMINATORIA'
                ));
            }
        }
    }
    await Partido.insertMany(partidos);
}

//ESTA ES FUNCION AUXILIAR PARA CREAR EL PARTIDO (ESTA SI QUE ESTA BIEN SEGURO)
function crearObjeto(partidaId, compId, jornada, localId, visitanteId, fecha, tipo, llave = null, grupo = null) {
    return {
        partidaId,
        competicionId: compId,
        tipo: tipo,
        jornada: jornada,
        equipoLocal: localId,
        equipoVisitante: visitanteId,
        fecha: new Date(fecha),
        jugado: false,
        llave: llave,
        grupo: grupo
    };
}
module.exports = generarCalendario;