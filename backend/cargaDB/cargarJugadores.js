const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Partida = require('../models/partida');

// 1. CONFIGURACIÓN DE PLANTILLA BASE
const BASE_FIJA = [
    'POR', 'POR', 'LD', 'LD', 'LI', 'LI', 'DFC', 'DFC', 'DFC', 'DFC', 
    'MCD', 'MC', 'MC', 'MCO', 'MD', 'MI', 'ED', 'EI', 'DC', 'DC', 'SD'
];

const POSICIONES_EXTRAS = ['LD', 'LI', 'DFC', 'MCD', 'MC', 'MCO', 'MD', 'MI', 'ED', 'EI', 'DC', 'SD', 'POR'];

const IDENTIDADES = {
    "España": {
        nombres: ["Hugo", "Mateo", "Lucas", "Leo", "Daniel", "Alejandro", "Pablo", "Álvaro", "Adrián", "David"],
        apellidos: ["García", "Rodríguez", "González", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín"]
    },
    "Brasil": {
        nombres: ["Gabriel", "Lucas", "Matheus", "Guilherme", "Enzo", "Rafael", "Felipe", "Gustavo", "Igor", "Thiago"],
        apellidos: ["Silva", "Dos Santos", "Ferreira", "Pereira", "Oliveira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Melo"]
    },
    "Argentina": {
        nombres: ["Bautista", "Benjamín", "Felipe", "Lautaro", "Joaquín", "Julián", "Facundo", "Nicolás", "Rodrigo", "Tomás"],
        apellidos: ["González", "Rodríguez", "López", "Martínez", "García", "Fernández", "Pérez", "Álvarez", "Romero", "Sosa"]
    },
    "Francia": {
        nombres: ["Gabriel", "Léo", "Raphaël", "Arthur", "Louis", "Lucas", "Adam", "Jules", "Hugo", "Maël"],
        apellidos: ["Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent"]
    },
    "Alemania": {
        nombres: ["Noah", "Leon", "Paul", "Lukas", "Jonas", "Finn", "Elias", "Julian", "Max", "Jakob"],
        apellidos: ["Müller", "Schmidt", "Schneider", "Fischer", "Meyer", "Weber", "Schulz", "Wagner", "Becker", "Hoffmann"]
    },
    "Inglaterra": {
        nombres: ["Oliver", "George", "Harry", "Noah", "Jack", "Leo", "Arthur", "Muhammad", "Oscar", "Charlie"],
        apellidos: ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright"]
    },
    "Italia": {
        nombres: ["Leonardo", "Francesco", "Alessandro", "Lorenzo", "Mattia", "Tommaso", "Gabriele", "Andrea", "Riccardo", "Edoardo"],
        apellidos: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco"]
    },
    "Portugal": {
        nombres: ["Francisco", "João", "Afonso", "Tomas", "Duarte", "Lourenço", "Rodrigo", "Martim", "Tiago", "Diogo"],
        apellidos: ["Silva", "Ferreira", "Pereira", "Oliveira", "Costa", "Santos", "Rodrigues", "Sousa", "Gomes", "Martins"]
    },
    "Países Bajos": {
        nombres: ["Sem", "Liam", "Lucas", "Noah", "Daan", "Levi", "Luuk", "Mees", "Bram", "Milan", "Thijs", "Stijn", "Sven", "Finn", "Jesse"],
        apellidos: ["De Jong", "De Vries", "Van Dijk", "Van de Berg", "Bakker", "Janssen", "Visser", "Smit", "Meijer", "De Boer", "Hendriks", "Vos", "Dekker"]
    },
    "Egipto": {
        nombres: ["Mohamed", "Ahmed", "Mahmoud", "Mostafa", "Youssef", "Ibrahim", "Hassan", "Kareem", "Omar"],
        apellidos: ["Salah", "El-Sayed", "Hassan", "Ibrahim", "Abdel-Rahman", "Mansour", "Ghanem", "Said"]
    },
    "Noruega": {
        nombres: ["Erling", "Magnus", "Olav", "Henrik", "Kristian", "Jakob", "Anders", "Sander", "Marius"],
        apellidos: ["Haaland", "Odegaard", "Larsen", "Nielsen", "Hansen", "Johansen", "Bakke", "Solberg"]
    },
    "Japón": {
        nombres: ["Hiroto", "Ren", "Minato", "Yuma", "Itsuki", "Haruto", "Sota", "Yuto"],
        apellidos: ["Tanaka", "Sato", "Suzuki", "Takahashi", "Watanabe", "Ito", "Nakamura", "Kobayashi"]
    }
};

const IDENTIDAD_GLOBAL = {
    nombres: ["Alex", "Jordan", "Chris", "Sam", "Daniel", "Michael", "Stefan", "Luka"],
    apellidos: ["Jovanovic", "Petrovic", "Ivanov", "Müller", "Smith", "Silva", "Kwon", "Abbas"]
};

const PAISES_EXOTICOS = ["Egipto", "Noruega", "Corea del Sur", "Japón", "Nigeria", "Senegal", "Marruecos", "EEUU", "Polonia", "Grecia"];

async function generarJugadoresNuevaPartida(partidaId) {
    try {
        const partidaInfo = await Partida.findById(partidaId).select('nombrePartida');
        const nombrePartida = partidaInfo ? partidaInfo.nombrePartida : partidaId;
        
        const clubes = await Club.find().populate('clubMatriz');
        let contadorTotal = 0;

        for (const club of clubes) {
            const rep = club.reputacion;
            const repMatriz = (club.esFilial && club.clubMatriz) ? club.clubMatriz.reputacion : rep;
            
            const numExtras = Math.floor(Math.random() * 3) + 3;
            let plantillaBase = [...BASE_FIJA];
            for (let i = 0; i < numExtras; i++) {
                plantillaBase.push(POSICIONES_EXTRAS[Math.floor(Math.random() * POSICIONES_EXTRAS.length)]);
            }

            let dorsalesLibres = Array.from({length: 25}, (_, i) => i + 1); 
            if (plantillaBase.length > 25) {
                for(let d=26; d<=50; d++) dorsalesLibres.push(d);
            }

            let jugadoresDelClub = [];

            for (let i = 0; i < plantillaBase.length; i++) {
                const posicion = plantillaBase[i];
                
                let rolContrato = 'suplente';
                let rolInterno = 'ROTACION';
                if (i === 0 || i === 8 || i === 12 || i === 18) { rolContrato = 'clave'; rolInterno = 'ESTRELLA'; }
                else if (i < 11) { rolContrato = 'importante'; rolInterno = 'TITULAR'; }
                else if (i > 20) { rolContrato = club.esFilial ? 'promesa' : 'reserva'; rolInterno = 'RESERVA'; }

                const ratings = calcularRatings(rolInterno, rep, repMatriz, club.esFilial);
                const edad = generarEdad(rolInterno, club.esFilial);
                const dorsal = asignarDorsalRealista(posicion, dorsalesLibres);
                const fisico = generarFisico(posicion);
                
                // CORRECCIÓN AQUÍ: Llamamos a la identidad coherente
                const identidad = generarIdentidadCompleta(club.pais, rep);

                jugadoresDelClub.push({
                    partidaId: partidaId,
                    nombre: identidad.nombre, // Antes usabas NOMBRES[random]
                    dorsal: dorsal,
                    edad: edad,
                    altura: fisico.altura, 
                    peso: fisico.peso,    
                    nacionalidad: identidad.nacionalidad, // Antes usabas generarNacionalidad antigua
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

            const insertados = await Jugador.insertMany(jugadoresDelClub);
            const idsJugadores = insertados.map(j => j._id);
            await Club.findByIdAndUpdate(club._id, { $set: { plantilla: idsJugadores } });
            contadorTotal += insertados.length;
        }

        console.log(`Se han añadido ${contadorTotal} jugadores en la partida ${nombrePartida}.`);
        return true;
    } catch (err) {
        console.error('Error generación:', err);
        throw err;
    }
}

// --- TODAS LAS FUNCIONES AUXILIARES SE MANTIENEN IGUAL ---

function generarFisico(pos) {
    let minAlt, maxAlt;
    if (pos === 'POR' || pos === 'DFC') { minAlt = 184; maxAlt = 202; }
    else if (pos === 'DC') { minAlt = 178; maxAlt = 195; }
    else if (['LD', 'LI', 'ED', 'EI'].includes(pos)) { minAlt = 168; maxAlt = 185; }
    else { minAlt = 172; maxAlt = 190; }
    const altura = Math.floor(Math.random() * (maxAlt - minAlt + 1)) + minAlt;
    const peso = (altura - 100) + (Math.floor(Math.random() * 11) - 5);
    return { altura, peso };
}

function generarIdentidadCompleta(paisClub, reputacion) {
    let nacionalidad;
    let prob = Math.pow(reputacion / 100, 2.2) * 0.6;
    const finalProb = Math.max(0.05, Math.min(0.55, prob));

    if (Math.random() > finalProb) {
        nacionalidad = paisClub;
    } else {
        if (Math.random() < 0.10) {
            nacionalidad = PAISES_EXOTICOS[Math.floor(Math.random() * PAISES_EXOTICOS.length)];
        } else {
            const paisesDisponibles = Object.keys(IDENTIDADES).filter(p => p !== paisClub);
            nacionalidad = paisesDisponibles[Math.floor(Math.random() * paisesDisponibles.length)];
        }
    }
    const pool = IDENTIDADES[nacionalidad] || IDENTIDAD_GLOBAL;
    const nombre = pool.nombres[Math.floor(Math.random() * pool.nombres.length)];
    const apellido = pool.apellidos[Math.floor(Math.random() * pool.apellidos.length)];

    return { nombre: `${nombre} ${apellido}`, nacionalidad };
}

function calcularRatings(rol, rep, repMatriz, esFilial) {
    let ca;
    if (esFilial) {
        ca = (repMatriz * 0.45) + (Math.random() * 12 + 8);
    } else {
        if (rol === 'ESTRELLA') ca = rep + (Math.random() * 3);
        else if (rol === 'TITULAR') ca = rep - (Math.random() * 5 + 2);
        else if (rol === 'ROTACION') ca = rep - (Math.random() * 7 + 10);
        else ca = rep - (Math.random() * 10 + 18);
    }
    ca = Math.max(15, Math.floor(ca));

    let pa;
    if (esFilial) {
        const factorAcademia = repMatriz / 100; 


        if (suerteTalento > (1 - (0.01 + factorAcademia * 0.04))) { 
            pa = 88 + (Math.random() * 8);
        } 
        else if (suerteTalento > (1 - (0.05 + factorAcademia * 0.15))) {
            pa = 78 + (Math.random() * 9); 
        } 
        else {
            const sueloPotencial = (repMatriz * 0.55) + 15;
            pa = sueloPotencial + (Math.random() * 15);
        }
    } else {
        pa = ca + (Math.random() * 8);
    }

    return { 
        ca: Math.floor(ca), 
        pa: Math.min(99, Math.max(Math.floor(ca), Math.floor(pa))) 
    };
}

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

function generarEdad(rol, esFilial) {
    if (esFilial) return Math.floor(Math.random() * 6) + 16;
    if (rol === 'ESTRELLA') return Math.floor(Math.random() * 10) + 23;
    return Math.floor(Math.random() * 15) + 18;
}

function calcularValorMercado(ca, pa, edad) {
    let valor = Math.pow(ca / 10, 4) * 11000 + (pa - ca) * 110000;
    if (edad >= 22 && edad <= 28) valor *= 1.4;
    else if (edad > 32) valor *= 0.3;
    if (valor > 180000000) valor = 170000000 + (Math.random() * 25000000);
    return Math.floor(valor / 100000) * 100000;
}

function calcularSalario(ca, rep) {
    const sueldo = Math.pow(ca / 10, 4.5) * (rep / 40) * 1200;
    return Math.floor(sueldo / 12000) * 12000;
}

function generarAtributos(pos, val) {
    const capInicio = Math.min(92, val + 15);
    const b = () => Math.floor(val * (0.65 + Math.random() * 0.2)); 
    const e = () => {
        const dispersion = (Math.random() * 20) - 5; 
        let resultado = val + dispersion;
        return Math.min(capInicio, Math.floor(resultado));
    };
    const i = () => Math.floor(val * (0.15 + Math.random() * 0.35));
    const m = () => Math.floor(Math.random() * 6) + 4;

    let a = {
        habilidad: { regate: i(), controlBalon: i(), desmarques: i() },
        tiro: { definicion: i(), potenciaTiro: b(), tiroLejano: i(), lanzamientoFaltas: i(), lanzamientoPenaltis: i(), remateCabeza: i() },
        pase: { paseCorto: b(), paseLargo: b(), vision: i(), centros: i() },
        defensa: { marcaje: i(), entradas: i(), intercepciones: i(), despejes: i(), duelosAereos: i(), colocacion: i() },
        fisico: { velocidad: b(), aceleracion: b(), agilidad: b(), fuerza: b(), resistencia: b(), equilibrio: b(), salto: b() },
        mental: { concentracion: m(), liderazgo: b(), agresividad: b(), motivacion: m(), composturaBajoPresion: m() },
        portero: { reflejos: 1, paradas: 1, estirada: 1, juegoAereo: 1, unoContraUno: 1, blocaje: 1, saque: 1, comunicacion: 1, penales: 1 }
    };

    if (pos === 'POR') {
        Object.keys(a.portero).forEach(k => a.portero[k] = e());
        a.pase.paseLargo = b();
        a.habilidad.controlBalon = Math.floor(val * 0.25);
    } 
    else if (['DFC', 'MCD'].includes(pos)) {
        a.defensa.marcaje = e(); a.defensa.entradas = e(); a.defensa.intercepciones = e();
        a.defensa.duelosAereos = e(); a.fisico.fuerza = e();
    } 
    else if (['DC', 'SD'].includes(pos)) {
        a.tiro.definicion = e(); a.tiro.remateCabeza = e();
        a.habilidad.desmarques = e(); a.fisico.aceleracion = e();
    } 
    else if (['ED', 'EI', 'MD', 'MI'].includes(pos)) {
        a.habilidad.regate = e(); a.fisico.velocidad = e(); a.pase.centros = e();
    } 
    else if (['MC', 'MCO'].includes(pos)) {
        a.pase.vision = e(); a.pase.paseCorto = e(); 
        a.habilidad.controlBalon = e(); a.habilidad.desmarques = b();
    }
    else if (['LD', 'LI'].includes(pos)) {
        a.fisico.resistencia = e(); a.pase.centros = e(); a.defensa.entradas = b();
    }
    return a;
}

module.exports = generarJugadoresNuevaPartida;