const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Partida = require('../models/partida');

// 1. CONFIGURACIÓN DE PLANTILLA BASE
const ARQUETIPOS = {
    POR: ['CASILLAS', 'COURTOIS', 'TER_STEGEN', 'DIBU', 'ALISSON'],
    LD: ['ROBERTO_CARLOS', 'MARCELO', 'JORDI_ALBA', 'MENDY', 'ARNOLD_LAHM', 'HAKIMI_MENDES', 'CARVAJAL'],
    LI: ['ROBERTO_CARLOS', 'MARCELO', 'JORDI_ALBA', 'MENDY', 'ARNOLD_LAHM', 'HAKIMI_MENDES', 'CARVAJAL'],
    DFC: ['PIQUE', 'RAMOS', 'PEPE', 'VARANE', 'MAGUIRE', 'KOEMAN', 'NACHO'],
    MCD: ['BUSQUETS_ALONSO', 'CASEMIRO', 'KANTE', 'RODRI'],
    MC: ['XAVI_KROOS', 'INIESTA_MODRIC', 'VALVERDE'],
    MCO: ['BELLINGHAM', 'OZIL', 'DYBALA', 'POTENTE', 'DE_BRUYNE'],
    SD: ['BELLINGHAM', 'DYBALA', 'RAUL'],
    ED: ['MESSI', 'CRISTIANO', 'BALE', 'VINI', 'RONALDINHO', 'GREALISH'],
    EI: ['MESSI', 'CRISTIANO', 'BALE', 'VINI', 'RONALDINHO', 'GREALISH'],
    MD: ['BALE', 'GREALISH', 'VINI'],
    MI: ['BALE', 'GREALISH', 'VINI'],
    DC: ['LEWAN_SUAREZ', 'BENZEMA', 'MBAPPE_RONALDO', 'HAALAND', 'JOSELU_LLORENTE', 'MURIQI', 'RAUL']
};
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
            if (plantillaBase.length > 25) { for(let d=26; d<=50; d++) dorsalesLibres.push(d); }

            let jugadoresDelClub = [];

            for (let i = 0; i < plantillaBase.length; i++) {
                const posicion = plantillaBase[i];
                let rolContrato = 'suplente';
                let rolInterno = 'ROTACION';
                if (i === 0 || i === 8 || i === 12 || i === 18) { rolContrato = 'clave'; rolInterno = 'ESTRELLA'; }
                else if (i < 11) { rolContrato = 'importante'; rolInterno = 'TITULAR'; }
                else if (i > 20) { rolContrato = club.esFilial ? 'promesa' : 'reserva'; rolInterno = 'RESERVA'; }

                const listaArq = ARQUETIPOS[posicion] || ['NACHO'];
                const arquetipo = listaArq[Math.floor(Math.random() * listaArq.length)];

                const ratings = calcularRatings(rolInterno, rep, repMatriz, club.esFilial);
                const edad = generarEdad(rolInterno, club.esFilial);
                const fisico = generarFisico(posicion, arquetipo);
                const identidad = generarIdentidadCompleta(club.pais, rep);
                const dorsal = asignarDorsalRealista(posicion, dorsalesLibres);

                jugadoresDelClub.push({
                    partidaId,
                    nombre: identidad.nombre,
                    dorsal,
                    edad,
                    altura: fisico.altura, 
                    peso: fisico.peso,    
                    nacionalidad: identidad.nacionalidad,
                    posicionPrincipal: posicion,
                    piernaBuena: Math.random() > 0.2 ? 'derecha' : 'izquierda',
                    piernaMala: Math.floor(Math.random() * 4) + 1,
                    versatilidad: Math.floor(Math.random() * 4) + 1,
                    valoracion: ratings.ca,
                    potencial: ratings.pa,
                    rolEquipo: rolContrato,
                    clubActual: club._id,
                    estadoClub: club.esFilial ? 'cantera' : 'primerEquipo',
                    atributos: generarAtributos(posicion, ratings.ca, arquetipo),
                    valorMercado: calcularValorMercado(ratings.ca, ratings.pa, edad),
                    salario: calcularSalario(ratings.ca, rep),
                    estado: { forma: 100, moral: Math.floor(Math.random() * 21) + 80, satisfaccion: 100, lesion: null }
                });
            }

            const insertados = await Jugador.insertMany(jugadoresDelClub);
            const idsJugadores = insertados.map(j => j._id);
            await Club.findByIdAndUpdate(club._id, { $set: { plantilla: idsJugadores } });
            contadorTotal += insertados.length;
        }
        console.log(`Se han añadido ${contadorTotal} jugadores.`);
        return true;
    } catch (err) { console.error(err); throw err; }
}

function generarFisico(pos, arquetipo) {
    let minAlt = 172, maxAlt = 190;
    const rangos = {
        'CASILLAS': [184, 190], 'COURTOIS': [195, 202], 'TER_STEGEN': [188, 195], 'DIBU': [184, 202], 'ALISSON': [184, 202],
        'ROBERTO_CARLOS': [168, 185], 'MARCELO': [168, 175], 'JORDI_ALBA': [168, 185], 'MENDY': [175, 184], 'ARNOLD_LAHM': [173, 182], 'HAKIMI_MENDES': [178, 184], 'CARVAJAL': [170, 182],
        'PIQUE': [184, 193], 'RAMOS': [184, 193], 'PEPE': [184, 193], 'VARANE': [184, 190], 'MAGUIRE': [191, 202], 'KOEMAN': [184, 190], 'NACHO': [180, 188],
        'BUSQUETS_ALONSO': [184, 195], 'CASEMIRO': [184, 195], 'KANTE': [170, 184], 'RODRI': [182, 195],
        'XAVI_KROOS': [173, 185], 'INIESTA_MODRIC': [170, 182], 'VALVERDE': [180, 188],
        'BELLINGHAM': [185, 190], 'OZIL': [168, 180], 'DYBALA': [168, 182], 'POTENTE': [175, 184], 'DE_BRUYNE': [175, 185],
        'MESSI': [168, 175], 'CRISTIANO': [175, 185], 'BALE': [175, 185], 'VINI': [168, 182], 'RONALDINHO': [168, 182], 'GREALISH': [175, 184],
        'LEWAN_SUAREZ': [180, 187], 'BENZEMA': [180, 187], 'MBAPPE_RONALDO': [178, 184], 'HAALAND': [188, 195], 'JOSELU_LLORENTE': [190, 195], 'MURIQI': [190, 195], 'RAUL': [178, 184]
    };
    if (rangos[arquetipo]) { [minAlt, maxAlt] = rangos[arquetipo]; }
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
    const suerteTalento = Math.random();
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

function generarAtributos(pos, val, arquetipo) {
    const MAX_INICIAL = 96;
    // tB (Técnico Base): El estándar del jugador. Muy cerca de su media.
    const tB = () => Math.floor(val * (0.90 + Math.random() * 0.05)); 
    // tE (Técnico Especialista): Su gran virtud técnica. Entre 5% y 12% sobre su media.
    const tE = (bonus = 0) => {
        const factorBono = 1.05 + (bonus / 250); 
        return Math.min(MAX_INICIAL, Math.floor(val * factorBono + (Math.random() * 4)));
    };
    // tI (Técnico Irrelevante): Su carencia profesional. Entre 15% y 20% bajo su media.
    const tI = () => Math.floor(val * (0.80 + Math.random() * 0.05)); 

    // fB (Físico Base): El físico estándar. Con un suelo mínimo de 50 para realismo.
    const fB = () => Math.min(MAX_INICIAL, Math.floor(50 + (val * 0.40) + (Math.random() * 5)));
    // fE (Físico Especialista): La excepción física. Permite picos altos (12% al 18% extra).
    const fE = (bonus = 10) => {
        const factorBono = 1.12 + (bonus / 200); 
        return Math.min(MAX_INICIAL, Math.floor(val * factorBono + (Math.random() * 5)));
    };
    // m: Mental. Basado en media con un factor de suerte equilibrado.
    const m = () => Math.min(MAX_INICIAL, Math.floor(val * 0.85 + (Math.random() * 10)));

    // Inicialización por defecto
    let a = {
        habilidad: { regate: tI(), controlBalon: tI(), desmarques: tI() },
        tiro: { definicion: tI(), potenciaTiro: fB(), tiroLejano: tI(), lanzamientoFaltas: tI(), lanzamientoPenaltis: tI(), remateCabeza: fB() },
        pase: { paseCorto: tB(), paseLargo: tB(), vision: tI(), centros: tI() },
        defensa: { marcaje: tI(), entradas: tI(), intercepciones: tI(), despejes: fB(), duelosAereos: fB(), colocacion: tI() },
        fisico: { velocidad: fB(), aceleracion: fB(), agilidad: fB(), fuerza: fB(), resistencia: fB(), equilibrio: fB(), salto: fB() },
        mental: { concentracion: m(), liderazgo: tB(), agresividad: fB(), motivacion: m(), composturaBajoPresion: m() },
        portero: { reflejos: 1, paradas: 1, estirada: 1, juegoAereo: 1, unoContraUno: 1, blocaje: 1, saque: 1, comunicacion: 1, penales: 1 }
    };

    switch(arquetipo) {
        // --- PORTEROS ---
        case 'CASILLAS': a.portero.reflejos = tE(15); a.portero.estirada = tE(12); a.portero.unoContraUno = tE(12); a.portero.juegoAereo = tI(); a.portero.saque = tI(); break;
        case 'COURTOIS': a.portero.juegoAereo = tE(12); a.portero.paradas = tE(10); a.portero.reflejos = tB(); a.portero.estirada = tB(); a.portero.saque = tI(); break;
        case 'TER_STEGEN': a.portero.saque = tE(20); a.pase.paseCorto = tE(10); a.portero.reflejos = tI(); a.portero.paradas = tB(); a.portero.blocaje = tB(); break;
        case 'DIBU': a.portero.penales = tE(25); a.mental.agresividad = tE(10); a.portero.reflejos = tB(); a.portero.paradas = tB(); a.portero.comunicacion = tE(5); break;
        case 'ALISSON': a.portero.reflejos = tB(); a.portero.paradas = tB(); a.portero.saque = tB(); a.portero.unoContraUno = tB(); a.portero.juegoAereo = tB(); break;

        // --- LATERALES ---
        case 'ROBERTO_CARLOS': a.fisico.velocidad = fE(15); a.habilidad.regate = tB(); a.tiro.potenciaTiro = tE(20); a.tiro.tiroLejano = tE(15); a.defensa.marcaje = tI(); break;
        case 'MARCELO': a.habilidad.regate = tE(18); a.habilidad.controlBalon = tE(15); a.pase.paseCorto = tE(10); a.pase.centros = tE(10); a.defensa.entradas = tI(); break;
        case 'JORDI_ALBA': a.fisico.velocidad = fE(18); a.pase.centros = tE(15); a.defensa.entradas = tB(); a.fisico.aceleracion = fE(15); a.habilidad.regate = tI(); break;
        case 'MENDY': a.defensa.marcaje = tE(15); a.defensa.entradas = tE(15); a.fisico.fuerza = fE(10); a.defensa.colocacion = tE(10); a.tiro.definicion = tI(); break;
        case 'ARNOLD_LAHM': a.pase.centros = tE(20); a.pase.paseLargo = tE(15); a.pase.paseCorto = tE(12); a.fisico.velocidad = fB(); a.defensa.colocacion = tE(8); break;
        case 'HAKIMI_MENDES': a.fisico.velocidad = fE(18); a.fisico.resistencia = fE(15); a.fisico.fuerza = fE(10); a.pase.centros = tE(12); a.habilidad.regate = tE(8); break;
        case 'CARVAJAL': a.fisico.resistencia = fE(15); a.pase.centros = tE(10); a.defensa.marcaje = tB(); a.defensa.entradas = tB(); a.mental.agresividad = tE(12); break;

        // --- CENTRALES ---
        case 'PIQUE': a.pase.paseCorto = tE(15); a.pase.paseLargo = tE(15); a.habilidad.controlBalon = tE(12); a.defensa.colocacion = tE(10); a.fisico.fuerza = tB(); break;
        case 'RAMOS': a.defensa.duelosAereos = fE(15); a.tiro.remateCabeza = tE(18); a.mental.liderazgo = tE(20); a.fisico.velocidad = fE(10); a.defensa.entradas = tE(12); break;
        case 'PEPE': a.fisico.fuerza = fE(15); a.mental.agresividad = tE(25); a.defensa.duelosAereos = fE(12); a.defensa.entradas = tE(12); a.defensa.marcaje = tB(); break;
        case 'VARANE': a.fisico.velocidad = fE(18); a.defensa.intercepciones = tE(10); a.defensa.marcaje = tB(); a.fisico.salto = fE(12); a.habilidad.controlBalon = tI(); break;
        case 'MAGUIRE': a.fisico.fuerza = fE(20); a.defensa.duelosAereos = fE(20); a.defensa.marcaje = tE(10); a.fisico.velocidad = fB(); a.pase.paseCorto = tI(); break;
        case 'KOEMAN': a.tiro.potenciaTiro = tE(25); a.tiro.lanzamientoFaltas = tE(25); a.pase.paseLargo = tE(18); a.defensa.marcaje = tB(); a.fisico.velocidad = fB(); break;
        case 'NACHO': a.defensa.marcaje = tE(6); a.defensa.entradas = tE(6); a.defensa.intercepciones = tE(6); a.fisico.velocidad = fE(6); a.fisico.resistencia = fE(6); a.mental.concentracion = tE(10); break;

        // --- MEDIOCENTROS ---
        case 'BUSQUETS_ALONSO': a.pase.vision = tE(20); a.pase.paseLargo = tE(18); a.habilidad.controlBalon = tE(15); a.tiro.lanzamientoFaltas = tE(10); a.defensa.colocacion = tB(); break;
        case 'CASEMIRO': a.fisico.fuerza = fE(15); a.defensa.entradas = tE(18); a.defensa.duelosAereos = fE(15); a.tiro.remateCabeza = tE(10); a.tiro.potenciaTiro = tB(); break;
        case 'KANTE': a.fisico.resistencia = fE(22); a.fisico.velocidad = fE(10); a.defensa.intercepciones = tE(18); a.defensa.entradas = tE(12); a.pase.paseCorto = tB(); break;
        case 'RODRI': a.defensa.intercepciones = tE(15); a.pase.paseCorto = tE(15); a.tiro.tiroLejano = tE(15); a.fisico.fuerza = fE(12); a.defensa.colocacion = tE(12); break;
        case 'XAVI_KROOS': a.pase.paseCorto = tE(25); a.pase.paseLargo = tE(25); a.tiro.tiroLejano = tE(18); a.tiro.potenciaTiro = tE(15); a.pase.vision = tE(12); break;
        case 'INIESTA_MODRIC': a.habilidad.regate = tE(22); a.habilidad.controlBalon = tE(22); a.pase.vision = tE(20); a.pase.paseCorto = tE(15); a.fisico.agilidad = fE(10); break;
        case 'VALVERDE': a.fisico.velocidad = fE(18); a.fisico.resistencia = fE(20); a.tiro.potenciaTiro = tE(15); a.pase.paseLargo = tE(12); a.defensa.entradas = tB(); break;

        // --- MCO / SD ---
        case 'BELLINGHAM': a.habilidad.desmarques = tE(15); a.tiro.remateCabeza = tE(15); a.tiro.definicion = tE(12); a.fisico.resistencia = fE(15); a.defensa.entradas = tB(); break;
        case 'OZIL': a.pase.vision = tE(25); a.pase.centros = tE(15); a.habilidad.controlBalon = tE(18); a.pase.paseCorto = tE(12); a.defensa.marcaje = tI(); break;
        case 'DYBALA': a.tiro.tiroLejano = tE(20); a.tiro.definicion = tE(18); a.habilidad.regate = tE(15); a.tiro.lanzamientoFaltas = tE(15); a.pase.vision = tE(12); break;
        case 'DE_BRUYNE': a.pase.paseLargo = tE(25); a.pase.centros = tE(22); a.tiro.tiroLejano = tE(20); a.pase.paseCorto = tE(18); a.defensa.intercepciones = tB(); break;
        case 'POTENTE': a.tiro.potenciaTiro = tE(25); a.tiro.tiroLejano = tE(25); a.tiro.lanzamientoFaltas = tE(15); a.fisico.fuerza = fE(12); a.mental.motivacion = tB(); break;

        // --- EXTREMOS ---
        case 'MESSI': a.habilidad.regate = tE(25); a.habilidad.controlBalon = tE(25); a.pase.vision = tE(20); a.tiro.lanzamientoFaltas = tE(20); a.tiro.definicion = tE(12); break;
        case 'CRISTIANO': a.tiro.definicion = tE(22); a.tiro.potenciaTiro = tE(20); a.tiro.remateCabeza = tE(20); a.fisico.salto = fE(20); a.fisico.velocidad = fE(15); break;
        case 'BALE': a.fisico.velocidad = fE(22); a.fisico.resistencia = fE(18); a.tiro.potenciaTiro = tE(18); a.pase.centros = tE(12); a.fisico.fuerza = fE(12); break;
        case 'VINI': a.fisico.velocidad = fE(25); a.fisico.aceleracion = fE(25); a.habilidad.regate = tE(22); a.fisico.resistencia = fE(15); a.tiro.definicion = tI(); break;
        case 'RONALDINHO': a.habilidad.regate = tE(25); a.habilidad.controlBalon = tE(25); a.habilidad.desmarques = tE(12); a.tiro.lanzamientoFaltas = tE(15); a.pase.vision = tE(15); break;
        case 'GREALISH': a.pase.centros = tE(20); a.pase.vision = tE(18); a.habilidad.controlBalon = tE(18); a.fisico.equilibrio = fE(18); a.fisico.velocidad = tI(); break;

        // --- DELANTEROS ---
        case 'LEWAN_SUAREZ': a.tiro.definicion = tE(22); a.tiro.remateCabeza = tE(18); a.tiro.lanzamientoPenaltis = tE(15); a.habilidad.desmarques = tE(15); a.tiro.potenciaTiro = tE(10); break;
        case 'BENZEMA': a.habilidad.controlBalon = tE(20); a.pase.paseCorto = tE(18); a.tiro.definicion = tE(18); a.tiro.remateCabeza = tE(15); a.habilidad.desmarques = tE(12); break;
        case 'MBAPPE_RONALDO': a.fisico.velocidad = fE(22); a.tiro.definicion = tE(22); a.habilidad.regate = tE(18); a.fisico.aceleracion = fE(22); a.tiro.potenciaTiro = tE(12); break;
        case 'HAALAND': a.fisico.fuerza = fE(22); a.tiro.definicion = tE(22); a.tiro.potenciaTiro = tE(22); a.fisico.velocidad = fE(15); a.tiro.remateCabeza = fE(15); break;
        case 'JOSELU_LLORENTE': a.tiro.remateCabeza = tE(25); a.defensa.duelosAereos = fE(25); a.fisico.fuerza = fE(15); a.mental.agresividad = tE(12); a.fisico.velocidad = fB(); break;
        case 'MURIQI': a.tiro.remateCabeza = tE(25); a.defensa.duelosAereos = fE(25); a.fisico.fuerza = fE(18); a.pase.vision = tE(12); a.mental.agresividad = tE(15); break;
        case 'RAUL': a.habilidad.desmarques = tE(25); a.tiro.definicion = tE(20); a.mental.concentracion = tE(18); a.mental.composturaBajoPresion = tE(18); a.fisico.velocidad = tB(); break;
    }

    if (['MD', 'MI'].includes(pos)) { 
        a.defensa.entradas = Math.min(MAX_INICIAL, a.defensa.entradas + 12); 
        a.fisico.resistencia = Math.min(MAX_INICIAL, a.fisico.resistencia + 8); 
    }
    if (['EI', 'ED'].includes(pos)) { a.tiro.definicion = Math.min(MAX_INICIAL, a.tiro.definicion + 5); }

    return a;
}

module.exports = generarJugadoresNuevaPartida;