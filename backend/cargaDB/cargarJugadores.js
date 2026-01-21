const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Partida = require('../models/partida');
const { obtenerIdentidad } = require('./cargarIdentidades');

// 1. CONFIGURACIÓN DE PLANTILLA BASE
const ARQUETIPOS = {
    POR: ['CASILLAS', 'BUFFON', 'COURTOIS', 'TER_STEGEN', 'DIBU', 'ALISSON'],
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

const DORSALES_POR_JERARQUIA = {
    'POR': { titular: [1], suplente: [13, 25] },
    'DFC': { titular: [2, 3, 4, 5], suplente: [6, 17, 18] },
    'LI/LD': { titular: [2, 3, 12, 15], suplente: [17, 18] },
    'MCD': { titular: [6, 5, 14], suplente: [16, 19] },
    'MC': { titular: [8, 10, 6], suplente: [14, 16, 21] },
    'MCO': { titular: [10, 21], suplente: [19, 22, 23, 16] },
    'MD/ED/MI/EI': { titular: [7, 11, 10], suplente: [19, 21, 22] },
    'DC/SD': { titular: [9, 10], suplente: [20, 22, 23] }
};

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

            let jugadoresTemporales = [];
            let dorsalesOcupados = [];

            for (let i = 0; i < plantillaBase.length; i++) {
                const posicion = plantillaBase[i];
                let rolContrato = 'suplente';
                let rolInterno = 'ROTACION';
                if (i === 0 || i === 8 || i === 12 || i === 18) { rolContrato = 'clave'; rolInterno = 'ESTRELLA'; }
                else if (i < 11) { rolContrato = 'importante'; rolInterno = 'TITULAR'; }
                else if (i > 20) { rolContrato = club.esFilial ? 'promesa' : 'reserva'; rolInterno = 'RESERVA'; }

                const listaArq = ARQUETIPOS[posicion];
                const arquetipo = listaArq[Math.floor(Math.random() * listaArq.length)];

                const edad = generarEdad(rolInterno, club.esFilial, posicion);
                const ratings = calcularRatings(rolInterno, rep, repMatriz, club.esFilial, edad);
                const fisico = generarFisico(posicion, arquetipo);
                const identidad = obtenerIdentidad(club.pais, rep, false);      

                jugadoresTemporales.push({
                    partidaId,
                    nombre: identidad.nombreCompleto,
                    rolInterno,
                    edad,
                    altura: fisico.altura, 
                    peso: fisico.peso,    
                    nacionalidad: identidad.nacionalidad,
                    posicionPrincipal: posicion,
                    piernaBuena: Math.random() > 0.2 ? 'derecha' : 'izquierda',
                    piernaMala: Math.floor(Math.random() * 5) + 1,
                    versatilidad: Math.floor(Math.random() * 5) + 1,
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
            const orden = { 'ESTRELLA': 1, 'TITULAR': 2, 'ROTACION': 3, 'RESERVA': 4 };
            jugadoresTemporales.sort((a, b) => orden[a.rolInterno] - orden[b.rolInterno]);

            for (let jugador of jugadoresTemporales) {
                const numAsignado = asignarDorsalRealista(jugador.posicionPrincipal, jugador.rolInterno, dorsalesOcupados);
                jugador.dorsal = numAsignado;
                dorsalesOcupados.push(numAsignado);
                
                // Aprovechamos para generar los atributos finales basados en el arquetipo
                //jugador.atributos = generarAtributos(jugador.posicionPrincipal, jugador.valoracion, jugador.arquetipo);
                
                delete jugador.rolInterno; 
            }

            const insertados = await Jugador.insertMany(jugadoresTemporales);
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

function calcularRatings(rol, rep, repMatriz, esFilial, edad) {
    let ca;
    const suerteTalento = Math.random();
    if (esFilial) {
        ca = (repMatriz * 0.45) + (Math.random() * 12 + 8);
    } else {
        if (rol === 'ESTRELLA') {
            let bonoCima = rep > 90 ? (Math.random() * 1) : (Math.random() * 3);
            ca = rep + bonoCima;
        }       
        else if (rol === 'TITULAR') ca = rep - (Math.random() * 5 + 2);
        else if (rol === 'ROTACION') ca = rep - (Math.random() * 7 + 10);
        else ca = rep - (Math.random() * 10 + 18);
    }
    ca = Math.min(92, Math.max(15, Math.floor(ca)));

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
    }
    else {
        let distanciaAlTop = 96 - ca;
        let factorAmbicion = 0;
        const azarTalento = Math.random();

        if (azarTalento < 0.02) { 
            factorAmbicion = 0.95; 
        } else if (azarTalento < 0.10) {
            factorAmbicion = 0.70;
        } else if (azarTalento < 0.30) {
            factorAmbicion = 0.45;
        } else {
            factorAmbicion = 0.20;
        }

        let factorEdad = 0;
        if (edad < 22) factorEdad = 1.0;      
        else if (edad < 26) factorEdad = 0.75; 
        else if (edad < 29) factorEdad = 0.50; 
        else if (edad < 32) factorEdad = 0.25; 
        else factorEdad = 0.05;

        pa = ca + (distanciaAlTop * factorAmbicion * factorEdad * (0.9 + Math.random() * 0.3));
    }
    let paFinal = esFilial ? pa : Math.min(95, pa);
    return { 
        ca: Math.floor(ca), 
        pa: Math.min(99, Math.max(Math.floor(ca), Math.floor(paFinal))) 
    };
}

function normalizarPosicion(pos) {
    if (['POR'].includes(pos)) return 'POR';
    if (['DFC'].includes(pos)) return 'DFC';
    if (['LI', 'LD'].includes(pos)) return 'LI/LD';
    if (['MCD'].includes(pos)) return 'MCD';
    if (['MC'].includes(pos)) return 'MC';
    if (['MCO'].includes(pos)) return 'MCO';
    if (['MD', 'ED', 'MI', 'EI'].includes(pos)) return 'MD/ED/MI/EI';
    if (['DC', 'SD'].includes(pos)) return 'DC/SD';
    return 'DC/SD'; 
}

function asignarDorsalRealista(pos, rol, ocupados) {
    const posicion = normalizarPosicion(pos); 
    const dorsales = DORSALES_POR_JERARQUIA[posicion];
    
    if (rol !== 'RESERVA') {
        let nivel = (rol === 'ESTRELLA' || rol === 'TITULAR') ? 'titular' : 'suplente';
        const ordenBusqueda = (nivel === 'titular') ? ['titular', 'suplente'] : ['suplente', 'titular'];

        for (let n of ordenBusqueda) {
            let opcionesLibres = dorsales[nivel].filter(num => !ocupados.includes(num));
            
            if (opcionesLibres.length > 0) {
                const dorsal = opcionesLibres[Math.floor(Math.random() * opcionesLibres.length)];
                return dorsal;
            }
        }
    }

    let todosLosNumeros = Array.from({length: 99}, (_, i) => i + 1);
    let disponibles = todosLosNumeros.filter(n => !ocupados.includes(n));

    if (disponibles.length === 0) return 99; 

    const indice = Math.floor(Math.random() * disponibles.length);
    return disponibles[indice];
}

function generarEdad(rol, esFilial, posicion) {
    if (esFilial) return Math.floor(Math.random() * 6) + 15; 
    const azar = Math.random();
    if (posicion === 'POR') {
        if (azar < 0.10) return Math.floor(Math.random() * 5) + 18;  
        if (azar < 0.70) return Math.floor(Math.random() * 10) + 23; 
        return Math.floor(Math.random() * 8) + 33;                  
    }
    if (rol === 'ESTRELLA') {
        return azar < 0.92 
            ? Math.floor(Math.random() * 10) + 23 
            : Math.floor(Math.random() * 4) + 33;
    }

    if (azar < 0.25) return Math.floor(Math.random() * 5) + 18; 
    if (azar < 0.90) return Math.floor(Math.random() * 10) + 23; 
    return Math.floor(Math.random() * 5) + 33;
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
    const esPortero = pos === 'POR';
    const MAX_TECNICO = 95;
    const MAX_FISICO = 96;
    const reduccion = (Math.random() * 0.1) + 0.95;

    // Especialista Técnico (tE)
    const tE = (puntosOriginales) => {
        let ratio = puntosOriginales / 80; 
        let base = (val * reduccion) * 0.75 + (18 * ratio);
        const rangoAzar = 2 + (Math.random() * 13);
        return Math.min(MAX_TECNICO, Math.floor(base + (Math.random() * rangoAzar)));
    };

    // Técnico Base (tB): Para atributos donde el jugador cumple bien.
    const tB = () => {
        const talentoOculto = Math.random() < 0.15 ? 0.07 : 0;
        return Math.floor((val * reduccion) * (0.75 + talentoOculto + Math.random() * 0.05));
    };

    // Técnico Insuficiente (tI): Para debilidades.
    const tI = () => Math.floor((val * reduccion) * (0.5 + Math.random() * 0.05));

    // Físico Genético (fG): Rango base 30-85 + bono. No depende de 'val'.
    const fG = (bonusOriginal) => {
        let baseGenetica = 50 + Math.floor(Math.random() * 36); 
        let bonusAdaptado = (bonusOriginal / 40) * 15; 
        return Math.min(MAX_FISICO, baseGenetica + bonusAdaptado);
    };

    let a = {
        habilidad: { regate: tB(), controlBalon: tB(), desmarques: tB() },
        tiro: { definicion: tB(), potenciaTiro: tB(), tiroLejano: tB(), lanzamientoFaltas: tI(), lanzamientoPenaltis: tI(), remateCabeza: tB() },
        pase: { paseCorto: tB(), paseLargo: tB(), vision: tB(), centros: tB() },
        defensa: { marcaje: tI(), entradas: tI(), intercepciones: tI(), despejes: tB(), duelosAereos: tB(), colocacion: tB() },
        fisico: { velocidad: fG(0), aceleracion: fG(0), agilidad: fG(0), fuerza: fG(0), resistencia: fG(0), equilibrio: fG(0), salto: fG(0) },
        mental: { concentracion: tB(), liderazgo: tI(), agresividad: tB(), motivacion: tB(), composturaBajoPresion: tB() },
        portero: { reflejos: 1, paradas: 1, estirada: 1, juegoAereo: 1, unoContraUno: 1, blocaje: 1, saque: 1, comunicacion: 1, penales: 1 }
    };

    if (['DFC', 'LD', 'LI', 'MCD'].includes(pos)) { 
        if(['LD', 'LI'].includes(pos)){
            a.fisico.resistencia = fG(30);
            a.pase.centros = tE(15);
        }
        a.defensa.marcaje = tE(25);          
        a.defensa.entradas = tE(25);         
        a.defensa.intercepciones = tE(20);   
        a.defensa.colocacion = tE(20);       
        a.defensa.duelosAereos = tE(15);     
    }

    if (['MC', 'MCO', 'MCD'].includes(pos)) {
        a.pase.paseCorto = tE(25);           
        a.pase.vision = tE(20);              
        a.pase.paseLargo = tE(15);           
    }

    if (['DC', 'ED', 'EI', 'SD'].includes(pos)) {
        a.tiro.definicion = tE(20);          
        a.habilidad.desmarques = tE(15);    
        a.tiro.potenciaTiro = tE(15);       
    }
    switch(arquetipo) {
        // --- PORTEROS ---
        case 'CASILLAS':
            a.portero.reflejos = tE(75); a.portero.unoContraUno = tE(70); a.portero.estirada = tE(65);
            a.fisico.agilidad = fG(35); a.portero.juegoAereo = tI(); break;
        case 'BUFFON':
            a.defensa.colocacion = tE(80); a.portero.paradas = tE(75); a.portero.estirada = tE(65); 
            a.fisico.agilidad = fG(15); break;
        case 'COURTOIS':
            a.portero.juegoAereo = tE(70); a.portero.paradas = tE(65); a.portero.blocaje = tE(60);
            a.portero.reflejos = tE(55); a.portero.estirada = tE(40); a.defensa.colocacion = tE(65); break;
        case 'TER_STEGEN':
            a.portero.saque = tE(75); a.pase.paseCorto = tE(65); a.habilidad.controlBalon = tE(50);
            a.portero.reflejos = tE(40); a.portero.paradas = tE(40); break;
        case 'DIBU':
            a.portero.penales = tE(80); a.mental.composturaBajoPresion = tE(60); 
            a.defensa.colocacion = tE(60); break;
        case 'ALISSON':
            a.portero.reflejos = tE(40); a.portero.unoContraUno = tE(40); a.portero.saque = tE(40);
            a.portero.juegoAereo = tE(40); a.defensa.colocacion = tE(60); break;

        // --- LATERALES ---
        case 'ROBERTO_CARLOS':
            a.fisico.velocidad = fG(30); a.fisico.aceleracion = fG(30); a.tiro.potenciaTiro = tE(75); a.tiro.tiroLejano = tE(70);
            a.habilidad.regate = tE(45); a.defensa.marcaje = tB(); break;
        case 'MARCELO':
            a.habilidad.controlBalon = tE(75); a.habilidad.regate = tE(70); a.pase.centros = tE(60);
            a.fisico.velocidad = tB(); a.defensa.marcaje = tI(); break;
        case 'JORDI_ALBA':
            a.fisico.velocidad = fG(35); a.fisico.aceleracion = fG(35);
            a.pase.centros = tE(65); a.defensa.marcaje = tB(); break;
        case 'MENDY':
            a.defensa.marcaje = tE(65); a.defensa.entradas = tE(65); a.fisico.fuerza = fG(25);
            a.fisico.velocidad = (Math.random() > 0.5) ? fG(25) : tB(); a.pase.centros = tI(); break;
        case 'ARNOLD_LAHM':
            a.pase.centros = tE(75); a.pase.paseLargo = tE(70); a.pase.vision = tE(65);
            a.fisico.velocidad = tB(); a.defensa.marcaje = tE(20); break;
        case 'HAKIMI_MENDES':
            a.fisico.velocidad = fG(35); a.fisico.resistencia = fG(35); a.fisico.fuerza = fG(20);
            a.pase.centros = tE(55); a.habilidad.regate = tE(50); a.defensa.entradas = tE(30); break;
        case 'CARVAJAL':
            a.fisico.resistencia = fG(30); a.pase.centros = tE(55); a.defensa.entradas = tB();
            a.defensa.marcaje = tB(); a.fisico.velocidad = tB(); break;

        // --- CENTRALES ---
        case 'PIQUE':
            a.pase.paseCorto = tE(65); a.pase.paseLargo = tE(60); a.habilidad.controlBalon = tE(55);
            a.defensa.colocacion = tE(50); a.fisico.velocidad = tI(); break;
        case 'RAMOS':
            a.tiro.remateCabeza = tE(75); a.fisico.salto = fG(35); a.mental.liderazgo = tE(75);
            a.defensa.marcaje = tE(60); a.defensa.intercepciones = tE(60); a.fisico.velocidad = fG(15); break;
        case 'PEPE':
            a.mental.agresividad = tE(75); a.defensa.entradas = tE(70); a.fisico.fuerza = fG(30);
            a.defensa.marcaje = tE(60); a.pase.paseCorto = tB(); break;
        case 'VARANE':
            a.fisico.velocidad = fG(35); a.fisico.aceleracion = fG(30);
            a.defensa.intercepciones = tE(50); a.defensa.marcaje = tE(40); break;
        case 'MAGUIRE':
            a.fisico.fuerza = fG(35); a.defensa.duelosAereos = fG(35); a.tiro.remateCabeza = tE(65); a.defensa.entradas = tE(60);
            a.fisico.velocidad = tI(); a.pase.paseCorto = tI(); break;
        case 'KOEMAN':
            a.tiro.potenciaTiro = tE(75); a.tiro.lanzamientoFaltas = tE(70); a.tiro.tiroLejano = tE(70);
            a.defensa.marcaje = tE(40); a.fisico.velocidad = tI(); break;
        case 'NACHO':
            a.defensa.marcaje = tE(20); a.defensa.entradas = tE(20); a.mental.concentracion = tE(20);
            a.fisico.velocidad = tB(); a.fisico.resistencia = tB(); break;

        // --- MEDIOCENTROS ---
        case 'BUSQUETS_ALONSO':
            a.pase.vision = tE(75); a.pase.paseCorto = tE(75); a.pase.paseLargo = tE(75);
            a.tiro.lanzamientoFaltas = tE(50); a.fisico.velocidad = tI(); break;
        case 'CASEMIRO':
            a.defensa.entradas = tE(70); a.fisico.fuerza = fG(30); a.defensa.intercepciones = tE(60);
            a.tiro.remateCabeza = tE(60); a.fisico.velocidad = tB(); break;
        case 'KANTE':
            a.fisico.resistencia = fG(40); a.fisico.velocidad = fG(25);
            a.defensa.intercepciones = tE(65); a.pase.paseCorto = tE(40); break;
        case 'RODRI':
            a.pase.paseCorto = tE(65); a.defensa.colocacion = tE(60); a.tiro.tiroLejano = tE(60);
            a.fisico.fuerza = fG(20); a.fisico.velocidad = fG(10); break;
        case 'XAVI_KROOS':
            a.pase.paseCorto = tE(80); a.pase.paseLargo = tE(80); a.tiro.potenciaTiro = tE(65);
            a.fisico.velocidad = tB(); a.defensa.colocacion = tB(); break;
        case 'INIESTA_MODRIC':
            a.habilidad.controlBalon = tE(75); a.habilidad.regate = tE(75); a.pase.vision = tE(70);
            a.fisico.resistencia = tB(); a.defensa.entradas = tB(); break;
        case 'VALVERDE':
            a.fisico.velocidad = fG(30); a.fisico.resistencia = fG(35);
            a.tiro.potenciaTiro = tE(60); a.defensa.entradas = tE(40); break;

        // --- MCO / EXTREMOS ---
        case 'BELLINGHAM':
            a.habilidad.desmarques = tE(70); a.tiro.definicion = tE(65); a.tiro.remateCabeza = tE(60);
            a.fisico.resistencia = fG(25); a.defensa.entradas = tE(30); break;
        case 'OZIL':
            a.pase.vision = tE(80); a.pase.paseCorto = tE(70); a.habilidad.controlBalon = tE(70);
            a.defensa.marcaje = tI(); a.tiro.definicion = tB(); break;
        case 'DYBALA':
            a.habilidad.regate = tE(70); a.habilidad.controlBalon = tE(70); a.tiro.definicion = tE(70);
            a.tiro.lanzamientoFaltas = tE(65); a.defensa.marcaje = tI(); break;
        case 'DE_BRUYNE':
            a.tiro.tiroLejano = tE(75); a.pase.paseLargo = tE(75); a.tiro.potenciaTiro = tE(70);
            a.defensa.entradas = tB(); a.fisico.velocidad = tB(); break;
        case 'POTENTE':
            a.tiro.potenciaTiro = tE(75); a.tiro.tiroLejano = tE(75); a.tiro.definicion = tB(); break;
        case 'MESSI':
            a.habilidad.regate = tE(75); a.habilidad.controlBalon = tE(75); a.pase.vision = tE(75);
            a.tiro.lanzamientoFaltas = tE(75); a.defensa.marcaje = tI(); break;
        case 'CRISTIANO':
            a.tiro.definicion = tE(75); a.tiro.potenciaTiro = tE(75); a.fisico.salto = fG(35);
            a.tiro.remateCabeza = tE(70); a.fisico.velocidad = fG(30); break;
        case 'BALE':
            a.fisico.velocidad = fG(35); a.fisico.resistencia = fG(35); a.fisico.fuerza = fG(25);
            a.pase.centros = tE(65); a.defensa.entradas = tB(); break;
        case 'VINI':
            a.fisico.velocidad = fG(35); a.habilidad.regate = tE(75); a.fisico.resistencia = fG(25);
            a.tiro.definicion = tB(); a.pase.paseCorto = tB(); break;
        case 'RONALDINHO':
            a.habilidad.controlBalon = tE(80); a.habilidad.regate = tE(80);
            a.pase.vision = tE(70); a.defensa.marcaje = tI(); break;
        case 'GREALISH':
            a.pase.centros = tE(75); a.pase.vision = tE(65); a.habilidad.controlBalon = tE(60);
            a.fisico.velocidad = tB(); a.defensa.entradas = tB(); break;

        // --- DELANTEROS ---
        case 'LEWAN_SUAREZ':
            a.tiro.definicion = tE(75); a.habilidad.desmarques = tE(70); a.tiro.remateCabeza = tE(65);
            a.fisico.velocidad = tB(); a.mental.agresividad = tB(); break;
        case 'BENZEMA':
            a.habilidad.controlBalon = tE(70); a.pase.paseCorto = tE(65); a.tiro.definicion = tE(70);
            a.tiro.remateCabeza = tE(60); a.fisico.velocidad = tB(); break;
        case 'MBAPPE_RONALDO':
            a.fisico.velocidad = fG(35); a.habilidad.regate = tE(75); a.tiro.definicion = tE(75);
            a.tiro.remateCabeza = tI(); break;
        case 'HAALAND':
            a.tiro.definicion = tE(75); a.fisico.fuerza = fG(35); a.tiro.potenciaTiro = tE(75);
            a.fisico.velocidad = fG(25); a.tiro.remateCabeza = tE(65); break;
        case 'JOSELU_LLORENTE':
            a.tiro.remateCabeza = tE(80); a.defensa.duelosAereos = fG(35); a.fisico.fuerza = fG(30);
            a.fisico.velocidad = tI(); break;
        case 'MURIQI':
            a.tiro.remateCabeza = tE(80); a.defensa.duelosAereos = fG(30); a.pase.vision = tE(60);
            a.habilidad.controlBalon = tE(50); a.fisico.velocidad = tI(); break;
        case 'RAUL':
            a.habilidad.desmarques = tE(80); a.tiro.definicion = tE(75); a.mental.concentracion = tE(70);
            a.fisico.velocidad = tB(); a.habilidad.controlBalon = tB(); break;
    }

    if (esPortero) {
        const capSuelo = 15; 
        Object.keys(a.habilidad).forEach(k => a.habilidad[k] = Math.min(capSuelo, tI()));
        Object.keys(a.tiro).forEach(k => a.tiro[k] = Math.min(capSuelo, tI()));
        Object.keys(a.pase).forEach(k => { 
            if(k !== 'saque') a.pase[k] = Math.min(35, a.pase[k]); 
        });
       
        a.fisico.resistencia = Math.min(40, a.fisico.resistencia);
        a.fisico.velocidad = Math.min(50, a.fisico.velocidad); 
        a.fisico.agilidad = Math.max(a.fisico.agilidad, a.portero.reflejos - 10);
        a.defensa.colocacion = tB();

        Object.keys(a.portero).forEach(k => { 
            if(a.portero[k] === 1) a.portero[k] = tB(); 
        });
    }

    Object.keys(a).forEach(aux => {
        Object.keys(a[aux]).forEach(attr => {
            const limite = aux === 'fisico' ? MAX_FISICO : MAX_TECNICO;
            a[aux][attr] = Math.max(1, Math.min(limite, Math.floor(a[aux][attr])));
        });
    });

    return a;
}

module.exports = generarJugadoresNuevaPartida;