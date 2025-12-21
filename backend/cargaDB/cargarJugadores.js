const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Partida = require('../models/partida');

// 1. CONFIGURACIÓN DE PLANTILLA BASE
const BASE_FIJA = [
    'POR', 'POR',               // 2 Porteros
    'LD', 'LD', 'LI', 'LI',     // 2 Laterales por banda
    'DFC', 'DFC', 'DFC', 'DFC', // 4 Centrales
    'MCD', 'MC', 'MC', 'MCO',   // 4 Medios
    'MD', 'MI',                 // 2 Interiores/Bandas
    'ED', 'EI', 'DC', 'DC', 'SD' // 5 Atacantes (Total 21)
];

const POSICIONES_EXTRAS = ['LD', 'LI', 'DFC', 'MCD', 'MC', 'MCO', 'MD', 'MI', 'ED', 'EI', 'DC', 'SD', 'POR'];

// 2. DICCIONARIOS DE GENERACIÓN
const NOMBRES = ["Lucas", "Marcos", "Adrian", "Mateo", "Enzo", "Hugo", "Leo", "Thiago", "Gavi", "Iker", "David", "Carlos", "Sergio", "Diego", "Pablo", "Javier"];
const APELLIDOS = ["García", "Rodríguez", "López", "Sánchez", "Pérez", "Gómez", "Fernández", "Díaz", "Torres", "Ruiz", "Vidal", "Mora", "Ortiz", "Serrano"];

/**
 * Función principal para generar el universo de jugadores de una partida
 * @param {ObjectId} partidaId - El ID de la partida recién creada
 */
async function generarJugadoresNuevaPartida(partidaId) {
    try {
        const partidaInfo = await Partida.findById(partidaId).select('nombrePartida');
        const nombrePartida = partidaInfo ? partidaInfo.nombrePartida : partidaId;
        
        const clubes = await Club.find().populate('clubMatriz');
        let todosLosJugadores = [];

        for (const club of clubes) {
            const rep = club.reputacion;
            const repMatriz = (club.esFilial && club.clubMatriz) ? club.clubMatriz.reputacion : rep;
            
            // --- CONSTRUCCIÓN DE PLANTILLA VARIABLE ---
            const numExtras = Math.floor(Math.random() * 3) + 3; // Entre 3 y 5 extras
            let plantilla = [...BASE_FIJA];
            for (let i = 0; i < numExtras; i++) {
                plantilla.push(POSICIONES_EXTRAS[Math.floor(Math.random() * POSICIONES_EXTRAS.length)]);
            }

            // Gestión de dorsales (1-99)
            let dorsalesLibres = Array.from({length: 25}, (_, i) => i + 1); 
            if (plantilla.length > 25) {
                for(let d=26; d<=50; d++) dorsalesLibres.push(d);
            }

            for (let i = 0; i < plantilla.length; i++) {
                const posicion = plantilla[i];
                
                // --- ASIGNACIÓN DE ROLES ---
                let rolContrato = 'suplente';
                let rolInterno = 'ROTACION';

                if (i === 0 || i === 8 || i === 12 || i === 18) {
                    rolContrato = 'clave';
                    rolInterno = 'ESTRELLA';
                } else if (i < 11) {
                    rolContrato = 'importante';
                    rolInterno = 'TITULAR';
                } else if (i > 20) {
                    rolContrato = club.esFilial ? 'promesa' : 'reserva';
                    rolInterno = 'RESERVA';
                }

                const ratings = calcularRatings(rolInterno, rep, repMatriz, club.esFilial);
                const edad = generarEdad(rolInterno, club.esFilial);
                const dorsal = asignarDorsalRealista(posicion, dorsalesLibres);

                todosLosJugadores.push({
                    partidaId: partidaId, // Vínculo con la sesión de juego
                    nombre: `${NOMBRES[Math.floor(Math.random() * NOMBRES.length)]} ${APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)]}`,
                    dorsal: dorsal,
                    edad: edad,
                    nacionalidad: club.pais,
                    posicionPrincipal: posicion,
                    piernaBuena: Math.random() > 0.2 ? 'derecha' : 'izquierda',
                    piernaMala: Math.floor(Math.random() * 4) + 1,
                    versatilidad: Math.floor(Math.random() * 4) + 1,
                    valoracion: ratings.ca,
                    potencial: ratings.pa,
                    rolEquipo: rolContrato,
                    clubActual: club._id,
                    estadoClub: club.esFilial ? 'cantera' : 'primerEquipo',
                    atributos: generarAtributos(posicion, ratings.ca),
                    valorMercado: calcularValorMercado(ratings.ca, ratings.pa, edad),
                    salario: calcularSalario(ratings.ca, rep),
                    estado: { 
                        forma: 100, 
                        moral: Math.floor(Math.random() * 21) + 80, 
                        satisfaccion: 100, 
                        lesion: null 
                    }
                });
            }

            // Insertar por bloques para no colapsar la memoria (cada 1000 jugadores)
            if (todosLosJugadores.length > 1000) {
                await Jugador.insertMany(todosLosJugadores);
                todosLosJugadores = [];
            }
        }

        // Insertar el resto
        if (todosLosJugadores.length > 0) {
            await Jugador.insertMany(todosLosJugadores);
        }

        console.log(`Los jugadores han sido generados para la partida: ${nombrePartida}`);
        return true;
    } catch (err) {
        console.error('Fallo en la generación de jugadores:', err);
        throw err;
    }
}

// --- LÓGICA DE RATINGS (CA/PA) ---
function calcularRatings(rol, rep, repMatriz, esFilial) {
    let ca;
    switch (rol) {
        case 'ESTRELLA': ca = rep + (Math.random() * 5 - 1); break;
        case 'TITULAR':  ca = rep - (Math.random() * 6 + 2); break;
        case 'ROTACION': ca = rep - (Math.random() * 8 + 10); break;
        case 'RESERVA':  ca = rep - (Math.random() * 10 + 18); break;
    }
    ca = Math.min(92, Math.max(15, Math.floor(ca)));

    let pa;
    const probabilidadChicoMaravilla = Math.random() < 0.02; // 2% probabilidad de crack mundial

    if (probabilidadChicoMaravilla) {
        pa = Math.floor(Math.random() * (99 - 88 + 1)) + 88;
    } else if (esFilial) {
        // Filiales heredan el potencial basado en la reputación del primer equipo
        pa = repMatriz + (Math.random() * 15 - 5);
    } else {
        pa = ca + (Math.random() * 15);
    }

    pa = Math.min(99, Math.max(ca, Math.floor(pa)));
    return { ca, pa };
}

// --- ASIGNACIÓN DE DORSALES ---
function asignarDorsalRealista(pos, libres) {
    let pref = [];
    if (pos === 'POR') pref = [1, 13, 25];
    else if (['LD', 'LI', 'DFC'].includes(pos)) pref = [2, 3, 4, 5, 12, 14, 15, 22];
    else if (['MCD', 'MC', 'MCO', 'MD', 'MI'].includes(pos)) pref = [6, 8, 10, 11, 16, 18, 20, 21];
    else pref = [7, 9, 11, 17, 19, 23, 24];

    for (let p of pref) {
        const idx = libres.indexOf(p);
        if (idx !== -1) return libres.splice(idx, 1)[0];
    }
    return libres.splice(0, 1)[0];
}

// --- AUXILIARES DE ATRIBUTOS Y FINANZAS ---
function generarEdad(rol, esFilial) {
    if (esFilial) return Math.floor(Math.random() * 6) + 16; // 16-21 años
    if (rol === 'ESTRELLA') return Math.floor(Math.random() * 10) + 23; // 23-32 años
    return Math.floor(Math.random() * 15) + 18; // 18-33 años
}

function calcularValorMercado(ca, pa, edad) {
    const base = Math.pow(ca / 10, 5.5) * 6000;
    const bonusPotencial = (pa - ca) * 150000;
    let valor = base + bonusPotencial;
    if (edad < 22) valor *= 1.3;
    if (edad > 31) valor *= 0.4;
    return Math.floor(valor / 50000) * 50000;
}

function calcularSalario(ca, rep) {
    const sueldo = Math.pow(ca / 10, 4.5) * (rep / 40) * 1200;
    return Math.floor(sueldo / 12000) * 12000;
}

function generarAtributos(pos, val) {
    const b = () => Math.floor(val * (0.7 + Math.random() * 0.4)); // Atributo base
    const e = () => Math.min(100, Math.floor(val * (0.9 + Math.random() * 0.25))); // Atributo estrella
    const m = () => Math.floor(Math.random() * 6) + 4; // Atributos escala 1-10

    let a = {
        habilidad: { regate: b(), controlBalon: b(), desmarques: b() },
        tiro: { definicion: b(), potenciaTiro: b(), tiroLejano: b(), lanzamientoFaltas: b(), lanzamientoPenaltis: b(), remateCabeza: b() },
        pase: { paseCorto: b(), paseLargo: b(), vision: b(), centros: b() },
        defensa: { marcaje: b(), entradas: b(), intercepciones: b(), despejes: b(), duelosAereos: b(), colocacion: b() },
        fisico: { velocidad: b(), aceleracion: b(), agilidad: b(), fuerza: b(), resistencia: b(), equilibrio: b(), salto: b() },
        mental: { concentracion: m(), liderazgo: b(), agresividad: b(), motivacion: m(), composturaBajoPresion: m() },
        portero: { reflejos: 5, paradas: 5, estirada: 5, juegoAereo: 5, unoContraUno: 5, blocaje: 5, saque: 5, comunicacion: 5, penales: 5 }
    };

    // Especialización por posición
    if (pos === 'POR') Object.keys(a.portero).forEach(k => a.portero[k] = e());
    if (['DFC', 'MCD'].includes(pos)) { a.defensa.marcaje = e(); a.defensa.entradas = e(); a.fisico.fuerza = e(); }
    if (['DC', 'ED', 'EI'].includes(pos)) { a.tiro.definicion = e(); a.fisico.velocidad = e(); a.habilidad.regate = e(); }
    if (['MC', 'MCO'].includes(pos)) { a.pase.vision = e(); a.pase.paseCorto = e(); a.habilidad.controlBalon = e(); }
    
    return a;
}

module.exports = generarJugadoresNuevaPartida;