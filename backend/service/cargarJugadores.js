const Club = require('../models/club');
const Jugador = require('../models/jugador');
const { obtenerIdentidad } = require('./cargarIdentidades');
const mongoose = require('mongoose');

// 1. CONFIGURACIÓN DE PLANTILLA BASE
const ARQUETIPOS = {
    POR: ['CASILLAS', 'BUFFON', 'COURTOIS', 'TER_STEGEN', 'DIBU', 'ALISSON', 'NEUER', 'OBLAK', 'KEYLOR', 'KAHN'],
    LD: ['ROBERTO_CARLOS', 'MARCELO', 'JORDI_ALBA', 'MENDY', 'ARNOLD', 'LAHM', 'HAKIMI_MENDES', 'CARVAJAL'],
    LI: ['ROBERTO_CARLOS', 'MARCELO', 'JORDI_ALBA', 'MENDY', 'ARNOLD', 'LAHM', 'HAKIMI_MENDES', 'CARVAJAL'],
    DFC: ['PIQUE', 'RAMOS', 'PEPE', 'VARANE', 'MAGUIRE', 'KOEMAN', 'NACHO', 'VAN_DIJK', 'LISANDRO'],
    MCD: ['BUSQUETS_ALONSO', 'CASEMIRO', 'KANTE', 'RODRI'],
    MC: ['XAVI_KROOS', 'INIESTA_MODRIC', 'VALVERDE', 'PIRLO', 'GATTUSO', 'MC_LLEGADOR'],
    MCO: ['BELLINGHAM', 'OZIL', 'DYBALA', 'POTENTE', 'DE_BRUYNE'],
    SD: ['BELLINGHAM', 'DYBALA', 'RAUL'],
    ED: ['MESSI', 'CRISTIANO', 'BALE', 'VINI', 'RONALDINHO', 'GREALISH'],
    EI: ['MESSI', 'CRISTIANO', 'BALE', 'VINI', 'RONALDINHO', 'GREALISH'],
    MD: ['BALE', 'GREALISH', 'VALVERDE', 'DYBALA'],
    MI: ['BALE', 'GREALISH', 'VALVERDE', 'DYBALA'],
    DC: ['LEWAN_SUAREZ', 'BENZEMA', 'MBAPPE_RONALDO', 'HAALAND', 'JOSELU_LLORENTE', 'MURIQI', 'RAUL']
};

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

const POSICIONES_EXTRAS = ['LD', 'LI', 'DFC', 'MCD', 'MC', 'MCO', 'MD', 'MI', 'ED', 'EI', 'DC', 'SD', 'POR'];

const RANKING_PAISES = {
    TOP: ['España', 'Brasil', 'Francia', 'Argentina', 'Inglaterra', 'Alemania', 'Portugal'],
    MEDIO: ['Italia', 'Países Bajos', 'Uruguay', 'Bélgica', 'Croacia', 'Marruecos', 'Colombia', 'Noruega', 'Egipto', 'Ecuador'],
    RESTO: 'otro'
};

async function generarJugadoresNuevaPartida(partidaId, listaClubes, nombrePartida, clubUsuarioId) {
    try {
        const { FORMACIONES } = require('./cargarFormaciones');
        const clubes = listaClubes;
        
        let todosLosJugadores = [];
        let operacionesClubes = []; 
        let contadorTotal = 0;

        const PESOS_FORMACIONES = {
            '4-4-2': 13, '4-3-3': 13, '4-3-3 (defensivo)': 10, '4-3-3 (falso 9)': 10,
            '4-2-3-1': 13, '4-2-3-1 (defensivo)': 10, '4-1-2-1-2': 7,
            '5-3-2': 7, '5-2-1-2': 7, '3-5-2': 5, '3-2-2-3': 5
        };
        
        const FILTROS_ESTILOS = {
            'TIKI-TAKA': ['4-3-3', '4-3-3 (falso 9)', '4-2-3-1', '3-2-2-3'],
            'CONTRAATAQUE': ['4-4-2', '4-2-3-1 (defensivo)', '5-3-2', '5-2-1-2'],
            'AUTOBÚS': ['5-3-2', '5-2-1-2', '4-3-3 (defensivo)', '4-4-2'],
            'BALÓN LARGO': ['4-4-2', '5-3-2', '3-5-2'],
            'PRESIÓN ALTA': ['4-3-3', '4-2-3-1', '3-5-2'],
            'JUEGO POR BANDAS': ['4-3-3', '4-4-2', '4-2-3-1', '3-2-2-3'],
            'PONER CENTROS': ['4-4-2', '4-3-3', '3-5-2'],
            'ESTÁNDAR': ['4-4-2', '4-3-3', '4-2-3-1', '4-3-3 (defensivo)', '4-3-3 (falso 9)', '4-2-3-1 (defensivo)', '4-1-2-1-2', '5-3-2', '5-2-1-2', '3-5-2', '3-2-2-3']
        };

        const MAPA_FLEXIBLE = {
            'EI': ['EI', 'MI', 'SD'],
            'ED': ['ED', 'MD', 'SD'],
            'MI': ['MI', 'EI', 'MC'],
            'MD': ['MD', 'ED', 'MC'],
            'MCO': ['MCO', 'SD', 'MC'],
            'SD': ['SD', 'DC', 'MCO'],
            'MCD': ['MCD', 'MC'],
            'MC': ['MC', 'MCD', 'MCO']
        };

        for (const club of clubes) {
            const rep = club.reputacion;
            const repMatriz = (club.esFilial && club.clubMatriz) ? club.clubMatriz.reputacion : rep;
            const esClubUsuario = clubUsuarioId && club._id.toString() === clubUsuarioId.toString();
            let estiloJuego = 'ESTÁNDAR';
            let mentalidad = 'EQUILIBRADA';

            if (!esClubUsuario) {
                const estilosDisponibles = ['TIKI-TAKA', 'CONTRAATAQUE', 'AUTOBÚS', 'BALÓN LARGO', 'PRESIÓN ALTA', 'JUEGO POR BANDAS', 'PONER CENTROS', 'ESTÁNDAR'];
                const mentalidadesDisponibles = ['MUY_DEFENSIVA', 'DEFENSIVA', 'EQUILIBRADA', 'OFENSIVA', 'ULTRA_OFENSIVA'];
                
                estiloJuego = estilosDisponibles[Math.floor(Math.random() * estilosDisponibles.length)];
                mentalidad = mentalidadesDisponibles[Math.floor(Math.random() * mentalidadesDisponibles.length)];
            }

            const formacionesPermitidas = FILTROS_ESTILOS[estiloJuego];
            let pesosFiltrados = {};
            formacionesPermitidas.forEach(f => {
                if (PESOS_FORMACIONES[f]) pesosFiltrados[f] = PESOS_FORMACIONES[f];
            });

            const nombreTactica = obtenerFormacionAleatoria(pesosFiltrados);
            const tacticaInfo = FORMACIONES[nombreTactica];

            let titularesEsquema = tacticaInfo.posiciones.map(pos => {
                if (Math.random() > 0.7 && MAPA_FLEXIBLE[pos]) {
                    const opciones = MAPA_FLEXIBLE[pos];
                    return opciones[Math.floor(Math.random() * opciones.length)];
                }
                return pos;
            });

            let extras = ['POR', 'POR'];
            const poolDef = titularesEsquema.filter(p => ['DFC', 'LI', 'LD'].includes(p));
            const poolMed = titularesEsquema.filter(p => ['MC', 'MCD', 'MCO', 'MD', 'MI'].includes(p));
            const poolDel = titularesEsquema.filter(p => ['DC', 'SD', 'EI', 'ED'].includes(p));

            for(let i=0; i<4; i++){
                extras.push(poolDef[Math.floor(Math.random() * poolDef.length)]|| 'DFC');
            }
            for(let i=0; i<4; i++) {
                extras.push(poolMed[Math.floor(Math.random() * poolMed.length)]|| 'MC');
            }
            for(let i=0; i<3; i++) {
                extras.push(poolDel[Math.floor(Math.random() * poolDel.length)]|| 'DC');
            }
            const numRelleno = Math.floor(Math.random() * 5);
            for(let i=0; i < numRelleno; i++) {
                extras.push(POSICIONES_EXTRAS[Math.floor(Math.random() * POSICIONES_EXTRAS.length)]);
            }

            let plantillaBase = [...titularesEsquema, ...extras];
            let indicesTitulares = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            let delanteros = [];
            let medios = [];
            let otros = [];
            indicesTitulares.forEach(idx => {
                const pos = titularesEsquema[idx];
                if (['DC', 'EI', 'ED', 'SD'].includes(pos)){
                    delanteros.push(idx);
                }
                else if (['MC', 'MCD', 'MCO'].includes(pos)) {
                    medios.push(idx);
                }
                else {
                    otros.push(idx);
                }
            });

            delanteros.sort(() => Math.random() - 0.5);
            medios.sort(() => Math.random() - 0.5);
            otros.sort(() => Math.random() - 0.5);

            let estrellasFinales = [];
            estrellasFinales.push(...delanteros.slice(0, 2));

            let faltan = 4 - estrellasFinales.length;
            if(faltan >= 3){
                if(faltan==4) {
                    estrellasFinales.push(...medios.slice(0, 2));
                }
                else{
                    estrellasFinales.push(...medios.slice(0, 1));
                }
            }

            faltan = 4 - estrellasFinales.length;
            estrellasFinales.push(...otros.slice(0, faltan));

            let indicesEstrellas = estrellasFinales;

            let jugadoresDelClubEnMemoria = [];
            let dorsalesOcupados = [];

            const competicionesDelClub = club.competiciones || [];
            const AFINIDADES = {
                'DFC': ['MCD', 'LD', 'LI'],
                'LI': ['LD', 'MI', 'DFC'],
                'LD': ['LI', 'MD', 'DFC'],
                'MCD': ['MC', 'DFC'],
                'MC': ['MCO', 'MCD'],
                'MCO': ['MC', 'SD', 'MI', 'MD'],
                'MI': ['EI', 'LI', 'MD'],
                'MD': ['ED', 'LD', 'MI'],
                'EI': ['MI', 'ED', 'DC'],
                'ED': ['MD', 'EI', 'DC'],
                'SD': ['DC', 'MCO', 'EI', 'ED'],
                'DC': ['SD']
            };

            for (let i = 0; i < plantillaBase.length; i++) {
                const posicion = plantillaBase[i];
                let secundarias = [];
                if (Math.random() > 0.2 && AFINIDADES[posicion]) {
                    secundarias = AFINIDADES[posicion]
                        .sort(() => 0.5 - Math.random())
                        .slice(0, Math.floor(Math.random() * 2) + 1);
                }
                let rolContrato = 'suplente';
                let rolInterno = 'ROTACION';

                if (indicesEstrellas.includes(i)) { 
                    rolContrato = 'clave'; 
                    rolInterno = 'ESTRELLA'; 
                } 
                else if (i < 11) { 
                    rolContrato = 'importante'; 
                    rolInterno = 'TITULAR'; 
                } 
                else if (i > 22) { 
                    rolContrato = club.esFilial ? 'promesa' : 'reserva'; 
                    rolInterno = 'RESERVA'; 
                }

                const arquetipo = ARQUETIPOS[posicion][Math.floor(Math.random() * ARQUETIPOS[posicion].length)];
                const edad = generarEdad(rolInterno, club.esFilial, posicion);
                const ratings = calcularRatings(rolInterno, rep, repMatriz, club.esFilial, edad, club.infraestructuras.cantera);
                const fisico = generarFisico(posicion, arquetipo);
                const { nombreCompleto, nacionalidad, finContrato } = obtenerIdentidad(club.pais, rep, false, ratings.ca, new Date(2025, 6, 1));      
                const idJugador = new mongoose.Types.ObjectId();

                jugadoresDelClubEnMemoria.push({
                    _id: idJugador,
                    partidaId: partidaId,
                    nombre: nombreCompleto,
                    rolInterno,
                    edad,
                    altura: fisico.altura, 
                    peso: fisico.peso,    
                    nacionalidad: nacionalidad,
                    posicionPrincipal: posicion,
                    posicionesSecundarias: secundarias,
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
                    salario: calcularSalario(ratings.ca, ratings.pa, edad, rep),
                    finContrato: finContrato,
                    estado: { forma: 100, moral: Math.floor(Math.random() * 21) + 80, satisfaccion: 100, lesion: null },
                    statsTemporada: competicionesDelClub.map(compId => ({
                        competicionId: compId,
                        pj: 0,
                        titular: 0,
                        minutos: 0,
                        goles: 0,
                        asistencias: 0,
                        amarillas: 0,
                        rojas: 0,
                        notaMedia: 0
                    }))
                });
            }

            let plantillaOrdenada = [];
            if (tacticaInfo && jugadoresDelClubEnMemoria.length > 0) {
                const posicionesRequeridas = tacticaInfo.posiciones; // Las 11 posiciones fijas del dibujo táctico
                const copiaPool = [...jugadoresDelClubEnMemoria];
                const titularesOptimistas = new Array(11).fill(null);

                // Paso A: Asignar por posición NATURAL y de mayor a menor valoración
                posicionesRequeridas.forEach((posRequerida, index) => {
                    const candidatos = copiaPool.filter(j => j.posicionPrincipal === posRequerida);
                    if (candidatos.length > 0) {
                        candidatos.sort((a, b) => b.valoracion - a.valoracion);
                        titularesOptimistas[index] = candidatos[0];
                        const idx = copiaPool.findIndex(j => j._id.toString() === candidatos[0]._id.toString());
                        copiaPool.splice(idx, 1);
                    }
                });

                // Paso B: Llenar huecos con posiciones SECUNDARIAS
                posicionesRequeridas.forEach((posRequerida, index) => {
                    if (!titularesOptimistas[index]) {
                        const candidatos = copiaPool.filter(j => (j.posicionesSecundarias || []).includes(posRequerida));
                        if (candidatos.length > 0) {
                            candidatos.sort((a, b) => b.valoracion - a.valoracion);
                            titularesOptimistas[index] = candidatos[0];
                            const idx = copiaPool.findIndex(j => j._id.toString() === candidatos[0]._id.toString());
                            copiaPool.splice(idx, 1);
                        }
                    }
                });

                // Paso C: Parche de emergencia (Mayor calidad sobrante disponible)
                posicionesRequeridas.forEach((posRequerida, index) => {
                    if (!titularesOptimistas[index]) {
                        copiaPool.sort((a, b) => b.valoracion - a.valoracion);
                        const elegido = copiaPool.shift();
                        if (elegido) titularesOptimistas[index] = elegido;
                    }
                });

                // Paso D: Ordenar el resto de jugadores sobrantes (suplentes/reservas)
                let suplentesBalanceados = [];

                // 1. Garantizar portero suplente si existe
                const indexPortero = copiaPool.findIndex(j => j.posicionPrincipal === 'POR');
                if (indexPortero !== -1) {
                    suplentesBalanceados.push(copiaPool.splice(indexPortero, 1)[0]);
                }

                // 2. Ordenamos el pool restante por valoración para asegurar que los mejores vayan al banquillo
                copiaPool.sort((a, b) => b.valoracion - a.valoracion);

                // 3. Intentamos repartir los huecos de forma rotativa (Def, Med, Del) sacándolos de copiaPool
                const tipologia = {
                    def: ['DFC', 'LI', 'LD'],
                    med: ['MC', 'MCD', 'MCO', 'MD', 'MI'],
                    del: ['DC', 'SD', 'EI', 'ED']
                };

                let tipologiaActual = 'def';

                // Extraemos de copiaPool respetando el orden de calidad pero alternando líneas
                while (suplentesBalanceados.length < 13 && copiaPool.length > 0) {
                    let targetPositions = tipologia[tipologiaActual];
                    
                    // Buscamos el mejor jugador disponible de la línea actual
                    let idx = copiaPool.findIndex(j => targetPositions.includes(j.posicionPrincipal));
                    
                    // Si no hay de esa línea, tomamos simplemente el primero disponible (el mejor que quede)
                    if (idx === -1) idx = 0; 

                    // Lo movemos de copiaPool al banquillo
                    suplentesBalanceados.push(copiaPool.splice(idx, 1)[0]);

                    // Rotamos la línea para el siguiente ciclo
                    if (tipologiaActual === 'def') tipologiaActual = 'med';
                    else if (tipologiaActual === 'med') tipologiaActual = 'del';
                    else tipologiaActual = 'def';
                }

                // 4. Todo lo que sobre de copiaPool va limpio a la reserva (sin duplicados)
                let reservasRestantes = [...copiaPool];

                // Reunimos la plantilla final idéntica a tu estructura segura
                plantillaOrdenada = [...titularesOptimistas.filter(Boolean), ...suplentesBalanceados, ...reservasRestantes];
            
            } else {
                plantillaOrdenada = [...jugadoresDelClubEnMemoria];
            }

            // Mapeamos los conjuntos de ID correspondientes basados en el nuevo orden limpio
            const idsTitulares = plantillaOrdenada.slice(0, 11).map(j => j._id);
            const idsSuplentes = plantillaOrdenada.slice(11, 24).map(j => j._id);
            const idsReservas = plantillaOrdenada.slice(24).map(j => j._id);
            const idsJugadoresFinales = plantillaOrdenada.map(j => j._id);

            // Asignación de dorsales coherentes con su nuevo orden de importancia real
            for (let jugador of plantillaOrdenada) {
                jugador.dorsal = asignarDorsalRealista(jugador.posicionPrincipal, jugador.rolInterno, dorsalesOcupados);
                dorsalesOcupados.push(jugador.dorsal);
                
                const { rolInterno, ...jugadorParaInsertar } = jugador;
                todosLosJugadores.push(jugadorParaInsertar);
            }

            // Extraemos los 11 titulares reales en memoria para decidir los capitanes y lanzadores perfectos
            const titularesFinal = plantillaOrdenada.slice(0, 11);

            const tacticaActualizada = {
                formacion: nombreTactica,
                estiloJuego: estiloJuego, 
                mentalidad: mentalidad,   
                titulares: idsTitulares,
                suplentes: idsSuplentes,
                reservas: idsReservas,
                capitan: [...titularesFinal].sort((a, b) => b.atributos.mental.liderazgo - a.atributos.mental.liderazgo)[0]?._id || idsTitulares[0],
                penaltis: [...titularesFinal].sort((a, b) => b.atributos.tiro.lanzamientoPenaltis - a.atributos.tiro.lanzamientoPenaltis)[0]?._id || idsTitulares[10],
                faltasIzquierda: [...titularesFinal].sort((a, b) => b.atributos.tiro.lanzamientoFaltas - a.atributos.tiro.lanzamientoFaltas)[0]?._id || idsTitulares[7],
                faltasDerecha: [...titularesFinal].sort((a, b) => b.atributos.tiro.lanzamientoFaltas - a.atributos.tiro.lanzamientoFaltas)[0]?._id || idsTitulares[7],
                faltasLejanas: [...titularesFinal].sort((a, b) => b.atributos.tiro.tiroLejano - a.atributos.tiro.tiroLejano)[0]?._id || idsTitulares[7],
                cornersIzquierda: [...titularesFinal].sort((a, b) => b.atributos.pase.centros - a.atributos.pase.centros)[0]?._id || idsTitulares[7],
                cornersDerecha: [...titularesFinal].sort((a, b) => b.atributos.pase.centros - a.atributos.pase.centros)[0]?._id || idsTitulares[7]
            };

            operacionesClubes.push({
                updateOne: {
                    filter: { _id: club._id },
                    update: { $set: { 
                        plantilla: idsJugadoresFinales,
                        tactica: tacticaActualizada
                    } }
                }
            });
            contadorTotal += plantillaOrdenada.length;
        }

        if (todosLosJugadores.length > 0) {
            await Jugador.insertMany(todosLosJugadores);
            await Club.bulkWrite(operacionesClubes);
        }

        console.log(`Se han añadido ${contadorTotal} jugadores para partida ${nombrePartida}.`);
        return true;
    } catch (err) { console.error(err); throw err; }
}

function obtenerFormacionAleatoria(pesosFiltrados){
    const opciones = Object.keys(pesosFiltrados);
    const totalPeso = Object.values(pesosFiltrados).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalPeso;
    for (const nombre of opciones) {
        if (random < pesosFiltrados[nombre]) return nombre;
        random -= pesosFiltrados[nombre];
    }
    return opciones[0] || '4-4-2'; // Fallback por si acaso
}

function generarEstadoInicial() {
    const selectorRnd = Math.random();
    
    let moral, satisfaccion, entrenamiento;

    if (selectorRnd < 0.15) {
        // PERFIL 1: El "Rebelde / Desmotivado" (15% de probabilidad)
        // Jugadores transferibles, enfadados con la directiva o vagos.
        moral = Math.floor(Math.random() * 21) + 40;         // Rango: 40 - 60 
        satisfaccion = Math.floor(Math.random() * 21) + 35;  // Rango: 35 - 55 
        rendimiento = Math.floor(Math.random() * 26) + 45; // Rango: 45 - 70 
    } 
    else if (selectorRnd < 0.40) {
        // PERFIL 2: El "Cumplidor / Apagado" (25% de probabilidad)
        //El típico jugador de rotación que no da problemas pero no brilla.
        moral = Math.floor(Math.random() * 16) + 65;         // Rango: 65 - 80 
        satisfaccion = Math.floor(Math.random() * 16) + 65;  // Rango: 65 - 80
        rendimiento = Math.floor(Math.random() * 16) + 70; // Rango: 70 - 85
    } 
    else {
        // PERFIL 3: El "Comprometido / Estrella" (60% de probabilidad)
        // La mayoría de la plantilla: felices, profesionales y listos para jugar.
        moral = Math.floor(Math.random() * 211) + 80;         // Rango: 80 - 100
        satisfaccion = Math.floor(Math.random() * 21) + 80;  // Rango: 80 - 100
        rendimiento = Math.floor(Math.random() * 21) * 80; // Rango: 80 - 100
    }

    return {
        forma: 100,
        moral,
        satisfaccion,
        rendimiento,
        lesion: null,
        sancionado: false
    };
}

function generarFisico(pos, arquetipo) {
    let minAlt = 172, maxAlt = 190;
    const rangos = {
        'CASILLAS': [184, 190], 'BUFFON': [184, 193], 'COURTOIS': [195, 202], 'TER_STEGEN': [184, 195], 'DIBU': [188, 198], 'ALISSON': [188, 202], 'NEUER': [185, 193], 'OBLAK': [188, 202], 'KEYLOR': [184, 190], 'KAHN': [186, 202],
        'ROBERTO_CARLOS': [168, 185], 'MARCELO': [168, 175], 'JORDI_ALBA': [168, 185], 'MENDY': [175, 184], 'ARNOLD': [173, 182], 'LAHM': [173, 182], 'HAKIMI_MENDES': [178, 184], 'CARVAJAL': [170, 182],
        'PIQUE': [180, 196], 'RAMOS': [184, 193], 'PEPE': [184, 193], 'VARANE': [180, 192], 'MAGUIRE': [191, 202], 'KOEMAN': [182, 192], 'NACHO': [180, 188], 'VAN_DIJK': [184, 196], 'LISANDRO': [175, 182],
        'BUSQUETS_ALONSO': [184, 195], 'CASEMIRO': [184, 195], 'KANTE': [170, 184], 'RODRI': [182, 195],
        'XAVI_KROOS': [173, 185], 'INIESTA_MODRIC': [170, 182], 'VALVERDE': [180, 188], 'PIRLO': [175, 195], 'GATTUSO': [175, 188], 'MC_LLEGADOR': [175, 190],
        'BELLINGHAM': [185, 190], 'OZIL': [168, 180], 'DYBALA': [168, 182], 'POTENTE': [175, 184], 'DE_BRUYNE': [175, 185],
        'MESSI': [168, 175], 'CRISTIANO': [175, 185], 'BALE': [175, 185], 'VINI': [168, 182], 'RONALDINHO': [168, 182], 'GREALISH': [175, 184],
        'LEWAN_SUAREZ': [180, 187], 'BENZEMA': [180, 187], 'MBAPPE_RONALDO': [178, 184], 'HAALAND': [188, 195], 'JOSELU_LLORENTE': [190, 195], 'MURIQI': [190, 195], 'RAUL': [178, 184]
    };
    if (rangos[arquetipo]) {
        [minAlt, maxAlt] = rangos[arquetipo];
    }

    const altura = Math.floor(Math.random() * (maxAlt - minAlt + 1)) + minAlt;
    const peso = (altura - 100) + (Math.floor(Math.random() * 11) - 5);
    return { altura, peso };
}

function calcularRatings(rol, rep, repMatriz, esFilial, edad, nivelCantera) {
    let ca;
    let azarExcepcion = Math.random();
    if (esFilial) {
        const basePorReputacion = (rep * 0.88) + 2;
        const margen= (Math.random() * 8);
        
        ca = basePorReputacion + margen;
        if (azarExcepcion > 0.90) { 
            ca = repMatriz - (Math.random() * 4 + 4);
        }
    } else {
       if (rol === 'ESTRELLA') {
            if (rep >= 90) { 
                const azar = Math.random();
                if (azar > 0.98) ca = 92;       
                else if (azar > 0.90) ca = 91;  
                else if (azar > 0.80) ca = 90; 
                else if (azar > 0.55) ca = 89;
                else if (azar > 0.30) ca = 88;
                else ca = 87;                         
            } 
            else if (rep >= 86) {
                const azar = Math.random();
                if (azar > 0.92) ca = 89;   
                else if (azar > 0.85) ca = 88;
                else if (azar > 0.65) ca = 87;
                else if (azar > 0.40) ca = 86;
                else ca = 85;
            }

            else if (rep >= 82) {
                const azar = Math.random();
                if (azar > 0.90) ca = 86;
                else if (azar > 0.70) ca = 85;   
                else if (azar > 0.40) ca = 84;   
                else ca = 83;
            }
            else {
                ca = Math.min(83, rep + (Math.random() * 2));
            }
        }
        else if (rol === 'TITULAR') {
            if (rep >= 88) {
                const azar = Math.random();
                if (azar > 0.85) ca = 85;      
                else if (azar > 0.65) ca = 84;
                else ca = 80 + (Math.random() * 4);
            } else {
                ca = rep - (Math.random() * 4 + 4); 
            }
        }
        else {
           if (rep >= 88) {
                ca = 76 + (Math.random() * 6);
            } else {
                ca = rep - (Math.random() * 8 + 12);
            }
        }
    }

    ca = Math.min(92, Math.max(15, Math.floor(ca)));
    
    let pa;
    if (esFilial) {
        const probCrackMundial = 0.01 + (nivelCantera * 0.02);
        if (Math.random() < probCrackMundial) {
            pa = 88 + (Math.random() * 11); 
        } else if (azarExcepcion > 0.80) {
            pa = 80 + (Math.random() * 8);
        } else {
            pa = ca + 10 + (nivelCantera * 2) + (Math.random() * 10); 
        }
    } else {
        let distanciaAlTop = 98 - ca;
        let azarTalento = Math.random();
        let factorAmbicion;

        if (azarTalento < 0.10) factorAmbicion = 0.80;
        else if (azarTalento < 0.30) factorAmbicion = 0.45; 
        else factorAmbicion = 0.15; 

        let factorEdad;
        if (edad < 22) factorEdad = 1.0;
        else if (edad < 26) factorEdad = 0.65; 
        else if (edad < 30) factorEdad = 0.20; 
        else factorEdad = 0.02;

        pa = ca + (distanciaAlTop * factorAmbicion * factorEdad);
    }

    let paFinal = Math.min(99, Math.max(ca, pa));

    return { 
        ca: Math.floor(ca), 
        pa: Math.floor(paFinal) 
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

function calcularSalario(ca, pa, edad, repClub) {
    let baseEfectiva = Math.max(0, ca - 40); 
    let salarioBase = Math.pow(baseEfectiva, 2.5) * 600; 

    // Factor Club 
    const factorClub = 0.8 + (repClub / 400); 
    salarioBase *= factorClub;

    // Factor Edad
    let factorEdad = 1.0;
    if (edad < 21) factorEdad = 0.7;      
    else if (edad >= 22 && edad <= 30) factorEdad = 1.15; 
    else if (edad > 32) factorEdad = 0.8; 

    // Factor Potencial
    let factorPotencial = (edad < 23 && (pa - ca) > 10) ? 1.15 : 1.0;

    // Ajuste Superestrella 
    let factorSuperestrella = (ca >= 85) ? (1 + (ca - 85) * 0.15) : 1.0;

    let salarioFinal = salarioBase * factorEdad * factorPotencial * factorSuperestrella;

    return Math.floor(Math.max(100000, salarioFinal) / 10000) * 10000;
}

function aplicarMentalidad(a) {
    const azar = Math.random();
    const mAlto = () => Math.floor(Math.random() * 15 + 80);
    const mMedio = () => Math.floor(Math.random() * 25 + 50);
    const mBajo = () => Math.floor(Math.random() * 30 + 20);
    
    // 1. LÍDER (15%)
    if (azar < 0.15) { 
        a.mental.liderazgo = mAlto();
        a.mental.composturaBajoPresion = mAlto();
        a.mental.motivacion = mMedio();
        a.mental.concentracion = mMedio();
        a.mental.agresividad = mMedio();
    } 
    // 2. GUERRERO (15%)
    else if (azar < 0.30) { 
        a.mental.agresividad = mAlto();
        a.mental.motivacion = mAlto();
        a.mental.liderazgo = mMedio();
        a.mental.concentracion = mMedio();
        a.mental.composturaBajoPresion = mMedio();
    } 
    // 3. FRÍO (10%)
    else if (azar < 0.40) { 
        a.mental.composturaBajoPresion = mAlto();
        a.mental.concentracion = mAlto();
        a.mental.motivacion = mMedio();
        a.mental.agresividad = mBajo();
        a.mental.liderazgo = mMedio();
    }
    // 4. AMBICIOSO (10%)
    else if (azar < 0.50) {
        a.mental.motivacion = mAlto();
        a.mental.concentracion = mMedio();
        a.mental.liderazgo = mMedio();
        a.mental.composturaBajoPresion = mMedio();
        a.mental.agresividad = mMedio();
    }
    // 5. IRREGULAR (10%)
    else if (azar < 0.60) { 
        a.mental.composturaBajoPresion = mBajo(); 
        a.mental.concentracion = mBajo();
        a.mental.motivacion = mMedio();
        a.mental.agresividad = mBajo();
        a.mental.liderazgo = mBajo();
    }
    // 6. INDISCIPLINADO (10%)
    else if (azar < 0.70) {
        a.mental.agresividad = mAlto();
        a.mental.concentracion = mBajo();
        a.mental.composturaBajoPresion = mMedio();
        a.mental.liderazgo = mBajo();
    }
    // 7. PASIVO (5%)
    else if (azar < 0.75) {
        a.mental.motivacion = mBajo();
        a.mental.agresividad = mBajo();
        a.mental.concentracion = mMedio();
        a.mental.composturaBajoPresion = mMedio();
        a.mental.liderazgo = mBajo();
    }
    // 8. ESTÁNDAR (25%)
    else { 
        Object.keys(a.mental).forEach(k => a.mental[k] = mMedio());
    }
    
    return a;
}

function generarAtributos(pos, val, arquetipo) {
    const esPortero = pos === 'POR';
    const MAX_TECNICO = 94;
    const MAX_FISICO = 96;
    const reduccion = (Math.random() * 0.1) + 0.95;

    // Especialista Técnico (tE) puntos a partir de 25 o asi seria mejor que el tB
    const tE = (puntos) => {
        const puntosVariables = puntos + (Math.random() * 20 - 10);
        let multiplicador = 0.82 + (puntosVariables / 300);
        let base = (val * reduccion) * multiplicador;
        const variacion = (Math.random() * 4) - 2;

        return Math.min(MAX_TECNICO, Math.floor(base + variacion));
    };

    // Técnico Base (tB): Para atributos donde el jugador cumple bien con porcentaje de que sea mejor o peor para mas aleatoriedad.
    const tB = () => {
        let factorSuerte = 0;
        const random = Math.random();

        if (random < 0.15) {
            factorSuerte = 0.08; 
        } else if (random > 0.90) {
            factorSuerte = -0.08; 
        }

        return Math.floor((val * reduccion) * (0.92 + factorSuerte + Math.random() * 0.05));
    };

    // Técnico Insuficiente (tI): Para debilidades.
    const tI = () => Math.floor((val * reduccion) * (0.35 + Math.random() * 0.1));

    // Físico Genético (fG): Rango base 30-85 + bono. No depende de 'val'.
    const fG = (bonusOriginal) => {
        let baseGenetica = 50 + Math.floor(Math.random() * 36); 
        let bonusAdaptado = (bonusOriginal / 40) * 15; 
        return Math.min(MAX_FISICO, baseGenetica + bonusAdaptado);
    };

    let a = {
        habilidad: { regate: tE(-10), controlBalon: tE(-10), desmarques: tE(-10) },
        tiro: { definicion: tE(-10), potenciaTiro: tE(-10), tiroLejano: tE(-10), lanzamientoFaltas: tE(-10), lanzamientoPenaltis: Math.floor(40 + Math.random() * 50), remateCabeza: tE(-10) },
        pase: { paseCorto: tE(-10), paseLargo: tE(-10), vision: tE(-10), centros: tE(-10) },
        defensa: { marcaje: tE(-10), entradas: tE(-10), intercepciones: tE(-10), despejes: tE(-10), duelosAereos: tE(-10), colocacion: tE(-10) },
        fisico: { velocidad: fG(0), aceleracion: fG(0), agilidad: fG(0), fuerza: fG(0), resistencia: fG(0), equilibrio: fG(0), salto: fG(0) },
        mental: { concentracion: tE(-10), liderazgo: tE(-10), agresividad: tE(-10), motivacion: tE(-10), composturaBajoPresion: tE(-10) },
        portero: { reflejos: 1, paradas: 1, estirada: 1, juegoAereo: 1, unoContraUno: 1, blocaje: 1, saque: 1, comunicacion: 1, penales: 1 }
    };

    if (['DFC'].includes(pos)) {
        a.habilidad.regate = tI(); a.habilidad.desmarques = tI();
        a.tiro.definicion = tI(); a.tiro.potenciaTiro = tI(); a.tiro.tiroLejano = tI(); a.tiro.remateCabeza = tB(); a.tiro.lanzamientoFaltas = tI();
        a.pase.centros = tI();
        a.defensa.marcaje = tB(); a.defensa.entradas = tB(); a.defensa.intercepciones = tB();
        a.defensa.despejes = tB(); a.defensa.duelosAereos = tB(); a.defensa.colocacion = tB();
        a.fisico.fuerza = fG(15); a.fisico.equilibrio = fG(15); a.fisico.salto = fG(15);
    }

    else if (['LD', 'LI'].includes(pos)) {
        a.habilidad.regate = tB(); a.habilidad.controlBalon = tB();
        a.tiro.definicion = tI(); a.tiro.potenciaTiro = tI(); a.tiro.tiroLejano = tI(); a.tiro.remateCabeza = tI(); a.tiro.lanzamientoFaltas = tI();
        a.pase.centros = tE(35); a.pase.paseCorto = tB(); a.pase.paseLargo = tE(20);
        a.defensa.marcaje = tB(); a.defensa.entradas = tB(); a.defensa.colocacion = tB(); a.defensa.intercepciones = tB();
        a.fisico.resistencia = fG(20); a.fisico.velocidad = fG(15); a.fisico.aceleracion = fG(15);
        a.fisico.agilidad = fG(15); a.fisico.equilibrio = fG(10); 
    }

    else if (['MCD'].includes(pos)) {
        a.habilidad.regate = tI(); a.habilidad.controlBalon = tB(); a.habilidad.desmarques = tI();
        a.tiro.definicion = tI(); a.tiro.remateCabeza = tB();
        a.pase.paseCorto = tB(); a.pase.paseLargo = tB(); a.pase.vision = tB(); 
        a.defensa.intercepciones = tB(); a.defensa.entradas = tB(); a.defensa.colocacion = tB();
        a.defensa.marcaje = tB(); a.defensa.duelosAereos = tB(); a.defensa.despejes = tB();
        a.fisico.resistencia = fG(10); a.fisico.fuerza = fG(15); a.fisico.equilibrio = fG(15); a.fisico.salto = fG(15);
    }

    else if (['MC'].includes(pos)) {
        a.habilidad.controlBalon = tB(); a.habilidad.regate = tB();
        a.pase.paseCorto = tB(); a.pase.vision = tB(); a.pase.paseLargo = tB(); a.pase.centros = tB();
        a.fisico.velocidad = fG(10); a.fisico.aceleracion = fG(10); a.fisico.agilidad = fG(10); a.fisico.resistencia = fG(20); a.fisico.fuerza = fG(10);
    }

    else if (['MCO'].includes(pos)) {
        a.habilidad.controlBalon = tB(); a.habilidad.regate = tB(); a.habilidad.desmarques = tB();
        a.tiro.definicion = tB(); a.tiro.potenciaTiro = tB();
        a.pase.paseCorto = tB(); a.pase.vision = tB(); a.pase.paseLargo = tB(); a.pase.centros = tB();
        a.defensa.intercepciones = tI(); a.defensa.entradas = tI(); a.defensa.colocacion = tI(); a.defensa.marcaje = tI(); a.defensa.despejes = tI();
        a.fisico.velocidad = fG(10); a.fisico.aceleracion = fG(10); a.fisico.agilidad = fG(15); a.fisico.resistencia = fG(10);
    }

    else if (['MD', 'MI'].includes(pos)) {
        a.habilidad.regate = tB(); a.habilidad.controlBalon = tB();
        a.pase.paseCorto = tB(); a.pase.centros = tE(35);
        a.fisico.velocidad = fG(15); a.fisico.aceleracion = fG(15); a.fisico.agilidad = fG(20); a.fisico.resistencia = fG(20); a.fisico.equilibrio = fG(15);
    }

    else if (['ED', 'EI'].includes(pos)) {
        a.habilidad.regate = tB(); a.habilidad.controlBalon = tB();
        a.tiro.potenciaTiro = tE(15); a.tiro.tiroLejano = tB();
        a.pase.paseCorto = tB(); a.pase.centros = tE(35);
        a.defensa.intercepciones = tI(); a.defensa.entradas = tI(); a.defensa.colocacion = tI(); a.defensa.marcaje = tI(); a.defensa.despejes = tI();
        a.fisico.velocidad = fG(20); a.fisico.aceleracion = fG(20); a.fisico.agilidad = fG(20); a.fisico.resistencia = fG(20); a.fisico.equilibrio = fG(15);
    }

    else if (['DC', 'SD'].includes(pos)) {
        a.habilidad.controlBalon = tB(); a.habilidad.desmarques = tE(30);
        a.tiro.definicion = tB(); a.tiro.potenciaTiro = tB(); a.tiro.tiroLejano = tB(); a.tiro.lanzamientoPenaltis = Math.floor(60 + Math.random() * 30); a.tiro.remateCabeza = tB();
        a.pase.paseCorto = tB();
        a.defensa.intercepciones = tI(); a.defensa.entradas = tI(); a.defensa.colocacion = tI(); a.defensa.marcaje = tI(); a.defensa.despejes = tI();
        a.fisico.equilibrio = fG(15); a.fisico.salto = fG(12);
    }

    a = aplicarMentalidad(a);

    switch(arquetipo) {
        // --- PORTEROS ---
        case 'CASILLAS':
            a.portero.reflejos = tE(60); a.portero.unoContraUno = tE(55); a.portero.estirada = tE(50);
            a.portero.penales = tE(45); a.portero.juegoAereo = tE(-15); a.fisico.agilidad = fG(35); break;
        case 'BUFFON':
            a.defensa.colocacion = tE(60); a.portero.paradas = tE(55); a.portero.estirada = tE(45); 
            a.portero.blocaje = tE(45); break;
        case 'COURTOIS':
            a.portero.juegoAereo = tE(60); a.portero.paradas = tE(55); a.portero.blocaje = tE(50);
            a.portero.reflejos = tE(45); break;
        case 'TER_STEGEN':
            a.portero.saque = tE(60); a.pase.paseCorto = tE(20); a.habilidad.controlBalon = tE(20);
            a.portero.reflejos = tE(45); a.portero.paradas = tE(40); break;
        case 'DIBU':
            a.portero.penales = tE(60); a.portero.paradas = tE(35); a.portero.blocaje = tE(35); 
            a.mental.composturaBajoPresion = tE(55); break;
        case 'ALISSON':
            a.portero.reflejos = tE(45); a.portero.unoContraUno = tE(45); a.portero.saque = tE(35);
            a.portero.juegoAereo = tE(40); a.portero.comunicacion = tE(35); break;
        case 'NEUER':
            a.portero.saque = tE(60); a.pase.paseCorto = tE(20); a.portero.unoContraUno = tE(55);
            a.habilidad.controlBalon = tE(15); a.portero.comunicacion = tE(50); a.portero.blocaje = tE(45); break;
        case 'OBLAK': 
            a.portero.blocaje = tE(60); a.portero.paradas = tE(55); a.portero.reflejos = tE(50);
            a.portero.saque = tE(-20); a.portero.unoContraUno = tE(45); break;
        case 'KEYLOR': 
            a.portero.reflejos = tE(60); a.portero.estirada = tE(55); a.portero.paradas = tE(35);
            a.portero.blocaje = tE(-20); a.fisico.agilidad = fG(30); a.fisico.salto = fG(30); break;
        case 'KAHN': 
            a.portero.comunicacion = tE(60); a.portero.paradas = tE(50); a.portero.blocaje = tE(45);
            a.portero.juegoAereo = tE(45); a.fisico.salto = fG(25); break;

        // --- LATERALES ---
        case 'ROBERTO_CARLOS':
            a.fisico.velocidad = fG(35); a.fisico.aceleracion = fG(35); a.tiro.potenciaTiro = tE(60); 
            a.tiro.tiroLejano = tE(60); a.tiro.lanzamientoFaltas = tE(50); a.habilidad.regate = tE(35); 
            a.defensa.marcaje = tE(-25); break;
        case 'MARCELO':
            a.habilidad.controlBalon = tE(60); a.habilidad.regate = tE(60); a.pase.centros = tE(50);
            a.fisico.aceleracion = fG(10); a.fisico.velocidad = fG(10); a.defensa.marcaje = tE(-15); 
            a.defensa.colocacion = tE(-25); a.tiro.tiroLejano = tE(30); break;
        case 'JORDI_ALBA':
            a.fisico.velocidad = fG(45); a.fisico.aceleracion = fG(45);
            a.pase.centros = tE(55); a.defensa.marcaje = tE(40); break;
        case 'MENDY':
            a.defensa.marcaje = tE(60); a.defensa.entradas = tE(60); a.fisico.fuerza = fG(35);
            a.fisico.aceleracion = fG(25); a.fisico.velocidad = fG(25); a.pase.centros = tE(-20); a.defensa.colocacion = tE(45); break;
        case 'ARNOLD':
            a.pase.centros = tE(60); a.pase.paseLargo = tE(55); a.pase.vision = tE(55); a.tiro.lanzamientoFaltas = tE(30);
            a.fisico.aceleracion = fG(0); a.fisico.velocidad = fG(0); a.defensa.marcaje = tE(5); break;
        case 'LAHM':
            a.pase.centros = tE(55); a.pase.paseLargo = tE(50); a.pase.paseCorto = tE(55); a.pase.vision = tE(55);
            a.defensa.marcaje = tE(55);  a.tiro.lanzamientoFaltas = tE(25); break;
        case 'HAKIMI_MENDES':
            a.fisico.aceleracion = fG(45); a.fisico.velocidad = fG(45); a.fisico.resistencia = fG(42);
            a.pase.centros = tE(50); a.habilidad.regate = tE(45); a.defensa.entradas = tE(30); break;
        case 'CARVAJAL':
            a.fisico.resistencia = fG(40); a.pase.centros = tE(50); a.defensa.entradas = tE(50);
            a.defensa.marcaje = tE(50); a.fisico.aceleracion = fG(10); a.fisico.velocidad = fG(10); break;

        // --- CENTRALES ---
        case 'PIQUE':
            a.pase.paseCorto = tE(55); a.pase.paseLargo = tE(50); a.habilidad.controlBalon = tE(50);
            a.defensa.colocacion = tE(55); a.fisico.velocidad = fG(-10); a.fisico.aceleracion = fG(-10); break;
        case 'RAMOS':
            a.tiro.remateCabeza = tE(60); a.fisico.salto = fG(45); a.mental.liderazgo = tE(60);  a.tiro.lanzamientoFaltas = tE(30);
            a.defensa.marcaje = tE(55); a.defensa.intercepciones = tE(50); a.fisico.velocidad = fG(25); break;
        case 'PEPE':
            a.mental.agresividad = tE(60); a.defensa.entradas = tE(60); a.fisico.fuerza = fG(40);
            a.defensa.marcaje = tE(50); break;
        case 'VARANE':
            a.fisico.velocidad = fG(45); a.fisico.aceleracion = fG(40);
            a.defensa.intercepciones = tE(50); a.defensa.marcaje = tE(45); break;
        case 'MAGUIRE':
            a.fisico.fuerza = fG(45); a.defensa.duelosAereos = fG(45); a.tiro.remateCabeza = tE(55);
            a.fisico.velocidad = fG(-25); a.fisico.aceleracion = fG(-25); a.pase.paseCorto = tE(15); break;
        case 'KOEMAN':
            a.tiro.potenciaTiro = tE(60); a.tiro.lanzamientoFaltas = tE(50); a.tiro.tiroLejano = tE(60);
            a.defensa.marcaje = tE(45); break;
        case 'NACHO':
            a.defensa.marcaje = tE(45); a.defensa.entradas = tE(45); a.pase.paseCorto = tE(40);
            a.fisico.velocidad = fG(15); a.fisico.resistencia = fG(35); break;
        case 'VAN_DIJK': 
            a.defensa.marcaje = tE(60); a.defensa.duelosAereos = fG(45); a.defensa.colocacion = tE(60);
            a.fisico.fuerza = fG(40); a.pase.paseLargo = tE(45); break;
        case 'LISANDRO': 
            a.mental.agresividad = tE(60); a.defensa.entradas = tE(55); a.pase.paseCorto = tE(55);
            a.fisico.salto = fG(35); a.fisico.velocidad = fG(20); break;

        // --- MEDIOCENTROS ---
        case 'BUSQUETS_ALONSO':
            a.pase.vision = tE(60); a.pase.paseCorto = tE(60); a.pase.paseLargo = tE(55);
            a.fisico.velocidad = fG(-25); a.fisico.aceleracion = fG(-25); a.tiro.lanzamientoFaltas = tE(30); break;
        case 'CASEMIRO':
            a.defensa.entradas = tE(60); a.fisico.fuerza = fG(40); a.defensa.intercepciones = tE(55);
            a.tiro.remateCabeza = tE(50); break;
        case 'KANTE':
            a.fisico.resistencia = fG(55); a.fisico.velocidad = fG(20); a.defensa.colocacion = tE(55);
            a.defensa.intercepciones = tE(60); a.pase.paseCorto = tE(40); break;
        case 'RODRI':
            a.pase.paseCorto = tE(60); a.defensa.colocacion = tE(60); a.tiro.tiroLejano = tE(50);
            a.fisico.fuerza = fG(30); a.tiro.lanzamientoFaltas = tE(40); break;
        case 'XAVI_KROOS':
            a.pase.paseCorto = tE(60); a.pase.paseLargo = tE(60); a.tiro.potenciaTiro = tE(50);
            a.fisico.velocidad = fG(-15); a.defensa.marcaje = tE(-15); a.tiro.lanzamientoFaltas = tE(45); break;
        case 'INIESTA_MODRIC':
            a.habilidad.controlBalon = tE(60); a.habilidad.regate = tE(55); a.pase.vision = tE(55);
            a.fisico.resistencia = fG(35); break;
        case 'VALVERDE':
            a.fisico.velocidad = fG(35); a.fisico.aceleracion = fG(35); a.fisico.resistencia = fG(42);
            a.tiro.potenciaTiro = tE(60); a.tiro.tiroLejano = tE(55); a.defensa.entradas = tE(35); break;
        case 'PIRLO': 
            a.pase.vision = tE(60); a.tiro.lanzamientoFaltas = tE(60); a.pase.paseLargo = tE(60);
            a.defensa.entradas = tE(-25); a.fisico.resistencia = tE(25); break;
        case 'GATTUSO':
            a.mental.agresividad = tE(60); a.fisico.resistencia = fG(42); a.defensa.entradas = tE(60);
            a.pase.paseCorto = tE(35); a.habilidad.controlBalon = tE(25); a.tiro.tiroLejano = tE(-20); break;
        case 'MC_LLEGADOR':
            a.tiro.definicion = tE(50); a.tiro.potenciaTiro = tE(50); a.habilidad.desmarques = tE(45);
            a.defensa.entradas = tE(-25); a.defensa.marcaje = tE(-25); break;

        // --- MCO/EXTREMOS ---
        case 'BELLINGHAM':
            a.habilidad.desmarques = tE(55); a.tiro.definicion = tE(50); a.tiro.remateCabeza = tE(50);
            a.fisico.resistencia = fG(35); a.defensa.entradas = tE(40); a.defensa.marcaje = tE(30); break;
        case 'OZIL':
            a.pase.vision = tE(60); a.pase.paseCorto = tE(55); a.habilidad.controlBalon = tE(55);
            a.defensa.marcaje = tE(-25); a.tiro.definicion = tE(20); break;
        case 'DYBALA':
            a.habilidad.regate = tE(55); a.habilidad.controlBalon = tE(55); a.tiro.definicion = tE(55);
            a.tiro.lanzamientoFaltas = tE(55); a.defensa.marcaje = tE(-25); break;
        case 'DE_BRUYNE':
            a.tiro.tiroLejano = tE(60); a.pase.vision = tE(60); a.pase.paseLargo = tE(60); a.tiro.potenciaTiro = tE(55);
            a.defensa.entradas = tE(20); a.tiro.lanzamientoFaltas = tE(40); break;
        case 'POTENTE':
            a.tiro.potenciaTiro = tE(60); a.tiro.tiroLejano = tE(60); a.tiro.definicion = tE(35); break;
        case 'MESSI':
            a.habilidad.regate = tE(60); a.habilidad.controlBalon = tE(60); a.pase.vision = tE(60);
            a.tiro.lanzamientoFaltas = tE(55); a.tiro.definicion = tE(60); a.fisico.velocidad = fG(25); a.fisico.aceleracion = fG(30); break;
        case 'CRISTIANO':
            a.tiro.definicion = tE(60); a.tiro.potenciaTiro = tE(60); a.fisico.salto = fG(45); a.tiro.lanzamientoFaltas = tE(30); 
            a.habilidad.regate = tE(40); a.habilidad.desmarques = tE(40); a.tiro.remateCabeza = tE(55); a.fisico.velocidad = fG(40); a.fisico.aceleracion = fG(40); break;
        case 'BALE':
            a.fisico.aceleracion = fG(48); a.fisico.velocidad = fG(48); a.tiro.potenciaTiro = tE(45); 
            a.tiro.tiroLejano = tE(45); a.pase.centros = tE(55); a.defensa.entradas = tE(15); break;
        case 'VINI':
            a.fisico.aceleracion = fG(45); a.fisico.velocidad = fG(45); a.habilidad.regate = tE(60); 
            a.tiro.definicion = tE(40); a.habilidad.controlBalon = tE(50); break;
        case 'RONALDINHO':
            a.habilidad.controlBalon = tE(60); a.habilidad.regate = tE(60); a.pase.vision = tE(55);
            a.defensa.marcaje = tE(-25); a.fisico.aceleracion = fG(20); break;
        case 'GREALISH':
            a.pase.centros = tE(55); a.pase.vision = tE(50); a.habilidad.controlBalon = tE(45);
            a.fisico.aceleracion = fG(5); a.defensa.entradas = tE(15); a.tiro.lanzamientoFaltas = tE(40); break;

        // --- DELANTEROS ---
        case 'LEWAN_SUAREZ':
            a.tiro.definicion = tE(60); a.habilidad.desmarques = tE(55); a.tiro.remateCabeza = tE(55);
            a.tiro.potenciaTiro = tE(55); a.fisico.aceleracion = fG(10); break;
        case 'BENZEMA':
            a.habilidad.controlBalon = tE(55); a.pase.paseCorto = tE(50); a.tiro.definicion = tE(55);
            a.tiro.remateCabeza = tE(45); a.fisico.aceleracion = fG(10); break;
        case 'MBAPPE_RONALDO':
            a.fisico.aceleracion = fG(48); a.fisico.velocidad = fG(48); a.habilidad.regate = tE(55); 
            a.tiro.definicion = tE(60); a.tiro.potenciaTiro = tE(55); break;
        case 'HAALAND':
            a.tiro.definicion = tE(60); a.fisico.fuerza = fG(40); a.tiro.potenciaTiro = tE(60);
            a.fisico.velocidad = fG(40); a.tiro.remateCabeza = tE(55); break;
        case 'JOSELU_LLORENTE':
            a.tiro.remateCabeza = tE(60); a.defensa.duelosAereos = tE(55); a.fisico.fuerza = fG(35);
            a.fisico.velocidad = fG(-20); break;
        case 'MURIQI':
            a.tiro.remateCabeza = tE(60); a.defensa.duelosAereos = fG(50); a.pase.vision = tE(45);
            a.habilidad.controlBalon = tE(40); a.fisico.fuerza = fG(35); break;
        case 'RAUL':
            a.habilidad.desmarques = tE(60); a.tiro.definicion = tE(60); a.habilidad.controlBalon = tE(35);
            a.tiro.potenciaTiro = tE(40); break;
    }

    if (esPortero) {
        Object.keys(a.habilidad).forEach(k => {
            a.habilidad[k] = Math.floor(tI() * (0.3 + Math.random() * 0.2))
        });
        Object.keys(a.tiro).forEach(k => {
            a.tiro[k] = Math.floor(tI() *(0.3 + Math.random() * 0.2))
        });
        Object.keys(a.pase).forEach(k => {
             a.pase[k] = Math.min(45, a.pase[k]); 
        });
        Object.keys(a.defensa).forEach(k => {
            a.defensa[k] = Math.floor(a.defensa[k] * (0.3 + Math.random() * 0.2));
        });
        Object.keys(a.pase).forEach(k => {
        if (k === 'paseCorto' || k === 'paseLargo') {
            let factorGolpeo = (0.75 + Math.random() * 0.1); 
            a.pase[k] = Math.floor(a.pase[k] * factorGolpeo);
        } else {
            let factorCreacion = (0.35 + Math.random() * 0.15);
            a.pase[k] = Math.floor(a.pase[k] * factorCreacion);
        }
    });
       
        a.fisico.resistencia = Math.floor(a.fisico.resistencia * (0.50 + Math.random() * 0.1));
        a.fisico.velocidad = Math.floor(a.fisico.velocidad * (0.55 + Math.random() * 0.1)); 
        a.fisico.aceleracion = Math.floor(a.fisico.aceleracion * (0.55 + Math.random() * 0.1));
        a.fisico.agilidad = Math.max(a.fisico.agilidad, (a.portero.reflejos - 5) - Math.floor(Math.random() * 5));
        a.fisico.salto = Math.max(a.fisico.salto, (a.portero.juegoAereo - 5) - Math.floor(Math.random() * 5));
        a.fisico.fuerza = Math.floor(a.fisico.fuerza * (0.8 + Math.random() * 0.1)); 
        a.fisico.equilibrio = Math.floor(a.fisico.equilibrio * (0.8 + Math.random() * 0.1));
            
        Object.keys(a.portero).forEach(k => { 
            if(a.portero[k] === 1) a.portero[k] = tB() + 5; 
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