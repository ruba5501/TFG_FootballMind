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
            
            const jornadaActual = partidoMuestra.jornada; // Número (ej: 8, 10, 12)
            const tipoActual = partidoMuestra.tipo;       // String (ej: 'LIGA', 'ELIMINATORIA')

            // Verificamos si queda algo pendiente de esta jornada exacta en esta competición
            const pendientes = await Partido.countDocuments({
                partidaId,
                competicionId: compId,
                jornada: jornadaActual,
                jugado: false
            });

            if (pendientes > 0) continue; // Faltan partidos por jugar

            const competicion = await Competicion.findById(compId);
            const nombreComp = competicion.nombre.toLowerCase();
            const partidosDeLaFase = await Partido.find({ partidaId, competicionId: compId, jornada: jornadaActual });

            // =================================================================
            // DETECTOR DE FORMATO: EUROPA vs COPA vs SUDAMÉRICA
            // =================================================================
            
            // --- 1. BLOQUE INTERNACIONAL EUROPA ---
            if (nombreComp.includes('europa') || nombreComp.includes('champions') || nombreComp.includes('conference')) {
                
                if (tipoActual === 'LIGA' && jornadaActual === 8) {
                    // Terminó la fase de liga (Jornada 8). Toca generar Dieciseisavos (Jornadas 9 y 10)
                    const tablaPosiciones = await obtenerTablaPosicionesFormatoLiga(partidaId, compId);
                    await calendarioService.generarDieciseisavosEuropa(partidaId, competicion, tablaPosiciones, fechaSimulada);
                } 
                else if (tipoActual === 'ELIMINATORIA' && jornadaActual === 10) {
                    // Terminó la vuelta de Dieciseisavos (Jornada 10). Toca generar Octavos (11 y 12)
                    const ganadoresPlayoff = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, 9);
                    const tablaPosiciones = await obtenerTablaPosicionesFormatoLiga(partidaId, compId);
                    await calendarioService.generarOctavosEuropa(partidaId, competicion, tablaPosiciones, ganadoresPlayoff, fechaSimulada);
                } 
                else if (tipoActual === 'ELIMINATORIA' && jornadaActual === 12) {
                    // Vuelta de Octavos. Generar Cuartos (13 y 14)
                    const ganadoresOctavos = await calcularGanadoresDoblePartido(partidaId, partidosDeLaFase, 11);
                    await calendarioService.generarCuadroFinalEuropa(partidaId, competicion, ganadoresOctavos, 'CUARTOS', fechaSimulada);
                } 
                else if (tipoActual === 'ELIMINATORIA' && jornadaActual === 14) {
                    // Vuelta de Cuartos. Generar Semifinales (15 y 16)
                    const ganadoresCuartos = await calcularGanadoresAgrupadosPorRuta(partidaId, partidosDeLaFase, 13);
                    await calendarioService.generarCuadroFinalEuropa(partidaId, competicion, ganadoresCuartos, 'SEMIFINAL', fechaSimulada);
                } 
                else if (tipoActual === 'ELIMINATORIA' && jornadaActual === 16) {
                    // Vuelta de Semis. Generar la Final Única (Jornada 17)
                    const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, true, 15);
                    await calendarioService.generarCuadroFinalEuropa(partidaId, competicion, finalistas, 'FINAL', fechaSimulada);
                }
            }
            
            // BLOQUE COPAS NACIONALES (Sincronizado con SEMANAS_COPA) 
            else if (tipoActual === 'ELIMINATORIA' && !nombreComp.includes('libertadores') && !nombreComp.includes('sudamericana')) {
                
                // 🏆 JORNADA 0: Terminó la Ronda Previa -> Generar 1/32 (Jornada 1)
                if (jornadaActual === 0) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Ronda Previa. Pasando a 1/32...`);
                    const ganadoresPrevios = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    
                    // Buscamos los clubes exentos (los que no jugaron la jornada 0)
                    const equiposQueYaJugaron = new Set(partidosDeLaFase.flatMap(p => [p.equipoLocal.toString(), p.equipoVisitante.toString()]));
                    const todosLosClubes = await Club.find({ partidaId, competiciones: compId, esFilial: false });
                    const equiposExentos = todosLosClubes
                        .map(c => c._id.toString())
                        .filter(id => !equiposQueYaJugaron.has(id));

                    const bolsaCompleta = [...ganadoresPrevios, ...equiposExentos];
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, bolsaCompleta, '1/32 de Final', fechaSimulada, 1);
                }
                
                // 🏆 JORNADA 1: Terminó 1/32 -> Generar 1/16 (Jornada 2)
                else if (jornadaActual === 1) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de 1/32. Generando 1/16 de Final...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, '1/16 de Final', fechaSimulada, 2);
                } 
                
                // 🏆 JORNADA 2: Terminó 1/16 -> Generar 1/8 (Jornada 3)
                else if (jornadaActual === 2) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de 1/16. Generando Octavos de Final...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Octavos de Final', fechaSimulada, 3);
                } 
                
                // 🏆 JORNADA 3: Terminó 1/8 -> Generar 1/4 (Jornada 4)
                else if (jornadaActual === 3) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Octavos. Generando Cuartos de Final...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Cuartos de Final', fechaSimulada, 4);
                } 
                
                // 🏆 JORNADA 4: Terminó 1/4 -> Generar Semifinales (Jornada 5)
                else if (jornadaActual === 4) {
                    console.log(`[MOTOR - ${competicion.nombre}] Fin de Cuartos. Generando Semifinales...`);
                    const clasificados = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                    await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, clasificados, 'Semifinal', fechaSimulada, 5);
                } 
                
                // 🏆 JORNADA 5 o 6: Gestión de Semifinales (Doble partido / Partido único)
                else if (jornadaActual === 5 || jornadaActual === 6) {
                    const paisesDobleSemi = ['españa', 'italia', 'portugal', 'paises bajos', 'brasil'];
                    const tieneVuelta = paisesDobleSemi.some(p => nombreComp.includes(p));

                    if (tieneVuelta) {
                        // Si tiene ida y vuelta y estamos en la jornada 5, significa que se guardaron ambas con el mismo numJornada
                        // Pero el motor se ejecuta CADA DÍA. Solo avanzamos si se han jugado TODOS los partidos (Idas y Vueltas).
                        // Como tu filtro inicial arriba ya hace: if (pendientes > 0) continue; 
                        // Cuando 'pendientes === 0' en la jornada 5, significa que la vuelta (que comparte jornada 5) YA se jugó.
                        
                        console.log(`[MOTOR - ${competicion.nombre}] Fin de Semifinales (Vuelta). Generando Gran Final...`);
                        const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, true, 5); 
                        // Nota: Pasamos 'true' porque es doble partido, y ambos comparten la jornada 5 en base a la llave.
                        await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, finalistas, 'Gran Final', fechaSimulada, 7);
                    } else {
                        // Copa a partido único en semis (ej: Inglaterra)
                        if (jornadaActual === 5) {
                            console.log(`[MOTOR - ${competicion.nombre}] Fin de Semifinales (Única). Generando Gran Final...`);
                            const finalistas = await obtenerGanadoresGlobales(partidaId, partidosDeLaFase, false);
                            await calendarioService.generarSiguienteRondaCopa(partidaId, competicion, finalistas, 'Gran Final', fechaSimulada, 7);
                        }
                    }
                }
                
                // 🏆 JORNADA 7: ¡Final de la Copa!
                else if (jornadaActual === 7) {
                    console.log(`[MOTOR - ${competicion.nombre}] ¡La gran final ha concluido! Copa finalizada.`);
                    // Aquí puedes disparar lógica de trofeos, estadísticas históricas, etc.
                }
            }

            // --- 3. BLOQUE SUDAMÉRICA ---
            else if (nombreComp.includes('libertadores') || nombreComp.includes('sudamericana')) {
                // Aquí enganchas tu lógica numérica para los grupos y el PO_VUELTA de Sudamérica cuando definas sus números de jornada
            }
        }
    } catch (error) {
        console.error("Error en el motor de rondas:", error);
    }
}

// ====================================================================
// AUXILIARES REESCRITAS CON EL MODELO REAL DE BASE DE DATOS
// ====================================================================

async function obtenerGanadoresGlobales(partidaId, partidosVuelta, esDoblePartido, jornadaIda = null) {
    let ganadores = [];

    for (const p of partidosVuelta) {
        if (!esDoblePartido) {
            if (p.golesLocal > p.golesVisitante) ganadores.push(p.equipoLocal.toString());
            else if (p.golesVisitante > p.golesLocal) ganadores.push(p.equipoVisitante.toString());
            else if (p.ganadorPenaltis) ganadores.push(p.ganadorPenaltis.toString());
        } else {
            // Buscamos el partido de ida usando exclusivamente la propiedad 'llave'
            // Evitamos cruzar estrictamente equipoLocal/Visitante porque el orden puede variar según la localía de la vuelta
            const pIda = await Partido.findOne({
                partidaId,
                competicionId: p.competicionId,
                jornada: jornadaIda,
                llave: p.llave,
                _id: { $ne: p._id }
            });

            if (!pIda) continue;

            // Identificamos los goles del equipo que actúa como LOCAL en la VUELTA
            const globalEquipoVueltaLocal = p.golesLocal + pIda.golesVisitante;
            // Identificamos los goles del equipo que actúa como VISITANTE en la VUELTA
            const globalEquipoVueltaVisitante = p.golesVisitante + pIda.golesLocal;

            if (globalEquipoVueltaLocal > globalEquipoVueltaVisitante) {
                ganadores.push(p.equipoLocal.toString());
            } else if (globalEquipoVueltaVisitante > globalEquipoVueltaLocal) {
                ganadores.push(p.equipoVisitante.toString());
            } else if (p.ganadorPenaltis) {
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

        let ganador = totalEquipoVueltaLocal > totalEquipoVueltaVisitante 
            ? pVuelta.equipoLocal.toString() 
            : (totalEquipoVueltaVisitante > totalEquipoVueltaLocal ? pVuelta.equipoVisitante.toString() : pVuelta.ganadorPenaltis.toString());
        
        ganadoresLlaves[pVuelta.llave] = ganador;
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
        
        let ganador = totalEquipoVueltaLocal > totalEquipoVueltaVisitante 
            ? pVuelta.equipoLocal.toString() 
            : (totalEquipoVueltaVisitante > totalEquipoVueltaLocal ? pVuelta.equipoVisitante.toString() : pVuelta.ganadorPenaltis.toString());

        if (!rutas[pVuelta.llave]) {
            rutas[pVuelta.llave] = [];
        }
        // Guardamos el ID del club directamente en el array plano
        rutas[pVuelta.llave].push(ganador);
    }
    return rutas;
}

// Cómputo de tablas de posiciones usando el tipo "LIGA" y sumando estadísticas
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

module.exports = { verificarYGenerarSiguienteRonda };