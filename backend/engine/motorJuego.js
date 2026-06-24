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
// backend/engine/motorJuego.js

// ... (getMedia, aplicarCansancio, buscarJugadorPorPosicion y obtenerLiderazgoEquipo se quedan exactamente igual)

/**
 * SUB-MOTOR: Simula un tramo específico de minutos (ej: 1-90 o 91-120)
 * Reutiliza toda tu lógica de atributos, cansancio y eventos.
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

        const bonusLocal = (obtenerLiderazgoEquipo(local) * 0.05) + (getMedia(local.jugadores.find(j=>j.posicionPrincipal==='POR')||local.jugadores[0], 'portero', ['comunicacion']) * 0.05);
        const bonusVisitante = (obtenerLiderazgoEquipo(visitante) * 0.05) + (getMedia(visitante.jugadores.find(j=>j.posicionPrincipal==='POR')||visitante.jugadores[0], 'portero', ['comunicacion']) * 0.05);

        const controlLocal = creacionLocal + intercepcionesLocal + bonusLocal + momentumLocal + 5; 
        const controlVisitante = creacionVisitante + intercepcionesVisitante + bonusVisitante + momentumVisitante;

        momentumLocal = 0;
        momentumVisitante = 0;

        const dominador = (controlLocal + (Math.random() * 20 - 10) > controlVisitante) ? 'local' : 'visitante';
        const atacanteTeam = (dominador === 'local') ? local : visitante;
        const defensorTeam = (dominador === 'local') ? visitante : local;

        if(dominador === 'local') posesionLocal += 0.4; else posesionLocal -= 0.4;

        // --- 2. FASE DE CREACIÓN ---
        const generador = buscarJugadorPorPosicion(atacanteTeam, ['MC', 'MCO', 'MD', 'MI']);
        const receptor = buscarJugadorPorPosicion(atacanteTeam, ['DC', 'SD', 'ED', 'EI']);
        const stopper = buscarJugadorPorPosicion(defensorTeam, ['MCD', 'DFC']);

        const calidadPaseHueco = getMedia(generador, 'pase', ['vision', 'paseLargo']) + getMedia(receptor, 'habilidad', ['desmarques']);
        const calidadCorte = getMedia(stopper, 'defensa', ['intercepciones', 'colocacion', 'anticipacion'] || ['intercepciones', 'colocacion']);

        const umbralPeligro = 0.85 - ((calidadPaseHueco - calidadCorte) / 1000); 

        if (Math.random() > umbralPeligro) {
            // --- 3. FASE DE DEFINICIÓN ---
            const tipoJugada = Math.random();
            const porteroRival = defensorTeam.jugadores.find(j => j.posicionPrincipal === 'POR') || defensorTeam.jugadores[0];
            let gol = false;
            let relato = "";
            let protagonista = receptor;

            // [Tus lógicas de definición actuales: A) Juego Aéreo, B) Penalti en juego, C) Tiro lejano, D) Mano a mano]
            // (Para ahorrar espacio mantengo tu código intacto aquí dentro en tu archivo real)
            // ... Lógica de jugadas ...

            if (relato) {
                if (gol) {
                    if (dominador === 'local') golesLocal++; else golesVisitante++;
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

    // Devolvemos el estado actualizado tras el tramo de minutos jugado
    return { golesLocal, golesVisitante, posesionLocal, momentumLocal, momentumVisitante, eventos };
}

/**
 * TANDA DE PENALTIS ESTADÍSTICA (La lotería basada en atributos)
 */
function simularTandaPenaltis(local, visitante, eventos) {
    eventos.push({ minuto: 120, tipo: 'INFO', texto: "¡Final del partido! El ganador se decidirá en la tanda de penaltis." });

    // Ordenamos tiradores: los que tengan mejor atributo de penaltis patean primero
    const tiradoresLocal = [...local.jugadores].sort((a,b) => b.atributos.tiro.lanzamientoPenaltis - a.atributos.tiro.lanzamientoPenaltis);
    const tiradoresVisitante = [...visitante.jugadores].sort((a,b) => b.atributos.tiro.lanzamientoPenaltis - a.atributos.tiro.lanzamientoPenaltis);

    const porLocal = local.jugadores.find(j => j.posicionPrincipal === 'POR') || local.jugadores[0];
    const porVisitante = visitante.jugadores.find(j => j.posicionPrincipal === 'POR') || visitante.jugadores[0];

    let penaltisLocalLogrados = 0;
    let penaltisVisitanteLogrados = 0;
    
    let ronda = 0;
    let ganadorPenaltis = null;

    // Ejecutamos tandas hasta romper la igualdad reglamentaria o muerte súbita
    while (!ganadorPenaltis) {
        ronda++;
        
        // Tirador local actual (bucle infinito sobre la plantilla si se acaban)
        const tLocal = tiradoresLocal[(ronda - 1) % tiradoresLocal.length];
        const tVisitante = tiradoresVisitante[(ronda - 1) % tiradoresVisitante.length];

        // 1. LANZAMIENTO LOCAL
        let golLocal = ejecutarPenaltiIndividual(tLocal, porVisitante);
        if (golLocal) {
            penaltisLocalLogrados++;
            eventos.push({ minuto: 120, tipo: 'PENALTI_TANDA', equipo: 'local', texto: `✅ Gol de ${tLocal.nombre} para el equipo local.` });
        } else {
            eventos.push({ minuto: 120, tipo: 'PENALTI_TANDA', equipo: 'local', texto: `❌ ${tLocal.nombre} falla su lanzamiento (parada o fuera).` });
        }

        // 2. LANZAMIENTO VISITANTE
        let golVisitante = ejecutarPenaltiIndividual(tVisitante, porLocal);
        if (golVisitante) {
            penaltisVisitanteLogrados++;
            eventos.push({ minuto: 120, tipo: 'PENALTI_TANDA', equipo: 'visitante', texto: `✅ Gol de ${tVisitante.nombre} para el equipo visitante.` });
        } else {
            eventos.push({ minuto: 120, tipo: 'PENALTI_TANDA', equipo: 'visitante', texto: `❌ ${tVisitante.nombre} falla su lanzamiento.` });
        }

        // Criterio de parada: Mínimo 5 lanzamientos por equipo antes de evaluar muerte súbita
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

/**
 * Enfrentamiento matemático Tirador vs Portero
 */
function ejecutarPenaltiIndividual(tirador, portero) {
    // Calidad del tiro afectada por los nervios (Math.random bajo)
    const nivelTirador = getMedia(tirador, 'tiro', ['lanzamientoPenaltis']) + getMedia(tirador, 'mental', ['composturaBajoPresion']) * 0.5;
    const nivelPortero = getMedia(portero, 'portero', ['penales', 'reflejos', 'estirada']);

    // Factor lotería/suerte (Modificadores aleatorios)
    const suerteTirador = Math.random() * 40 + 60; // entre 60 y 100
    const suertePortero = Math.random() * 40 + 50; // entre 50 y 90 (ligera ventaja histórica al tirador)

    // Un 5% de las veces va fuera directamente independientemente del portero (puro nervio)
    if (Math.random() < 0.05) return false;

    return (nivelTirador * suerteTirador) > (nivelPortero * suertePortero);
}

/**
 * MOTOR DE SIMULACIÓN PRINCIPAL ENTRADA
 */
function simularPartido(local, visitante, tipoPartido = 'LIGA') {
    let estadoPartido = {
        golesLocal: 0,
        golesVisitante: 0,
        posesionLocal: 50,
        momentumLocal: 0,
        momentumVisitante: 0,
        eventos: []
    };

    // 1. SIMULAR PRIMEROS 90 MINUTOS
    estadoPartido = simularTramoMinutos(local, visitante, 1, 90, estadoPartido);

    let ganadorPenaltis = null;
    let marcadorTanda = null;

    // 2. ¿NECESITA PRÓRROGA?
    if ((tipoPartido === 'ELIMINATORIA' || tipoPartido === 'FINAL') && estadoPartido.golesLocal === estadoPartido.golesVisitante) {
        estadoPartido.eventos.push({ minuto: 90, tipo: 'INFO', texto: `Empate ${estadoPartido.golesLocal}-${estadoPartido.golesVisitante}. ¡Nos vamos a la prórroga!` });
        
        // Simula del 91 al 120 con la misma exactitud futbolística
        estadoPartido = simularTramoMinutos(local, visitante, 91, 120, estadoPartido);

        // 3. ¿SÍGUEN EMPATADOS? -> TANDA DE PENALTIS STATS
        if (estadoPartido.golesLocal === estadoPartido.golesVisitante) {
            const tanda = simularTandaPenaltis(local, visitante, estadoPartido.eventos);
            ganadorPenaltis = tanda.ganadorId;
            marcadorTanda = tanda.marcadorTanda;
        }
    }

    return {
        marcador: { local: estadoPartido.golesLocal, visitante: estadoPartido.golesVisitante },
        posesion: { local: Math.floor(Math.min(99, Math.max(1, estadoPartido.posesionLocal))), visitante: 100 - Math.floor(Math.min(99, Math.max(1, estadoPartido.posesionLocal))) },
        eventos: estadoPartido.eventos,
        ganadorPenaltis: ganadorPenaltis, // Enviará el ID del club ganador
        marcadorTanda: marcadorTanda      // Por si quieres renderizar los penaltis en el front
    };
}

module.exports = { simularPartido };