// backend/engine/motorJuego.js

/**
 * Función auxiliar para obtener el valor promedio de ciertos atributos
 * y aplicar el factor de forma física.
 */
function getMedia(jugador, categoria, attrs) {
    let suma = 0;
    attrs.forEach(a => {
        // Accedemos a la estructura anidada: atributos.fisico.velocidad, etc.
        suma += jugador.atributos[categoria][a];
    });
    
    // Si la forma es baja, el rendimiento baja. (Forma 100 = 100%, Forma 50 = 50%)
    const factorForma = (jugador.estado.forma || 100) / 100;
    return (suma / attrs.length) * factorForma;
}

/**
 * Simula un partido minuto a minuto
 * @param {Object} local - Objeto con nombre y array 'jugadores' (titulares)
 * @param {Object} visitante - Objeto con nombre y array 'jugadores' (titulares)
 */
function simularPartido(local, visitante) {
    const eventos = [];
    let golesLocal = 0;
    let golesVisitante = 0;
    
    // Estadísticas básicas
    let posesionLocal = 50; 

    // Bucle del minuto 1 al 90
    for (let minuto = 1; minuto <= 90; minuto++) {
        
        // 1. FASE DE POSESIÓN (Mediocampo)
        // Usamos: Pase Corto, Visión, Control Balón, Resistencia
        const mediaMedioLocal = local.jugadores.reduce((sum, j) => 
            sum + getMedia(j, 'pase', ['paseCorto', 'vision']) + getMedia(j, 'habilidad', ['controlBalon']), 0) / 11;
            
        const mediaMedioVisitante = visitante.jugadores.reduce((sum, j) => 
            sum + getMedia(j, 'pase', ['paseCorto', 'vision']) + getMedia(j, 'habilidad', ['controlBalon']), 0) / 11;

        // Factor aleatorio del 15%
        const azar = (Math.random() * 30) - 15; 
        const dominador = (mediaMedioLocal + azar > mediaMedioVisitante) ? 'local' : 'visitante';
        const equipoAtacante = (dominador === 'local') ? local : visitante;
        const equipoDefensor = (dominador === 'local') ? visitante : local;

        // Actualizar posesión global
        if(dominador === 'local') posesionLocal += 0.5;
        else posesionLocal -= 0.5;

        // 2. FASE DE ATAQUE (Generar Ocasión)
        // Solo ocurre si el random supera un umbral (para que no haya peligro CADA minuto)
        if (Math.random() > 0.85) { // 15% de probabilidad de jugada peligrosa por minuto
            
            // Seleccionar protagonistas
            const atacante = equipoAtacante.jugadores[Math.floor(Math.random() * equipoAtacante.jugadores.length)];
            const defensor = equipoDefensor.jugadores.find(j => j.posicionPrincipal.includes('DF') || j.posicionPrincipal === 'MCD') 
                             || equipoDefensor.jugadores[Math.floor(Math.random() * 11)];

            // Cálculo del Duelo: Regate/Velocidad vs Entradas/Colocación
            const valorAtaque = getMedia(atacante, 'habilidad', ['regate']) + getMedia(atacante, 'fisico', ['velocidad', 'agilidad']);
            const valorDefensa = getMedia(defensor, 'defensa', ['entradas', 'marcaje', 'colocacion']);

            if (valorAtaque * (Math.random() + 0.5) > valorDefensa) {
                // 3. FASE DE TIRO (Delantero vs Portero)
                const portero = equipoDefensor.jugadores.find(j => j.posicionPrincipal === 'POR') || equipoDefensor.jugadores[0];
                
                // Atributos de tiro vs Atributos de portero
                const calidadTiro = getMedia(atacante, 'tiro', ['definicion', 'potenciaTiro']) + getMedia(atacante, 'mental', ['composturaBajoPresion']);
                const calidadPortero = getMedia(portero, 'portero', ['paradas', 'reflejos', 'unoContraUno']);

                // Probabilidad de gol
                // Ajuste: Es difícil marcar. Si calidadTiro == calidadPortero, aprox 30% gol.
                const probabilidadGol = 0.3 + ((calidadTiro - calidadPortero) / 200);

                if (Math.random() < probabilidadGol) {
                    // ¡GOL!
                    if (dominador === 'local') golesLocal++;
                    else golesVisitante++;

                    eventos.push({
                        minuto,
                        tipo: 'GOL',
                        equipo: dominador,
                        texto: `¡GOOOL de ${atacante.nombre}! Definición perfecta ante ${portero.nombre}.`
                    });
                } else {
                    // Parada o fallo
                    eventos.push({
                        minuto,
                        tipo: 'OCASION',
                        equipo: dominador,
                        texto: `¡Uyyy! ${portero.nombre} detiene el disparo de ${atacante.nombre}.`
                    });
                }
            }
        }
    }

    return {
        marcador: { local: golesLocal, visitante: golesVisitante },
        posesion: { local: Math.floor(posesionLocal), visitante: 100 - Math.floor(posesionLocal) },
        eventos: eventos
    };
}

module.exports = { simularPartido };