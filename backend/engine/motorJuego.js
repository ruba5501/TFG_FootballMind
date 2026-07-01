
function getMedia(jugador, categoria, attrs) {
    let suma = 0;
    attrs.forEach(a => {
        if (jugador.atributos && jugador.atributos[categoria] && jugador.atributos[categoria][a] !== undefined) {
            suma += jugador.atributos[categoria][a];
        } else {
            suma += 50; 
        }
    });
    
    const forma = jugador.estado?.forma || 100;
    const factorForma = Math.max(0.5, forma / 100); 
    
    return (suma / attrs.length) * factorForma;
}

/**
 * Reduce la energía de los jugadores basándose en su resistencia y motivación.
 */
function aplicarCansancio(equipo) {
    if (!equipo) return;
    
    const listaJugadores = equipo.jugadores || equipo.titulares || (Array.isArray(equipo) ? equipo : []);

    listaJugadores.forEach(j => {
        if (!j || !j.atributos || !j.estado) return; 
        
        const resistencia = j.atributos.fisico?.resistencia ?? 50;
        const motivacion = j.atributos.mental?.motivacion ?? 50;
        
        const factorMente = 1 - ((motivacion - 50) / 500); 
        const perdida = (0.7 - (resistencia * 0.005)) * factorMente; 
        j.estado.forma = Math.max(0, (j.estado.forma || 100) - perdida);
    });
}

function buscarJugadorPorPosicion(equipo, posiciones) {
    const candidatos = equipo.jugadores.filter(j => posiciones.includes(j.posicionPrincipal));
    if (candidatos.length > 0) {
        return candidatos[Math.floor(Math.random() * candidatos.length)];
    }
    const resto = equipo.jugadores.filter(j => j.posicionPrincipal !== 'POR');
    return resto[Math.floor(Math.random() * resto.length)] || equipo.jugadores[0];
}

/**
 * Encuentra al líder del equipo (para bono moral)
 */
function obtenerLiderazgoEquipo(equipo) {
    if (!equipo.jugadores || equipo.jugadores.length === 0) return 50;
    const lider = equipo.jugadores.reduce((prev, current) => 
        ((prev.atributos?.mental?.liderazgo ?? 50) > (current.atributos?.mental?.liderazgo ?? 50)) ? prev : current
    );
    return lider.atributos?.mental?.liderazgo ?? 50;
}

/**
 * SUB-MOTOR: Simula un tramo específico de minutos
 */
function simularTramoMinutos(local, visitante, minutoInicio, minutoFin, estadoPartido) {
    let { golesLocal, golesVisitante, posesionLocal, momentumLocal, momentumVisitante, eventos } = estadoPartido;

    for (let minuto = minutoInicio; minuto <= minutoFin; minuto++) {
        // --- 0. FASE FÍSICA Y MENTAL ---
        aplicarCansancio(local);
        aplicarCansancio(visitante);

        // --- 1. FASE DE ESTRATEGIA (POSESIÓN) ---
        const intercepcionesLocal = local.jugadores.reduce((s, j) => s + getMedia(j, 'defensa', ['intercepciones', 'colocacion']), 0) / 11;
        const intercepcionesVisitante = visitante.jugadores.reduce((s, j) => s + getMedia(j, 'defensa', ['intercepciones', 'colocacion']), 0) / 11;

        const creacionLocal = local.jugadores.reduce((s, j) => s + getMedia(j, 'pase', ['vision', 'paseCorto', 'paseLargo']), 0) / 11;
        const creacionVisitante = visitante.jugadores.reduce((s, j) => s + getMedia(j, 'pase', ['vision', 'paseCorto', 'paseLargo']), 0) / 11;

        const porLocal = local.jugadores.find(j => j.posicionPrincipal === 'POR') || local.jugadores[0];
        const porVisitante = visitante.jugadores.find(j => j.posicionPrincipal === 'POR') || visitante.jugadores[0];

        const bonusLocal = (obtenerLiderazgoEquipo(local) * 0.05) + (getMedia(porLocal, 'portero', ['comunicacion']) * 0.05);
        const bonusVisitante = (obtenerLiderazgoEquipo(visitante) * 0.05) + (getMedia(porVisitante, 'portero', ['comunicacion']) * 0.05);

        const controlLocal = creacionLocal + intercepcionesLocal + bonusLocal + momentumLocal + 5; 
        const controlVisitante = creacionVisitante + intercepcionesVisitante + bonusVisitante + momentumVisitante;

        momentumLocal = 0;
        momentumVisitante = 0;

        const dominador = (controlLocal + (Math.random() * 20 - 10) > controlVisitante) ? 'local' : 'visitante';
        const atacanteTeam = (dominador === 'local') ? local : visitante;
        const defensorTeam = (dominador === 'local') ? visitante : local;

        if (dominador === 'local') posesionLocal += 0.4; else posesionLocal -= 0.4;

        // --- 2. FASE DE CREACIÓN (Equilibrada estadísticamente) ---
        const generador = buscarJugadorPorPosicion(atacanteTeam, ['MC', 'MCO', 'MD', 'MI']);
        const receptor = buscarJugadorPorPosicion(atacanteTeam, ['DC', 'SD', 'ED', 'EI']);
        const stopper = buscarJugadorPorPosicion(defensorTeam, ['MCD', 'DFC']);

        const calidadPaseHueco = getMedia(generador, 'pase', ['vision', 'paseCorto']) + getMedia(receptor, 'mental', ['desmarques']);
        const calidadCorte = getMedia(stopper, 'defensa', ['intercepciones', 'colocacion']);

        // Base matemática de probabilidad por minuto (~4.5% de probabilidad de jugada por minuto de juego)
        const probabilidadOcasion = 0.045 + ((calidadPaseHueco - calidadCorte) / 2000); 

        if (Math.random() < probabilidadOcasion) {
            // --- 3. FASE DE DEFINICIÓN REPARADA ---
            const tipoJugada = Math.random();
            const porteroRival = defensorTeam.jugadores.find(j => j.posicionPrincipal === 'POR') || defensorTeam.jugadores[0];
            let gol = false;
            let relato = "";

            const remate = getMedia(receptor, 'tiro', ['finalizacion', 'potenciaTiro']);
            const parada = getMedia(porteroRival, 'portero', ['reflejos', 'estirada']);

            if (tipoJugada < 0.30) {
                // A) Juego Aéreo
                relato = `Centro medido al área de ${generador.nombre}. ${receptor.nombre} se eleva de forma espectacular conectando un testarazo.`;
                gol = (remate * (Math.random() * 0.4 + 0.8)) > (parada * (Math.random() * 0.5 + 0.8));
            } else if (tipoJugada < 0.60) {
                // B) Tiro lejano
                relato = `${receptor.nombre} recoge un balón suelto en la frontal del área y saca un zapatazo violento buscando la escuadra.`;
                gol = (remate * (Math.random() * 0.3 + 0.7)) > (parada * (Math.random() * 0.4 + 0.9));
            } else {
                // C) Mano a mano
                relato = `¡Pase milimétrico entre líneas! ${receptor.nombre} gana la espalda a los defensas y encara al guardameta en un mano a mano vertiginoso.`;
                gol = (remate * (Math.random() * 0.5 + 0.9)) > (parada * (Math.random() * 0.4 + 0.8));
            }

            // Inyectamos el resultado y el relato de forma segura
            if (gol) {
                if (dominador === 'local') golesLocal++; else golesVisitante++;
                relato += ` ¡GOOOL del ${atacanteTeam.nombre}!`;
                eventos.push({
                    minuto, 
                    tipo: 'GOL', 
                    equipo: dominador, 
                    texto: relato,
                    jugador: receptor ? receptor.nombre : 'Desconocido'
                });
            } else {
                relato += ` ¡El guardameta ${porteroRival.nombre} evita el tanto con una estirada fabulosa!`;
                eventos.push({ minuto, tipo: 'OCASION', equipo: dominador, texto: relato });
            }
        }
    }

    return { golesLocal, golesVisitante, posesionLocal, momentumLocal, momentumVisitante, eventos };
}

/**
 * TANDA DE PENALTIS ESTADÍSTICA
 */
function simularTandaPenaltis(local, visitante, eventos) {
    eventos.push({ minuto: 120, tipo: 'INFO', texto: "¡Final del partido! El ganador se decidirá en la tanda de penaltis." });

    const tiradoresLocal = [...local.jugadores].sort((a,b) => (b.atributos?.tiro?.lanzamientoPenaltis ?? 50) - (a.atributos?.tiro?.lanzamientoPenaltis ?? 50));
    const tiradoresVisitante = [...visitante.jugadores].sort((a,b) => (b.atributos?.tiro?.lanzamientoPenaltis ?? 50) - (a.atributos?.tiro?.lanzamientoPenaltis ?? 50));

    const porLocal = local.jugadores.find(j => j.posicionPrincipal === 'POR') || local.jugadores[0];
    const porVisitante = visitante.jugadores.find(j => j.posicionPrincipal === 'POR') || visitante.jugadores[0];

    let penaltisLocalLogrados = 0;
    let penaltisVisitanteLogrados = 0;
    let ronda = 0;
    let ganadorPenaltis = null;

    while (!ganadorPenaltis) {
        ronda++;
        
        const tLocal = tiradoresLocal[(ronda - 1) % tiradoresLocal.length];
        const tVisitante = tiradoresVisitante[(ronda - 1) % tiradoresVisitante.length];

        let golLocal = ejecutarPenaltiIndividual(tLocal, porVisitante);
        if (golLocal) {
            penaltisLocalLogrados++;
            eventos.push({ minuto: 120, tipo: 'PENALTI_TANDA', equipo: 'local', texto: `✅ Gol de ${tLocal.nombre} para el equipo local.` });
        } else {
            eventos.push({ minuto: 120, tipo: 'PENALTI_TANDA', equipo: 'local', texto: `❌ ${tLocal.nombre} falla su lanzamiento.` });
        }

        let golVisitante = ejecutarPenaltiIndividual(tVisitante, porLocal);
        if (golVisitante) {
            penaltisVisitanteLogrados++;
            eventos.push({ minuto: 120, tipo: 'PENALTI_TANDA', equipo: 'visitante', texto: `✅ Gol de ${tVisitante.nombre} para el equipo visitante.` });
        } else {
            eventos.push({ minuto: 120, tipo: 'PENALTI_TANDA', equipo: 'visitante', texto: `❌ ${tVisitante.nombre} falla su lanzamiento.` });
        }

        if (ronda >= 5) {
            if (penaltisLocalLogrados > penaltisVisitanteLogrados) {
                ganadorPenaltis = 'local';
            } else if (penaltisVisitanteLogrados > penaltisLocalLogrados) {
                ganadorPenaltis = 'visitante';
            }
        }
    }

    return {
        ganadorId: ganadorPenaltis === 'local' ? local.id : visitante.id,
        marcadorTanda: { local: penaltisLocalLogrados, visitante: penaltisVisitanteLogrados }
    };
}

function ejecutarPenaltiIndividual(tirador, portero) {
    const nivelTirador = getMedia(tirador, 'tiro', ['lanzamientoPenaltis']) + getMedia(tirador, 'mental', ['composturaBajoPresion']) * 0.5;
    const nivelPortero = getMedia(portero, 'portero', ['penales', 'reflejos', 'estirada']);

    const suerteTirador = Math.random() * 40 + 60; 
    const suertePortero = Math.random() * 40 + 50; 

    if (Math.random() < 0.05) return false;

    return (nivelTirador * suerteTirador) > (nivelPortero * suertePortero);
}

function simularPartido(local, visitante, tipoPartido = 'LIGA', opcionesEliminatoria = null) {
    if (local && !local.jugadores) {
        local.jugadores = local.titulares || (Array.isArray(local) ? local : []);
    }
    if (visitante && !visitante.jugadores) {
        visitante.jugadores = visitante.titulares || (Array.isArray(visitante) ? visitante : []);
    }

    if (!local || !local.jugadores || local.jugadores.length === 0) {
        throw new Error("El equipo local no tiene jugadores disponibles para simular.");
    }
    if (!visitante || !visitante.jugadores || visitante.jugadores.length === 0) {
        throw new Error("El equipo visitante no tiene jugadores disponibles para simular.");
    }

    let estadoPartido = {
        golesLocal: 0,
        golesVisitante: 0,
        posesionLocal: 50,
        momentumLocal: 0,
        momentumVisitante: 0,
        events: [],
        eventos: []
    };

    // 1. Simular los 90 minutos reglamentarios
    estadoPartido = simularTramoMinutos(local, visitante, 1, 90, estadoPartido);

    let ganadorPenaltis = null;
    let marcadorTanda = null;

    // 2. Control Inteligente de Prórroga y Penaltis
    if (tipoPartido === 'FINAL') {
        if (estadoPartido.golesLocal === estadoPartido.golesVisitante) {
            estadoPartido.eventos.push({ minuto: 90, tipo: 'INFO', texto: `Empate ${estadoPartido.golesLocal}-${estadoPartido.golesVisitante}. ¡Nos vamos a la prórroga!` });
            estadoPartido = simularTramoMinutos(local, visitante, 91, 120, estadoPartido);

            if (estadoPartido.golesLocal === estadoPartido.golesVisitante) {
                const tanda = simularTandaPenaltis(local, visitante, estadoPartido.eventos);
                ganadorPenaltis = tanda.ganadorId;
                marcadorTanda = tanda.marcadorTanda;
            }
        }
    } 
    else if (tipoPartido === 'ELIMINATORIA') {
        // CASO A: Es el partido de VUELTA de una serie de Ida y Vuelta
        if (opcionesEliminatoria && opcionesEliminatoria.esVuelta) {
            const globalLocal = estadoPartido.golesLocal + (opcionesEliminatoria.golesIdaVisitante || 0);
            const globalVisitante = estadoPartido.golesVisitante + (opcionesEliminatoria.golesIdaLocal || 0);

            if (globalLocal === globalVisitante) {
                estadoPartido.eventos.push({ 
                    minuto: 90, 
                    tipo: 'INFO', 
                    texto: `Marcador de hoy: ${estadoPartido.golesLocal}-${estadoPartido.golesVisitante}. ¡Empate global ${globalLocal}-${globalVisitante}! Nos vamos a la prórroga.` 
                });
                
                estadoPartido = simularTramoMinutos(local, visitante, 91, 120, estadoPartido);

                const nuevoGlobalLocal = estadoPartido.golesLocal + (opcionesEliminatoria.golesIdaVisitante || 0);
                const nuevoGlobalVisitante = estadoPartido.golesVisitante + (opcionesEliminatoria.golesIdaLocal || 0);

                if (nuevoGlobalLocal === nuevoGlobalVisitante) {
                    const tanda = simularTandaPenaltis(local, visitante, estadoPartido.eventos);
                    ganadorPenaltis = tanda.ganadorId;
                    marcadorTanda = tanda.marcadorTanda;
                }
            }
        } 
        // CASO B: Es el partido de IDA de una serie de Ida y Vuelta
        else if (opcionesEliminatoria && opcionesEliminatoria.esIda) {
            if (estadoPartido.golesLocal === estadoPartido.golesVisitante) {
                estadoPartido.eventos.push({ 
                    minuto: 90, 
                    tipo: 'INFO', 
                    texto: `Final del partido de ida. Todo se decidirá en el partido de vuelta.` 
                });
            }
        }
        // CASO C: Es una eliminatoria a PARTIDO ÚNICO
        else {
            if (estadoPartido.golesLocal === estadoPartido.golesVisitante) {
                estadoPartido.eventos.push({ 
                    minuto: 90, 
                    tipo: 'INFO', 
                    texto: `Empate ${estadoPartido.golesLocal}-${estadoPartido.golesVisitante} en partido único de Copa. ¡Nos vamos a la prórroga!` 
                });

                estadoPartido = simularTramoMinutos(local, visitante, 91, 120, estadoPartido);

                if (estadoPartido.golesLocal === estadoPartido.golesVisitante) {
                    const tanda = simularTandaPenaltis(local, visitante, estadoPartido.eventos);
                    ganadorPenaltis = tanda.ganadorId;
                    marcadorTanda = tanda.marcadorTanda;
                }
            }
        }
    }

    return {
        marcador: { local: estadoPartido.golesLocal, visitante: estadoPartido.golesVisitante },
        posesion: { local: Math.floor(Math.min(99, Math.max(1, estadoPartido.posesionLocal))), visitante: 100 - Math.floor(Math.min(99, Math.max(1, estadoPartido.posesionLocal))) },
        eventos: estadoPartido.eventos,
        ganadorPenaltis: ganadorPenaltis, 
        marcadorTanda: marcadorTanda      
    };
}

module.exports = { simularPartido };