const Partido = require('../models/partido'); 
const Competicion = require('../models/competicion'); 
const Club = require('../models/club');
const calendarioService = require('./generarCalendario'); 

async function verificarYGenerarSiguienteRonda(partidaId, fechaSimulada) {
    try {
        const inicioDia = new Date(fechaSimulada); inicioDia.setHours(0,0,0,0);
        const finDia = new Date(fechaSimulada); finDia.setHours(23,59,59,999);

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

            if (pendientes > 0) continue; 

            const competicion = await Competicion.findById(compId);
            const nombreComp = competicion.nombre.toLowerCase();
            const partidosDeLaFase = await Partido.find({ partidaId, competicionId: compId, jornada: jornadaActual });

            // --- 1. BLOQUE INTERNACIONAL EUROPA (¡CORREGIDO SOLAPAMIENTO CON CHAMPIONSHIP!) ---
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
            
            // --- 2. BLOQUE COPAS NACIONALES (Y LIGAS REGULARES COMO LA CHAMPIONSHIP) ---
            else if (tipoActual === 'ELIMINATORIA' && !nombreComp.includes('libertadores') && !nombreComp.includes('sudamericana')) {
                
                if (jornadaActual === 0) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Ronda Previa. Pasando a 1/16 de Final...`);
                    const ganadoresPrevios = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    
                    const equiposQueYaJugaron = new Set(partidosDeLaFase.flatMap(p => [p.equipoLocal?.toString(), p.equipoVisitante?.toString()].filter(Boolean)));
                    const todosLosClubes = await Club.find({ partidaId, competiciones: compId, esFilial: false });
                    const equiposExentos = todosLosClubes
                        .map(c => c._id.toString())
                        .filter(id => !equiposQueYaJugaron.has(id));

                    const bolsaCompleta = [...ganadoresPrevios, ...equiposExentos];
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, bolsaCompleta, '1/16 de Final', fechaSimulada, 1);
                }
                else if (jornadaActual === 1) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de 1/16. Generando Octavos de Final...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Octavos de Final', fechaSimulada, 2);
                } 
                else if (jornadaActual === 2) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Octavos. Generando Cuartos de Final...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Cuartos de Final', fechaSimulada, 3);
                } 
                else if (jornadaActual === 3) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Cuartos. Generando Semifinales...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    
                    // Pasamos numJornada = 4 para crear las semifinales
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Semifinal', fechaSimulada, 4);
                } 
                else if (jornadaActual === 4 || jornadaActual === 5) {
                    // Mapeo exacto según los nombres reales de tu JSON de torneos con ida y vuelta
                    const copasConDobleSemi = ['copa del rey', 'coppa italia', 'taça de portugal', 'knvb beker', 'copa do brasil'];
                    const tieneVuelta = copasConDobleSemi.includes(nombreComp);

                    if (tieneVuelta) {
                        if (jornadaActual === 4) {
                            // Terminó la ida. NO hacemos nada, simplemente esperamos a la vuelta (jornada 5)
                            console.log(`[MOTOR - ${competicion.nombre}] Terminó Semifinal (Ida). Esperando a que se juegue la Vuelta (Jornada 5)...`);
                            continue; 
                        } else if (jornadaActual === 5) {
                            console.log(`[MOTOR - ${competicion.nombre}] Fin de Semifinales (Vuelta). Generando Gran Final...`);
                            // Calculamos los ganadores comparando la jornada de vuelta (5) con su ida (4)
                            const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, true, 4);
                            await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, finalistas, 'Gran Final', fechaSimulada, 6);
                        }
                    } else {
                        // Copas de partido único (FA Cup, DFB-Pokal, Coupe de France, Copa Argentina)
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
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Fase de Grupos Sudamericana.`);
                    
                    // 1. Necesitamos obtener todas las tablas de las dos competiciones para cruzarlas
                    const compLibertadores = await Competicion.findOne({ partidaId, nombre: /libertadores/i });
                    const compSudamericana = await Competicion.findOne({ partidaId, nombre: /sudamericana/i });

                    const tablasLib = await obtenerTablasPosicionesGruposSudamerica(partidaId, compLibertadores._id);
                    const tablasSud = await obtenerTablasPosicionesGruposSudamerica(partidaId, compSudamericana._id);
                    
                    // 2. Extraer los clasificados correspondientes de cada grupo (1ºs, 2ºs y 3ºs)
                    let primerosLib = [], segundosLib = [], tercerosLib = [];
                    let segundosSud = [];

                    Object.values(tablasLib).forEach(grupo => {
                        if(grupo[0]) primerosLib.push(grupo[0]);
                        if(grupo[1]) segundosLib.push(grupo[1]);
                        if(grupo[2]) tercerosLib.push(grupo[2]); // Van a Play-offs de Sudamericana
                    });

                    Object.values(tablasSud).forEach(grupo => {
                        if(grupo[1]) segundosSud.push(grupo[1]); // Van a Play-offs de Sudamericana
                    });

                    if (nombreComp.includes('sudamericana')) {
                        // Se envían los parámetros tal y como los espera la firma de la función:
                        // (partidaId, compSudamericanaId, nombreCompeticion, resultadosLib [terceros], resultadosSud [segundos], fechaUltimaJornada)
                        await calendarioService.generarPlayoffsSudamericana(
                            partidaId, 
                            competicion._id, 
                            competicion.nombre, 
                            tercerosLib, 
                            segundosSud, 
                            fechaSimulada
                        );
                    } else {
                        // Para la Libertadores, pasan los primeros y segundos de su propio torneo directamente a Octavos
                        // Asegúrate de pasarle los arrays de primeros y segundos mapeados correctamente a su función
                        await calendarioService.generarOctavosLibertadores(
                            partidaId, 
                            competicion, 
                            primerosLib, 
                            segundosLib, 
                            fechaSimulada
                        );
                    }
                }
                else if (tipoActual === 'ELIMINATORIA') {
                    if (jornadaActual === 8 && nombreComp.includes('sudamericana')) {
                        const ganadoresPlayoff = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, 7);
                        await calendarioService.generarOctavosSudamericana(partidaId, competicion, ganadoresPlayoff, fechaSimulada);
                    }
                    else if (jornadaActual === 10) {
                        const ganadoresOctavos = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, 9);
                        await calendarioService.generarCuadroFinalSudamerica(partidaId, competicion, ganadoresOctavos, 'CUARTOS', fechaSimulada, 11);
                    }
                    else if (jornadaActual === 12) {
                        const ganadoresCuartos = await calcularGanadoresAgrupadosPorRuta(partidaId, partidosDeLaFase, 11);
                        await calendarioService.generarCuadroFinalSudamerica(partidaId, competicion, ganadoresCuartos, 'SEMIFINAL', fechaSimulada, 13);
                    }
                    else if (jornadaActual === 14) {
                        const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, true, 13);
                        await calendarioService.generarCuadroFinalSudamerica(partidaId, competicion, finalistas, 'FINAL', fechaSimulada, 15);
                    }
                    else if (jornadaActual === 15) {
                        console.log(`[MOTOR - ${competicion.nombre}] ¡Final Conmebol finalizada!`);
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
            // DOBLE PARTIDO (IDA Y VUELTA)
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

            const globalEquipoVueltaLocal = (p.golesLocal || 0) + (pIda.golesVisitante || 0);
            const globalEquipoVueltaVisitante = (p.golesVisitante || 0) + (pIda.golesLocal || 0);

            if (globalEquipoVueltaLocal > globalEquipoVueltaVisitante) {
                ganadores.push(p.equipoLocal.toString());
            } else if (globalEquipoVueltaVisitante > globalEquipoVueltaLocal) {
                ganadores.push(p.equipoVisitante.toString());
            } else {
                if (p.ganadorPenaltis) {
                    ganadores.push(p.ganadorPenaltis.toString());
                } else {
                    console.error(`[CRÍTICO] Global empatado (Llave: ${p.llave}) sin ganadorPenaltis en la vuelta. Fallback al local.`);
                    ganadores.push(p.equipoLocal.toString());
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

        const totalEquipoVueltaLocal = (pVuelta.golesLocal || 0) + (pIda.golesVisitante || 0);
        const totalEquipoVueltaVisitante = (pVuelta.golesVisitante || 0) + (pIda.golesLocal || 0);

        if (totalEquipoVueltaLocal > totalEquipoVueltaVisitante) {
            ganadoresLlaves[pVuelta.llave] = pVuelta.equipoLocal.toString();
        } else if (totalEquipoVueltaVisitante > totalEquipoVueltaLocal) {
            ganadoresLlaves[pVuelta.llave] = pVuelta.equipoVisitante.toString();
        } else {
            ganadoresLlaves[pVuelta.llave] = pVuelta.ganadorPenaltis ? pVuelta.ganadorPenaltis.toString() : pVuelta.equipoLocal.toString();
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

        const totalEquipoVueltaLocal = (pVuelta.golesLocal || 0) + (pIda.golesVisitante || 0);
        const totalEquipoVueltaVisitante = (pVuelta.golesVisitante || 0) + (pIda.golesLocal || 0);
        
        let ganador;
        if (totalEquipoVueltaLocal > totalEquipoVueltaVisitante) {
            ganador = pVuelta.equipoLocal.toString();
        } else if (totalEquipoVueltaVisitante > totalEquipoVueltaLocal) {
            ganador = pVuelta.equipoVisitante.toString();
        } else {
            ganador = pVuelta.ganadorPenaltis ? pVuelta.ganadorPenaltis.toString() : pVuelta.equipoLocal.toString();
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