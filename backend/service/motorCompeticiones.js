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

            // Verificamos si queda algo pendiente de esta jornada exacta en esta competición
            const pendientes = await Partido.countDocuments({
                partidaId,
                competicionId: compId,
                jornada: jornadaActual,
                jugado: false
            });

            if (pendientes > 0) continue; // Faltan partidos por jugar en el día/jornada actual

            const competicion = await Competicion.findById(compId);
            const nombreComp = competicion.nombre.toLowerCase();
            const partidosDeLaFase = await Partido.find({ partidaId, competicionId: compId, jornada: jornadaActual });

            // DETECTOR DE FORMATO: EUROPA vs COPA vs SUDAMÉRICA
            
            // --- 1. BLOQUE INTERNACIONAL EUROPA ---
            if (nombreComp.includes('europa') || nombreComp.includes('champions') || nombreComp.includes('conference')) {
                
                if (tipoActual === 'LIGA' && jornadaActual === 8) {
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
                
                // JORNADA 0: Terminó la Ronda Previa -> Generar 1/32 (Jornada 1)
                if (jornadaActual === 0) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Ronda Previa. Pasando a 1/32...`);
                    const ganadoresPrevios = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    
                    const equiposQueYaJugaron = new Set(partidosDeLaFase.flatMap(p => [p.equipoLocal.toString(), p.equipoVisitante.toString()]));
                    const todosLosClubes = await Club.find({ partidaId, competiciones: compId, esFilial: false });
                    const equiposExentos = todosLosClubes
                        .map(c => c._id.toString())
                        .filter(id => !equiposQueYaJugaron.has(id));

                    const bolsaCompleta = [...ganadoresPrevios, ...equiposExentos];
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, bolsaCompleta, '1/32 de Final', fechaSimulada, 1);
                }
                
                // JORNADA 1: Terminó 1/32 -> Generar 1/16 (Jornada 2)
                else if (jornadaActual === 1) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de 1/32. Generando 1/16 de Final...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, '1/16 de Final', fechaSimulada, 2);
                } 
                
                // JORNADA 2: Terminó 1/16 -> Generar 1/8 (Jornada 3)
                else if (jornadaActual === 2) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de 1/16. Generando Octavos de Final...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Octavos de Final', fechaSimulada, 3);
                } 
                
                // JORNADA 3: Terminó 1/8 -> Generar 1/4 (Jornada 4)
                else if (jornadaActual === 3) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Octavos. Generando Cuartos de Final...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Cuartos de Final', fechaSimulada, 4);
                } 
                
                // JORNADA 4: Terminó 1/4 -> Generar Semifinales (Jornada 5 de Ida)
                else if (jornadaActual === 4) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Cuartos. Generando Semifinales...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Semifinal', fechaSimulada, 5);
                } 
                
                // JORNADA 5 o 6: Gestión de Semifinales
                else if (jornadaActual === 5 || jornadaActual === 6) {
                    const paisesDobleSemi = ['españa', 'italia', 'portugal', 'paises bajos', 'brasil'];
                    const tieneVuelta = paisesDobleSemi.some(p => nombreComp.includes(p));

                    if (tieneVuelta) {
                        // Con el calendario limpio, la vuelta se procesa única y estrictamente en la jornada 6
                        if (jornadaActual === 6) {
                            console.log(`[MOTOR - ${competicion.nombre}] Fin de Semifinales (Vuelta). Generando Gran Final...`);
                            const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, true, 5); 
                            await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, finalistas, 'Gran Final', fechaSimulada, 7);
                        }
                    } else {
                        // Formato a partido único (Inglaterra). Se resuelve directamente en la jornada 5
                        if (jornadaActual === 5) {
                            console.log(`[MOTOR - ${competicion.nombre}] Fin de Semifinales (Única). Generando Gran Final...`);
                            const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                            await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, finalistas, 'Gran Final', fechaSimulada, 7);
                        }
                    }
                }
                
                // JORNADA 7: Final de la Copa
                else if (jornadaActual === 7) {
                    console.log(`[MOTOR - ${competicion.nombre}] ¡La gran final ha concluido! Copa finalizada.`);
                }
            }

            // --- 3. BLOQUE SUDAMÉRICA ---
            else if (nombreComp.includes('libertadores') || nombreComp.includes('sudamericana')) {
                if (tipoActual === 'LIGA' && jornadaActual === 6) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Fase de Grupos. Generando Rondas Eliminatorias Sudamericanas...`);
                    const tablasGrupos = await obtenerTablasPosicionesGruposSudamerica(partidaId, compId);
                    
                    if (nombreComp.includes('sudamericana')) {
                        await calendarioService.generarPlayoffsSudamericana(partidaId, competicion, tablasGrupos, fechaSimulada);
                    } else {
                        await calendarioService.generarOctavosLibertadores(partidaId, competicion, tablasGrupos, fechaSimulada);
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
        if (!esDoblePartido) {
            // PARTIDO ÚNICO: El simulador ya resolvió la prórroga/penaltis en DB si fue necesario.
            if (p.golesLocal > p.golesVisitante) {
                ganadores.push(p.equipoLocal.toString());
            } else if (p.golesVisitante > p.golesLocal) {
                ganadores.push(p.equipoVisitante.toString());
            } else {
                // Si el marcador del simulador terminó en empate, leemos obligatoriamente quién ganó en los penaltis.
                ganadores.push(p.ganadorPenaltis.toString());
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

            const globalEquipoVueltaLocal = p.golesLocal + pIda.golesVisitante;
            const globalEquipoVueltaVisitante = p.golesVisitante + pIda.golesLocal;

            if (globalEquipoVueltaLocal > globalEquipoVueltaVisitante) {
                ganadores.push(p.equipoLocal.toString());
            } else if (globalEquipoVueltaVisitante > globalEquipoVueltaLocal) {
                ganadores.push(p.equipoVisitante.toString());
            } else {
                // Empate en goles globales absolutos. Extraemos el ganador de la tanda jugada en la vuelta.
                ganadores.push(p.ganadorPenaltis.toString());
            }
        }
    }
    return [...new Set(ganadores)];
}

async function calcularGanadoresDoblePartido(partidaId, partidosVuelta, jornadaIda) {
    let ganadoresLlaves = {};
    for (const pVuelta of partidosVuelta) {
        if (!pVuelta.llave) continue;

        const pIda = await Partido.findOne({
            partidaId,
            competicionId: pVuelta.competicionId,
            jornada: jornadaIda,
            llave: pVuelta.llave
        });

        if (!pIda) continue;

        const totalEquipoVueltaLocal = pVuelta.golesLocal + pIda.golesVisitante;
        const totalEquipoVueltaVisitante = pVuelta.golesVisitante + pIda.golesLocal;

        if (totalEquipoVueltaLocal > totalEquipoVueltaVisitante) {
            ganadoresLlaves[pVuelta.llave] = pVuelta.equipoLocal.toString();
        } else if (totalEquipoVueltaVisitante > totalEquipoVueltaLocal) {
            ganadoresLlaves[pVuelta.llave] = pVuelta.equipoVisitante.toString();
        } else {
            ganadoresLlaves[pVuelta.llave] = pVuelta.ganadorPenaltis.toString();
        }
    }
    return ganadoresLlaves;
}

async function calcularGanadoresAgrupadosPorRuta(partidaId, partidosVuelta, jornadaIda) {
    let rutas = {};
    for (const pVuelta of partidosVuelta) {
        if (!pVuelta.llave) continue;

        const pIda = await Partido.findOne({
            partidaId,
            competicionId: pVuelta.competicionId,
            jornada: jornadaIda,
            llave: pVuelta.llave
        });

        if (!pIda) continue;

        const totalEquipoVueltaLocal = pVuelta.golesLocal + pIda.golesVisitante;
        const totalEquipoVueltaVisitante = pVuelta.golesVisitante + pIda.golesLocal;
        
        let ganador;
        if (totalEquipoVueltaLocal > totalEquipoVueltaVisitante) {
            ganador = pVuelta.equipoLocal.toString();
        } else if (totalEquipoVueltaVisitante > totalEquipoVueltaLocal) {
            ganador = pVuelta.equipoVisitante.toString();
        } else {
            ganador = pVuelta.ganadorPenaltis.toString();
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
        const loc = p.equipoLocal.toString();
        const vis = p.equipoVisitante.toString();

        if (!tabla[loc]) tabla[loc] = { clubId: p.equipoLocal, puntos: 0, gf: 0, gc: 0 };
        if (!tabla[vis]) tabla[vis] = { clubId: p.equipoVisitante, puntos: 0, gf: 0, gc: 0 };

        tabla[loc].gf += p.golesLocal; tabla[loc].gc += p.golesVisitante;
        tabla[vis].gf += p.golesVisitante; tabla[vis].gc += p.golesLocal;

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
        if (!p.grupo) return;
        if (!grupos[p.grupo]) grupos[p.grupo] = {};

        const loc = p.equipoLocal.toString();
        const vis = p.equipoVisitante.toString();

        if (!grupos[p.grupo][loc]) grupos[p.grupo][loc] = { clubId: p.equipoLocal, puntos: 0, gf: 0, gc: 0 };
        if (!grupos[p.grupo][vis]) grupos[p.grupo][vis] = { clubId: p.equipoVisitante, puntos: 0, gf: 0, gc: 0 };

        grupos[p.grupo][loc].gf += p.golesLocal; grupos[p.grupo][loc].gc += p.golesVisitante;
        grupos[p.grupo][vis].gf += p.golesVisitante; grupos[p.grupo][vis].gc += p.golesLocal;

        if (p.golesLocal > p.golesVisitante) grupos[p.grupo][loc].puntos += 3;
        else if (p.golesVisitante > p.golesLocal) grupos[p.grupo][vis].puntos += 3;
        else { grupos[p.grupo][loc].puntos += 1; grupos[p.grupo][vis].puntos += 1; }
    });

    let estructurado = {};
    for (const [letraGrupo, tablaEquipos] of Object.entries(grupos)) {
        let arr = Object.values(tablaEquipos).map(e => ({
            clubId: e.clubId, puntos: e.puntos, gf: e.gf, gc: e.gc, diff: e.gf - e.gc
        }));
        arr.sort((a, b) => (b.puntos !== a.puntos) ? (b.puntos - a.puntos) : (b.diff !== a.diff ? b.diff - a.diff : b.gf - a.gf));
        estructurado[letraGrupo] = arr;
    }
    return estructurado;
}

module.exports = { verificarYGenerarSiguienteRonda };