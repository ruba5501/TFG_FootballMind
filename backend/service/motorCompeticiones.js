const Partido = require('../models/partido'); 
const Competicion = require('../models/competicion'); 
const Club = require('../models/club');
const calendarioService = require('./generarCalendario'); 

async function verificarYGenerarSiguienteRonda(partidaId, fechaSimulada) {
    try {
        const inicioDia = new Date(fechaSimulada); inicioDia.setHours(0,0,0,0);
        const finDia = new Date(fechaSimulada); finDia.setHours(23,59,59,999);

        const totalPartidosHoy = await Partido.countDocuments({ 
            partidaId, 
            fecha: { $gte: inicioDia, $lte: finDia } 
        });
        if (totalPartidosHoy === 0) return;
        
        const competicionesDelDia = await Partido.distinct('competicionId', {
            partidaId,
            fecha: { $gte: inicioDia, $lte: finDia }
        });

        for (const compId of competicionesDelDia) {
            const partidoMuestra = await Partido.findOne({
                partidaId,
                competicionId: compId,
                fecha: { $gte: inicioDia, $lte: finDia }
            });

            if (!partidoMuestra) continue;
            
            const jornadaActual = partidoMuestra.jornada; 
            const tipoActual = partidoMuestra.tipo;      

            const pendientes = await Partido.countDocuments({
                partidaId,
                competicionId: compId,
                jornada: jornadaActual,
                jugado: false
            });

            if (pendientes > 0) {
                //console.log(`[MOTOR] Quedan ${pendientes} partidos pendientes en la competición ${compId} (Jornada ${jornadaActual}).`);
                continue; 
            }

            const competicion = await Competicion.findById(compId);
            if (!competicion) {
                console.error(`[CRÍTICO] No se encontró la competición con ID: ${compId}`);
                continue;
            }

            const nombreComp = competicion.nombre.toLowerCase();
            const partidosDeLaFase = await Partido.find({ partidaId, competicionId: compId, jornada: jornadaActual });

            // --- 1. BLOQUE INTERNACIONAL EUROPA ---
            if ((nombreComp.includes('europa') || nombreComp.includes('champions') || nombreComp.includes('conference')) 
                && !nombreComp.includes('championship')) {
                const ultimaJornadaLiga = nombreComp.includes('conference') ? 6 : 8;

                if (tipoActual === 'LIGA' && jornadaActual === ultimaJornadaLiga) {
                    const tablaPosiciones = await obtenerTablaPosicionesFormatoLiga(partidaId, compId);
                    await calendarioService.generarDieciseisavosEuropa(partidaId, competicion, tablaPosiciones, fechaSimulada);
                } 
                else if (tipoActual === 'ELIMINATORIA' && jornadaActual === 10) {
                    const ganadoresPlayoff = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, 9);
                    const tablaPosiciones = await obtenerTablaPosicionesFormatoLiga(partidaId, compId);
                    await calendarioService.generarOctavosEuropa(partidaId, competicion, tablaPosiciones, ganadoresPlayoff, fechaSimulada);
                } 
                else if (tipoActual === 'ELIMINATORIA' && jornadaActual === 12) {
                    const ganadoresOctavos = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, 11);
                    await calendarioService.generarCuadroFinalEuropa(partidaId, competicion, ganadoresOctavos, 'CUARTOS', fechaSimulada);
                } 
                else if (tipoActual === 'ELIMINATORIA' && jornadaActual === 14) {
                    const ganadoresCuartos = await calcularGanadoresAgrupadosPorRuta(partidaId, partidosDeLaFase, 13);
                    await calendarioService.generarCuadroFinalEuropa(partidaId, competicion, ganadoresCuartos, 'SEMIFINAL', fechaSimulada);
                } 
                else if (tipoActual === 'ELIMINATORIA' && jornadaActual === 16) {
                    const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, true, 15);
                    await calendarioService.generarCuadroFinalEuropa(partidaId, competicion, finalistas, 'FINAL', fechaSimulada);
                }
            }
            
            // --- 2. BLOQUE COPAS NACIONALES ---
            else if (tipoActual === 'ELIMINATORIA' && !nombreComp.includes('libertadores') && !nombreComp.includes('sudamericana')) {
                
                // CASO A: FIN DE LA RONDA PREVIA (Jornada 0)
                if (jornadaActual === 0) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Ronda Previa. Calculando siguiente fase...`);
                    const ganadoresPrevios = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    
                    const equiposQueYaJugaron = new Set(partidosDeLaFase.flatMap(p => [p.equipoLocal?.toString(), p.equipoVisitante?.toString()].filter(Boolean)));
                    const todosLosClubes = await Club.find({ partidaId, competiciones: compId, esFilial: false });
                    const equiposExentos = todosLosClubes
                        .map(c => c._id.toString())
                        .filter(id => !equiposQueYaJugaron.has(id));

                    const bolsaCompleta = [...ganadoresPrevios, ...equiposExentos];
                    const totalEquipos = bolsaCompleta.length;

                    // Decidir dinámicamente la ronda según el tamaño de la bolsa
                    let nombreSiguienteRonda = '1/16 de Final';
                    let siguienteJornadaNum = 1;

                    if (totalEquipos === 16) {
                        nombreSiguienteRonda = 'Octavos de Final';
                        siguienteJornadaNum = 2; // Saltamos directamente a la jornada de octavos
                    } else if (totalEquipos === 8) {
                        nombreSiguienteRonda = 'Cuartos de Final';
                        siguienteJornadaNum = 3; // Saltamos directamente a cuartos
                    }

                    console.log(`[MOTOR] Bolsa con ${totalEquipos} equipos. Generando: ${nombreSiguienteRonda} (Jornada ${siguienteJornadaNum})`);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, bolsaCompleta, nombreSiguienteRonda, fechaSimulada, siguienteJornadaNum);
                }
                
                // CASO B: RONDAS INTERMEDIAS AVANZANZANDO POR PASOS
                else if (jornadaActual >= 1 && jornadaActual <= 3) {
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    const proximasRondas = {
                        1: { nombre: 'Octavos de Final', num: 2 },
                        2: { nombre: 'Cuartos de Final', num: 3 },
                        3: { nombre: 'Semifinal', num: 4 }
                    };

                    const siguiente = proximasRondas[jornadaActual];
                    console.log(`[MOTOR - ${competicion.nombre}] Avanzando a ${siguiente.nombre}...`);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, siguiente.nombre, fechaSimulada, siguiente.num);
                } 
                
                // CASO C: SEMIFINALES Y FINALES (Mantiene tu lógica de ida/vuelta)
                else if (jornadaActual === 4 || jornadaActual === 5) {
                    const copasConDobleSemi = ['copa del rey', 'coppa italia', 'taça de portugal', 'knvb beker', 'copa do brasil'];
                    const tieneVuelta = copasConDobleSemi.includes(nombreComp);

                    if (tieneVuelta) {
                        if (jornadaActual === 4) {
                            console.log(`[MOTOR - ${competicion.nombre}] Terminó Semifinal (Ida). Esperando a la Vuelta (Jornada 5)...`);
                        } else if (jornadaActual === 5) {
                            console.log(`[MOTOR - ${competicion.nombre}] Fin de Semifinales (Vuelta). Generando Gran Final...`);
                            const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, true, 4);
                            await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, finalistas, 'Gran Final', fechaSimulada, 6);
                        }
                    } else {
                        if (jornadaActual === 4) {
                            console.log(`[MOTOR - ${competicion.nombre}] Fin de Semifinales (Única). Generando Gran Final...`);
                            const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                            await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, finalistas, 'Gran Final', fechaSimulada, 6);
                        }
                    }
                }
                else if (jornadaActual === 6) {
                    console.log(`[MOTOR - ${competicion.nombre}] ¡La gran final ha concluido!`);
                }
            }

            // --- 3. BLOQUE SUDAMÉRICA ---
            else if (nombreComp.includes('libertadores') || nombreComp.includes('sudamericana')) {
                
                if (tipoActual === 'LIGA' && jornadaActual === 6) {
                    console.log(`[MOTOR - Conmebol] Fin de Fase de Grupos para la competición actual.`);
                    
                    // Aseguramos obtener las tablas de la competición actual en curso para evitar cruces vacíos indirectos
                    const compLibertadores = await Competicion.findOne({ partidaId, nombre: /libertadores/i });
                    const compSudamericana = await Competicion.findOne({ partidaId, nombre: /sudamericana/i });

                    if (!compLibertadores || !compSudamericana) {
                        console.error("[MOTOR - Conmebol] Error: No se encuentra una de las dos competiciones Conmebol en la base de datos.");
                        continue;
                    }

                    // IMPORTANTE: Verificar si AMBAS competiciones terminaron su jornada de grupos antes de cruzarlas
                    const pendLib = await Partido.countDocuments({ partidaId, competicionId: compLibertadores._id, jornada: 6, jugado: false });
                    const pendSud = await Partido.countDocuments({ partidaId, competicionId: compSudamericana._id, jornada: 6, jugado: false });

                    if (pendLib > 0 || pendSud > 0) {
                        console.log(`[MOTOR - Conmebol] Esperando a que ambas competiciones terminen la Jornada 6 (Libertadores Pendientes: ${pendLib}, Sudamericana Pendientes: ${pendSud})`);
                        continue;
                    }

                    const tablasLib = await obtenerTablasPosicionesGruposSudamerica(partidaId, compLibertadores._id);
                    const tablasSud = await obtenerTablasPosicionesGruposSudamerica(partidaId, compSudamericana._id);
                    
                    let primerosLib = [], segundosLib = [], tercerosLib = [];
                    let segundosSud = [];

                    Object.values(tablasLib).forEach(grupo => {
                        if(grupo[0]) primerosLib.push(grupo[0]);
                        if(grupo[1]) segundosLib.push(grupo[1]);
                        if(grupo[2]) tercerosLib.push(grupo[2]); 
                    });

                    Object.values(tablasSud).forEach(grupo => {
                        if(grupo[1]) segundosSud.push(grupo[1]); 
                    });

                    if (nombreComp.includes('sudamericana')) {
                        await calendarioService.generarPlayoffsSudamericana(
                            partidaId, 
                            competicion._id, 
                            competicion.nombre, 
                            tercerosLib.map(e => e.clubId?.toString() || e.toString()), 
                            segundosSud.map(e => e.clubId?.toString() || e.toString()), 
                            fechaSimulada
                        );
                    } else {
                        const bolsaOctavosLib = [...primerosLib, ...segundosLib].map(e => e.clubId?.toString() || e.toString());
                        
                        await calendarioService.generarRondaEliminatoriaSudamerica(
                            partidaId,
                            competicion,
                            bolsaOctavosLib,
                            'OCTAVOS',
                            fechaSimulada,
                            7 
                        );
                    }
                }
                
                else if (tipoActual === 'ELIMINATORIA') {
                    
                    if (jornadaActual === 10 && nombreComp.includes('sudamericana')) {
                        console.log(`[MOTOR - Sudamericana] Fin de Play-offs. Generando Octavos...`);
                        const ganadoresPlayoff = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, 9);
                        
                        const compSudamericana = await Competicion.findOne({ partidaId, nombre: /sudamericana/i });
                        const tablasSud = await obtenerTablasPosicionesGruposSudamerica(partidaId, compSudamericana._id);
                        let primerosSud = [];
                        Object.values(tablasSud).forEach(grupo => { 
                            if(grupo[0]) primerosSud.push(grupo[0].clubId?.toString() || grupo[0].toString()); 
                        });

                        const arrGanadoresPlayoff = Object.values(ganadoresPlayoff);
                        const bolsaOctavosSud = [...arrGanadoresPlayoff, ...primerosSud];

                        await calendarioService.generarRondaEliminatoriaSudamerica(
                            partidaId,
                            competicion,
                            bolsaOctavosSud,
                            'OCTAVOS',
                            fechaSimulada,
                            11
                        );
                    }
                    
                    else if ((jornadaActual === 8 && nombreComp.includes('libertadores')) || (jornadaActual === 12 && nombreComp.includes('sudamericana'))) {
                        const jornadaIda = jornadaActual - 1;
                        console.log(`[MOTOR - ${competicion.nombre}] Fin de Octavos de Final. Generando Cuartos...`);
                        
                        const ganadoresOctavosObj = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, jornadaIda);
                        const ganadoresOctavos = Object.values(ganadoresOctavosObj);

                        await calendarioService.generarRondaEliminatoriaSudamerica(
                            partidaId,
                            competicion,
                            ganadoresOctavos,
                            'CUARTOS',
                            fechaSimulada,
                            jornadaActual + 1 
                        );
                    }
                    
                    else if ((jornadaActual === 10 && nombreComp.includes('libertadores')) || (jornadaActual === 14 && nombreComp.includes('sudamericana'))) {
                        const jornadaIda = jornadaActual - 1;
                        console.log(`[MOTOR - ${competicion.nombre}] Fin de Cuartos de Final. Generando Semifinales...`);
                        
                        const ganadoresCuartosObj = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, jornadaIda);
                        const ganadoresCuartos = Object.values(ganadoresCuartosObj);
                        
                        await calendarioService.generarRondaEliminatoriaSudamerica(
                            partidaId,
                            competicion,
                            ganadoresCuartos,
                            'SEMIFINAL',
                            fechaSimulada,
                            jornadaActual + 1 
                        );
                    }
                    
                    else if ((jornadaActual === 12 && nombreComp.includes('libertadores')) || (jornadaActual === 16 && nombreComp.includes('sudamericana'))) {
                        const jornadaIda = jornadaActual - 1;
                        console.log(`[MOTOR - ${competicion.nombre}] Fin de Semifinales. Generando Gran Final...`);
                        
                        const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, true, jornadaIda);
                        
                        await calendarioService.generarRondaEliminatoriaSudamerica(
                            partidaId,
                            competicion,
                            finalistas,
                            'FINAL',
                            fechaSimulada,
                            jornadaActual + 1 
                        );
                    }
                    
                    else if ((jornadaActual === 13 && nombreComp.includes('libertadores')) || (jornadaActual === 17 && nombreComp.includes('sudamericana'))) {
                        console.log(`[MOTOR - ${competicion.nombre}] ¡La competición Conmebol ha concluido!`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error en el motor de rondas:", error);
    }
}

// AUXILIARES
async function obtenerGanadoresGlobales(partidaId, partidosVuelta, esDoblePartido, jornadaIda = null) {
    let ganadores = [];

    for (const p of partidosVuelta) {
        if (!p || !p.equipoLocal || !p.equipoVisitante) {
            console.warn(`[ADVERTENCIA] Partido omitido por datos incompletos (ID: ${p?._id})`);
            continue;
        }

        if (!esDoblePartido) {
            // PARTIDO ÚNICO
            if (p.golesLocal > p.golesVisitante) {
                ganadores.push(p.equipoLocal.toString());
            } else if (p.golesVisitante > p.golesLocal) {
                ganadores.push(p.equipoVisitante.toString());
            } else {
                if (p.ganadorPenaltis) {
                    ganadores.push(p.ganadorPenaltis.toString());
                } else {
                    console.error(`[CRÍTICO] Partido único empatado (ID: ${p._id}) sin ganadorPenaltis. Fallback al local.`);
                    ganadores.push(p.equipoLocal.toString());
                }
            }
        } else {
            // DOBLE PARTIDO (IDA Y VUELTA) - CORREGIDO POR ID
            const pIda = await Partido.findOne({
                partidaId,
                competicionId: p.competicionId,
                jornada: jornadaIda,
                llave: p.llave,
                _id: { $ne: p._id }
            });

            if (!pIda) {
                console.error(`[CRÍTICO] Falta partido de ida para llave ${p.llave}. No se puede computar global.`);
                continue;
            }

            const idEquipoA = p.equipoLocal.toString(); // El local en la vuelta (Aston Villa)
            const idEquipoB = p.equipoVisitante.toString(); // El visitante en la vuelta (Celta)

            // Goles de Equipo A (Local en la vuelta + sus goles como visitante en la ida)
            const golesIdaA = pIda.equipoLocal.toString() === idEquipoA ? (pIda.golesLocal || 0) : (pIda.golesVisitante || 0);
            const totalA = (p.golesLocal || 0) + golesIdaA;

            // Goles de Equipo B (Visitante en la vuelta + sus goles como local en la ida)
            const golesIdaB = pIda.equipoLocal.toString() === idEquipoB ? (pIda.golesLocal || 0) : (pIda.golesVisitante || 0);
            const totalB = (p.golesVisitante || 0) + golesIdaB;

            if (totalA > totalB) {
                ganadores.push(idEquipoA);
            } else if (totalB > totalA) {
                ganadores.push(idEquipoB);
            } else {
                if (p.ganadorPenaltis) {
                    ganadores.push(p.ganadorPenaltis.toString());
                } else {
                    console.error(`[CRÍTICO] Global empatado (Llave: ${p.llave}) sin ganadorPenaltis en la vuelta. Fallback al local.`);
                    ganadores.push(idEquipoA);
                }
            }
        }
    }
    return [...new Set(ganadores)];
}

async function calcularGanadoresDoblePartido(partidaId, partidosVuelta, jornadaIda) {
    let ganadoresLlaves = {};
    for (const pVuelta of partidosVuelta) {
        if (!pVuelta || !pVuelta.llave || !pVuelta.equipoLocal || !pVuelta.equipoVisitante) continue;

        const pIda = await Partido.findOne({
            partidaId,
            competicionId: pVuelta.competicionId,
            jornada: jornadaIda,
            llave: pVuelta.llave
        });

        if (!pIda) continue;

        const idEquipoA = pVuelta.equipoLocal.toString();
        const idEquipoB = pVuelta.equipoVisitante.toString();

        const golesIdaA = pIda.equipoLocal.toString() === idEquipoA ? (pIda.golesLocal || 0) : (pIda.golesVisitante || 0);
        const totalA = (pVuelta.golesLocal || 0) + golesIdaA;

        const golesIdaB = pIda.equipoLocal.toString() === idEquipoB ? (pIda.golesLocal || 0) : (pIda.golesVisitante || 0);
        const totalB = (pVuelta.golesVisitante || 0) + golesIdaB;

        if (totalA > totalB) {
            ganadoresLlaves[pVuelta.llave] = idEquipoA;
        } else if (totalB > totalA) {
            ganadoresLlaves[pVuelta.llave] = idEquipoB;
        } else {
            ganadoresLlaves[pVuelta.llave] = pVuelta.ganadorPenaltis ? pVuelta.ganadorPenaltis.toString() : idEquipoA;
        }
    }
    return ganadoresLlaves;
}

async function calcularGanadoresAgrupadosPorRuta(partidaId, partidosVuelta, jornadaIda) {
    let rutas = {};
    for (const pVuelta of partidosVuelta) {
        if (!pVuelta || !pVuelta.llave || !pVuelta.equipoLocal || !pVuelta.equipoVisitante) continue;

        const pIda = await Partido.findOne({
            partidaId,
            competicionId: pVuelta.competicionId,
            jornada: jornadaIda,
            llave: pVuelta.llave
        });

        if (!pIda) continue;

        const idEquipoA = pVuelta.equipoLocal.toString();
        const idEquipoB = pVuelta.equipoVisitante.toString();

        const golesIdaA = pIda.equipoLocal.toString() === idEquipoA ? (pIda.golesLocal || 0) : (pIda.golesVisitante || 0);
        const totalA = (pVuelta.golesLocal || 0) + golesIdaA;

        const golesIdaB = pIda.equipoLocal.toString() === idEquipoB ? (pIda.golesLocal || 0) : (pIda.golesVisitante || 0);
        const totalB = (pVuelta.golesVisitante || 0) + golesIdaB;
        
        let ganador;
        if (totalA > totalB) {
            ganador = idEquipoA;
        } else if (totalB > totalA) {
            ganador = idEquipoB;
        } else {
            ganador = pVuelta.ganadorPenaltis ? pVuelta.ganadorPenaltis.toString() : idEquipoA;
        }

        if (!rutas[pVuelta.llave]) {
            rutas[pVuelta.llave] = [];
        }
        rutas[pVuelta.llave].push(ganador);
    }
    return rutas;
}

async function obtenerTablaPosicionesFormatoLiga(partidaId, competicionId) {
    const partidos = await Partido.find({ partidaId, competicionId, tipo: "LIGA", jugado: true });
    let tabla = {};

    partidos.forEach(p => {
        if (!p.equipoLocal || !p.equipoVisitante) return;
        const loc = p.equipoLocal.toString();
        const vis = p.equipoVisitante.toString();

        if (!tabla[loc]) tabla[loc] = { clubId: p.equipoLocal, puntos: 0, gf: 0, gc: 0 };
        if (!tabla[vis]) tabla[vis] = { clubId: p.equipoVisitante, puntos: 0, gf: 0, gc: 0 };

        tabla[loc].gf += (p.golesLocal || 0); tabla[loc].gc += (p.golesVisitante || 0);
        tabla[vis].gf += (p.golesVisitante || 0); tabla[vis].gc += (p.golesLocal || 0);

        if (p.golesLocal > p.golesVisitante) tabla[loc].puntos += 3;
        else if (p.golesVisitante > p.golesLocal) tabla[vis].puntos += 3;
        else { tabla[loc].puntos += 1; tabla[vis].puntos += 1; }
    });

    let resultadoArray = Object.values(tabla).map(e => ({
        clubId: e.clubId, puntos: e.puntos, gf: e.gf, gc: e.gc, diff: e.gf - e.gc
    }));

    resultadoArray.sort((a, b) => (b.puntos !== a.puntos) ? (b.puntos - a.puntos) : (b.diff !== a.diff ? b.diff - a.diff : b.gf - a.gf));
    return resultadoArray;
}

async function obtenerTablasPosicionesGruposSudamerica(partidaId, competicionId) {
    const partidos = await Partido.find({ partidaId, competicionId, tipo: "LIGA", jugado: true });
    let grupos = {};

    partidos.forEach(p => {
        if (!p.grupo || !p.equipoLocal || !p.equipoVisitante) return;
        if (!grupos[p.grupo]) grupos[p.grupo] = {};

        const loc = p.equipoLocal.toString();
        const vis = p.equipoVisitante.toString();

        if (!grupos[p.grupo][loc]) grupos[p.grupo][loc] = { clubId: p.equipoLocal, puntos: 0, gf: 0, gc: 0 };
        if (!grupos[p.grupo][vis]) grupos[p.grupo][vis] = { clubId: p.equipoVisitante, puntos: 0, gf: 0, gc: 0 };

        grupos[p.grupo][loc].gf += (p.golesLocal || 0); grupos[p.grupo][loc].gc += (p.golesVisitante || 0);
        grupos[p.grupo][vis].gf += (p.golesVisitante || 0); grupos[p.grupo][vis].gc += (p.golesLocal || 0);

        if (p.golesLocal > p.golesVisitante) grupos[p.grupo][loc].puntos += 3;
        else if (p.golesVisitante > p.golesLocal) grupos[p.grupo][vis].puntos += 3;
        else { grupos[p.grupo][loc].puntos += 1; grupos[p.grupo][vis].puntos += 1; }
    });

    let structured = {};
    for (const [letraGrupo, tablaEquipos] of Object.entries(grupos)) {
        let arr = Object.values(tablaEquipos).map(e => ({
            clubId: e.clubId, puntos: e.puntos, gf: e.gf, gc: e.gc, diff: e.gf - e.gc
        }));
        arr.sort((a, b) => (b.puntos !== a.puntos) ? (b.puntos - a.puntos) : (b.diff !== a.diff ? b.diff - a.diff : b.gf - a.gf));
        structured[letraGrupo] = arr;
    }
    return structured;
}

module.exports = { verificarYGenerarSiguienteRonda };