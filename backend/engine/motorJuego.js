// backend/engine/motorJuego.js

/**
 * Obtiene el valor de un atributo o media de varios, aplicando el factor de forma (cansancio).
 */
function getMedia(jugador, categoria, attrs) {
    let suma = 0;
    attrs.forEach(a => {
        if (jugador.atributos[categoria] && jugador.atributos[categoria][a] !== undefined) {
            suma += jugador.atributos[categoria][a];
        } else {
            suma += 50; 
        }
    });
    
    // El cansancio afecta exponencialmente: menos de 50 de forma es crítico.
    const forma = jugador.estado.forma || 100;
    const factorForma = Math.max(0.5, forma / 100); 
    
    return (suma / attrs.length) * factorForma;
}

/**
 * Reduce la energía de los jugadores basándose en su resistencia y motivación.
 */
function aplicarCansancio(equipo) {
    equipo.jugadores.forEach(j => {
        const resistencia = j.atributos.fisico.resistencia;
        const motivacion = j.atributos.mental.motivacion;
        
        // Jugadores motivados se cansan un poco menos (sacan fuerzas de flaqueza)
        const factorMente = 1 - ((motivacion - 50) / 500); // Pequeña bonificación
        
        // Desgaste base
        const perdida = (0.7 - (resistencia * 0.005)) * factorMente; 
        j.estado.forma = Math.max(0, j.estado.forma - perdida);
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
    // Buscamos el jugador con más liderazgo
    const lider = equipo.jugadores.reduce((prev, current) => 
        (prev.atributos.mental.liderazgo > current.atributos.mental.liderazgo) ? prev : current
    );
    return lider.atributos.mental.liderazgo;
}

/**
 * MOTOR DE SIMULACIÓN COMPLETO (TODOS LOS ATRIBUTOS)
 */
function simularPartido(local, visitante) {
    const eventos = [];
    let golesLocal = 0;
    let golesVisitante = 0;
    let posesionLocal = 50; 

    // Bonificadores de posesión temporales (por saques de portero, robos, etc)
    let momentumLocal = 0;
    let momentumVisitante = 0;

    for (let minuto = 1; minuto <= 90; minuto++) {
        
        // --- 0. FASE FÍSICA Y MENTAL ---
        aplicarCansancio(local);
        aplicarCansancio(visitante);

        // --- 1. FASE DE ESTRATEGIA (POSESIÓN) ---
        // Aquí usamos atributos tácticos y mentales globales
        // Intercepciones vs Visión: la batalla táctica
        
        // Sumamos intercepciones de la defensa para cortar juego
        const intercepcionesLocal = local.jugadores.reduce((s, j) => s + getMedia(j, 'defensa', ['intercepciones', 'colocacion']), 0) / 11;
        const intercepcionesVisitante = visitante.jugadores.reduce((s, j) => s + getMedia(j, 'defensa', ['intercepciones', 'colocacion']), 0) / 11;

        // Sumamos visión y pase del equipo
        const creacionLocal = local.jugadores.reduce((s, j) => s + getMedia(j, 'pase', ['vision', 'paseCorto', 'paseLargo']), 0) / 11;
        const creacionVisitante = visitante.jugadores.reduce((s, j) => s + getMedia(j, 'pase', ['vision', 'paseCorto', 'paseLargo']), 0) / 11;

        // Factores extra: Liderazgo y Comunicación del Portero
        const bonusLocal = (obtenerLiderazgoEquipo(local) * 0.05) + (getMedia(local.jugadores.find(j=>j.posicionPrincipal==='POR')||local.jugadores[0], 'portero', ['comunicacion']) * 0.05);
        const bonusVisitante = (obtenerLiderazgoEquipo(visitante) * 0.05) + (getMedia(visitante.jugadores.find(j=>j.posicionPrincipal==='POR')||visitante.jugadores[0], 'portero', ['comunicacion']) * 0.05);

        // Cálculo final de control
        const controlLocal = creacionLocal + intercepcionesLocal + bonusLocal + momentumLocal + 5; // +5 factor campo
        const controlVisitante = creacionVisitante + intercepcionesVisitante + bonusVisitante + momentumVisitante;

        // Reset momentum
        momentumLocal = 0;
        momentumVisitante = 0;

        const dominador = (controlLocal + (Math.random() * 20 - 10) > controlVisitante) ? 'local' : 'visitante';
        const atacanteTeam = (dominador === 'local') ? local : visitante;
        const defensorTeam = (dominador === 'local') ? visitante : local;

        // Actualizar % visual
        if(dominador === 'local') posesionLocal += 0.4; else posesionLocal -= 0.4;

        // --- 2. FASE DE CREACIÓN (¿Hay peligro?) ---
        // Usamos Desmarques vs Colocación
        const generador = buscarJugadorPorPosicion(atacanteTeam, ['MC', 'MCO', 'MD', 'MI']);
        const receptor = buscarJugadorPorPosicion(atacanteTeam, ['DC', 'SD', 'ED', 'EI']);
        const stopper = buscarJugadorPorPosicion(defensorTeam, ['MCD', 'DFC']);

        const calidadPaseHueco = getMedia(generador, 'pase', ['vision', 'paseLargo']) + getMedia(receptor, 'habilidad', ['desmarques']);
        const calidadCorte = getMedia(stopper, 'defensa', ['intercepciones', 'colocacion', 'anticipacion'] || ['intercepciones', 'colocacion']); // Si no existe anticipacion, usa colocacion

        // Probabilidad base de ocasión: 15% 
        // Modificada por la calidad del pase vs el corte
        const umbralPeligro = 0.85 - ((calidadPaseHueco - calidadCorte) / 1000); 

        if (Math.random() > umbralPeligro) {
            
            // --- 3. FASE DE DEFINICIÓN (Tipos de jugada) ---
            const tipoJugada = Math.random();
            const porteroRival = defensorTeam.jugadores.find(j => j.posicionPrincipal === 'POR') || defensorTeam.jugadores[0];
            let gol = false;
            let relato = "";
            let protagonista = receptor;

            // A) JUEGO AÉREO (Centros)
            if (tipoJugada < 0.30) {
                const extremo = buscarJugadorPorPosicion(atacanteTeam, ['ED', 'EI', 'LD', 'LI']);
                const lateral = buscarJugadorPorPosicion(defensorTeam, ['LD', 'LI', 'DFC']);
                
                // Duelo Banda: Velocidad/Regate vs Velocidad/Entrada
                const ataqueBanda = getMedia(extremo, 'fisico', ['velocidad', 'aceleracion']) + getMedia(extremo, 'habilidad', ['regate']);
                const defensaBanda = getMedia(lateral, 'fisico', ['velocidad']) + getMedia(lateral, 'defensa', ['entradas']);

                if (ataqueBanda > defensaBanda) {
                    // CENTRO
                    const rematador = buscarJugadorPorPosicion(atacanteTeam, ['DC', 'DFC']); // Centrales suben
                    const central = buscarJugadorPorPosicion(defensorTeam, ['DFC']);

                    const valorRemate = getMedia(rematador, 'tiro', ['remateCabeza']) + getMedia(rematador, 'fisico', ['salto', 'fuerza']);
                    const valorDefensa = getMedia(central, 'defensa', ['duelosAereos', 'despejes']) + getMedia(central, 'fisico', ['salto', 'fuerza']);
                    const salidaGK = getMedia(porteroRival, 'portero', ['juegoAereo', 'salto']);

                    if (valorRemate > (valorDefensa + salidaGK)/1.6) {
                        if (Math.random() < 0.30) { 
                            gol = true;
                            relato = `¡Cabezazo inapelable de ${rematador.nombre} tras centro de ${extremo.nombre}!`;
                            protagonista = rematador;
                        } else {
                            relato = `¡Uyyy! El cabezazo de ${rematador.nombre} se va por poco.`;
                        }
                    } else {
                        // Despeje de la defensa
                        relato = `Centro peligroso de ${extremo.nombre} despejado por ${central.nombre}.`;
                    }
                }
            }

            // B) PENALTI (Nuevo)
            else if (tipoJugada < 0.35) {
                // Pequeña probabilidad de penalti
                const defensa = buscarJugadorPorPosicion(defensorTeam, ['DFC']);
                if (getMedia(defensa, 'mental', ['agresividad']) > 70 && getMedia(defensa, 'defensa', ['entradas']) < 60) {
                    // Defensa agresivo y torpe = Penalti
                    const lanzador = atacanteTeam.jugadores.reduce((p, c) => (p.atributos.tiro.lanzamientoPenaltis > c.atributos.tiro.lanzamientoPenaltis) ? p : c);
                    
                    const calidadPenalti = getMedia(lanzador, 'tiro', ['lanzamientoPenaltis', 'definicion']) + getMedia(lanzador, 'mental', ['composturaBajoPresion']);
                    const calidadParada = getMedia(porteroRival, 'portero', ['penales', 'reflejos', 'estirada']);

                    relato = `¡PENALTI! ${defensa.nombre} derriba al rival dentro del área. Va a lanzar ${lanzador.nombre}...`;
                    
                    if (calidadPenalti * (Math.random() + 0.5) > calidadParada) {
                        gol = true;
                        relato += ` ¡GOOOL! Transforma la pena máxima con sangre fría.`;
                        protagonista = lanzador;
                    } else {
                        relato += ` ¡LO PARÓ! ${porteroRival.nombre} adivina la intención y salva a su equipo.`;
                        // Momentum para el equipo que para el penalti
                        if(dominador === 'local') momentumVisitante += 20; else momentumLocal += 20;
                    }
                }
            }

            // C) TIRO LEJANO
            else if (tipoJugada < 0.55) {
                const tirador = buscarJugadorPorPosicion(atacanteTeam, ['MC', 'MCO', 'ED', 'EI']);
                const tiroVal = getMedia(tirador, 'tiro', ['tiroLejano', 'potenciaTiro']);
                const gkVal = getMedia(porteroRival, 'portero', ['estirada', 'colocacion']);

                if (tiroVal > gkVal && Math.random() < 0.2) {
                    gol = true;
                    relato = `¡GOLAZO! ${tirador.nombre} revienta la red desde 30 metros.`;
                    protagonista = tirador;
                } else if (tiroVal > gkVal - 10) {
                    // Comprobamos si hay REBOTE (Blocaje)
                    const blocaje = getMedia(porteroRival, 'portero', ['blocaje']);
                    if (blocaje < 60 && Math.random() < 0.5) {
                        relato = `¡${porteroRival.nombre} no logra blocar el tiro de ${tirador.nombre}!`;
                        // Segunda jugada... (simplificada: 50% gol de rebote)
                        const cazagoles = buscarJugadorPorPosicion(atacanteTeam, ['DC']);
                        if(Math.random() < 0.4) {
                            gol = true;
                            relato += ` ¡Y ${cazagoles.nombre} aprovecha el rechace para marcar!`;
                            protagonista = cazagoles;
                        } else {
                            relato += ` Pero la defensa despeja el balón suelto.`;
                        }
                    } else {
                        relato = `Buen disparo de ${tirador.nombre} que atrapa ${porteroRival.nombre} con seguridad.`;
                        // Bonus de SAQUE para contraataque
                        const saque = getMedia(porteroRival, 'portero', ['saque']);
                        if (dominador === 'local') momentumVisitante += saque / 10; else momentumLocal += saque / 10;
                    }
                }
            }

            // D) JUGADA COMBINADA (Mano a mano)
            else {
                const atacante = buscarJugadorPorPosicion(atacanteTeam, ['DC', 'SD', 'MCO']);
                const defensa = buscarJugadorPorPosicion(defensorTeam, ['DFC', 'MCD']);

                // Regate vs Entrada
                const ataque = getMedia(atacante, 'habilidad', ['regate', 'controlBalon', 'agilidad']);
                const def = getMedia(defensa, 'defensa', ['entradas', 'marcaje']) + getMedia(defensa, 'fisico', ['equilibrio']);

                if (ataque * (Math.random()+0.4) > def) {
                    // Mano a mano
                    const definicion = getMedia(atacante, 'tiro', ['definicion']) + getMedia(atacante, 'mental', ['composturaBajoPresion']);
                    const parada = getMedia(porteroRival, 'portero', ['unoContraUno', 'reflejos']);

                    if (definicion * (Math.random()+0.3) > parada) {
                        gol = true;
                        relato = `¡GOL! ${atacante.nombre} se planta solo ante el portero y no perdona.`;
                        protagonista = atacante;
                    } else {
                        relato = `¡Milagro de ${porteroRival.nombre}! Salva el mano a mano contra ${atacante.nombre}.`;
                    }
                } else {
                    // ¿Falta táctica?
                    if (getMedia(defensa, 'mental', ['agresividad']) > 80 && Math.random() < 0.15) {
                        relato = `Entrada muy dura de ${defensa.nombre} sobre ${atacante.nombre}. Tarjeta amarilla.`;
                        // Tiro libre directo
                        const lanzador = atacanteTeam.jugadores.reduce((p, c) => (p.atributos.tiro.lanzamientoFaltas > c.atributos.tiro.lanzamientoFaltas) ? p : c);
                        if (getMedia(lanzador, 'tiro', ['lanzamientoFaltas']) > getMedia(porteroRival, 'portero', ['estirada']) && Math.random() < 0.15) {
                            gol = true;
                            relato += ` ¡Y GOL DE FALTA DIRECTA de ${lanzador.nombre}!`;
                            protagonista = lanzador;
                        }
                    }
                }
            }

            // --- REGISTRO DEL EVENTO ---
            if (relato) {
                if (gol) {
                    if (dominador === 'local') golesLocal++;
                    else golesVisitante++;
                    
                    eventos.push({
                        minuto, tipo: 'GOL', equipo: dominador, texto: relato,
                        jugador: protagonista ? protagonista.nombre : 'Desconocido'
                    });
                } else {
                    eventos.push({ minuto, tipo: 'OCASION', equipo: dominador, texto: relato });
                }
            }
        }
    }

    return {
        marcador: { local: golesLocal, visitante: golesVisitante },
        posesion: { local: Math.floor(Math.min(99, Math.max(1, posesionLocal))), visitante: 100 - Math.floor(Math.min(99, Math.max(1, posesionLocal))) },
        eventos: eventos
    };
}

module.exports = { simularPartido };