// backend/routes/juego.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const clubesDAO = require('../daos/clubesDAO');
// Modelos
const Partida = require('../models/partida');
const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Partido = require('../models/partido');
const Competicion = require('../models/competicion');

const { FORMACIONES } = require('../service/cargarFormaciones');
// Motor
const { simularPartido, simularTramoMinutos } = require('../engine/motorJuego');
const { requireLogin } = require('../middleware/autenticacion');

async function simularPartidosPendientes(partidaId, fecha, clubUsuarioId) {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    const partidos = await Partido.find({
        partidaId: partidaId,
        jugado: false,
        fecha: { $gte: inicioDia, $lte: finDia }
    }).populate('equipoLocal equipoVisitante');

    //Creamos una matriz de promesas para procesar todos los partidos en paralelo
    const promesasSimulacion = partidos.map(async (partido) => {
        // SI ES EL PARTIDO DEL USUARIO, LO SALTAMOS
        const esPartidoUsuario = partido.equipoLocal._id.toString() === clubUsuarioId.toString() || 
                                 partido.equipoVisitante._id.toString() === clubUsuarioId.toString();
        
        if (esPartidoUsuario) return; 

        // Se ejecutan en paralelo las convocatorias del local y visitante de este partido
        const [convocatoriaLocal, convocatoriaVisitante] = await Promise.all([
            seleccionarConvocatoriaIA(
                partido.equipoLocal._id, 
                partido.equipoLocal.reputacion || 50, 
                partido.competicionId?.toString()
            ),
            seleccionarConvocatoriaIA(
                partido.equipoVisitante._id, 
                partido.equipoLocal.reputacion || 50, 
                partido.competicionId?.toString()
            )
        ]);

        const jugadoresLocal = convocatoriaLocal.titulares;
        const jugadoresVisitante = convocatoriaVisitante.titulares;

        // LÓGICA PARA ELIMINATORIAS REPARADA (IA)
        let opcionesEliminatoria = { esVuelta: false, esIda: false };
        if (partido.tipo === 'ELIMINATORIA') {
            const partidoIda = await Partido.findOne({
                partidaId: partido.partidaId,
                competicionId: partido.competicionId,
                llave: partido.llave, 
                equipoLocal: partido.equipoVisitante._id,
                equipoVisitante: partido.equipoLocal._id,
                jugado: true
            });

            if (partidoIda) {
                opcionesEliminatoria = {
                    esVuelta: true,
                    esIda: false,
                    golesIdaLocal: partidoIda.golesLocal, 
                    golesIdaVisitante: partidoIda.golesVisitante  
                };
            } else {
                // Si no hay ida jugada, miramos si hay una vuelta agendada en el futuro
                const tieneVueltaProgramada = await Partido.findOne({
                    partidaId: partido.partidaId,
                    competicionId: partido.competicionId,
                    llave: partido.llave,
                    equipoLocal: partido.equipoVisitante._id,
                    equipoVisitante: partido.equipoLocal._id,
                    jugado: false
                });

                if (tieneVueltaProgramada) {
                    opcionesEliminatoria.esIda = true;
                }
            }
        }

        // Simulación matemática instantánea en memoria
        let resultado = simularPartido(
            { id: partido.equipoLocal._id, nombre: partido.equipoLocal.nombre, jugadores: jugadoresLocal },
            { id: partido.equipoVisitante._id, nombre: partido.equipoVisitante.nombre, jugadores: jugadoresVisitante },
            partido.tipo, 
            opcionesEliminatoria 
        );

        partido.golesLocal = resultado.marcador.local;
        partido.golesVisitante = resultado.marcador.visitante;
        partido.formacionLocal = partido.equipoLocal.formacion || '4-3-3';
        partido.formacionVisitante = partido.equipoVisitante.formacion || '4-3-3';

        if (resultado.ganadorPenaltis) {
            partido.ganadorPenaltis = resultado.ganadorPenaltis;
            partido.marcadorTanda = {
                golesLocal: resultado.marcadorTanda.local,
                golesVisitante: resultado.marcadorTanda.visitante
            };
        } else {
            partido.ganadorPenaltis = null;
            partido.marcadorTanda = { golesLocal: null, golesVisitante: null }; 
        }

        partido.jugado = true;
        return partido.save();  
    });

    await Promise.all(promesasSimulacion);
}

// Rendimiento base según la calidad física/técnica actual + potencial
function calcularNivel(jugador, posicionAValorar) {
    const forma = jugador.estado?.forma ?? 100;
    const moral = jugador.estado?.moral ?? 100;
    const rendimiento = jugador.estado?.rendimiento ?? 80;

    // Mezcla de calidad presente (80%) y destellos de futuro (20%)
    const capacidadActual = (jugador.valoracion * 0.8) + (jugador.potencial * 0.2);
    let nivelBase = (capacidadActual * 0.55) + (forma * 0.20) + (rendimiento * 0.15) + (moral * 0.10);
    // Penalización por jugar fuera de su rol natural
    if (jugador.posicionPrincipal !== posicionAValorar) {
        const secundarias = jugador.posicionesSecundarias || [];
        const adaptacion = secundarias.includes(posicionAValorar) ? 0.90 : 0.60;
        nivelBase *= adaptacion;
    }

    return nivelBase;
}

// CONVOCATORIA INTELIGENTE DE LA IA
async function seleccionarConvocatoriaIA(clubId, rivalReputacion, competicionId) {
    const club = await Club.findById(clubId);
    if (!club) return { 
        titulares: [], 
        suplentes: [], 
        formacion: '4-3-3', 
        estiloJuego: 'ESTÁNDAR', 
        mentalidad: 'EQUILIBRADA' 
    };

    // 1. Obtener los dos bloques de jugadores en paralelo para optimizar
    const [plantillaPrimerEquipo, filial] = await Promise.all([
        Jugador.find({ clubActual: clubId }),
        Club.findOne({ clubMatriz: clubId }).populate('plantilla')
    ]);

    // Helper para filtrar sanos y disponibles
    const filtrarDisponibles = (jugadores, formaMinima) => {
        return jugadores.filter(j => {
            if (j.estado?.lesion !== null) return false;
            if ((j.estado?.forma ?? 100) < formaMinima) return false; 
            if (j.estado?.sanciones && j.estado.sanciones.length > 0) {
                const sancionActiva = j.estado.sanciones.find(s => s.competicionId === competicionId && s.partidosRestantes > 0);
                if (sancionActiva) return false;
            }
            return true;
        });
    };

    // 2. Filtrar disponibles de ambos conjuntos
    const primerEquipoSanos = filtrarDisponibles(plantillaPrimerEquipo, 40);
    const canteranosSanos = filial && filial.plantilla ? filtrarDisponibles(filial.plantilla, 50) : [];

    // Marcamos a los canteranos para identificarlos después si entran en la lista final
    canteranosSanos.forEach(c => c.esCanteranoPromocionado = true);

    // ¡La gran fusión! Todos compiten en el mismo saco
    let todosLosDisponibles = [...primerEquipoSanos, ...canteranosSanos];

    // 3. Determinar política de rotación
    const diferenciaReputacion = club.reputacion - rivalReputacion;
    let nivelRotacion = 'NINGUNA';
    if (diferenciaReputacion > 20 && diferenciaReputacion <= 30) nivelRotacion = 'MODERADA';
    else if (diferenciaReputacion > 30) nivelRotacion = 'INTENSA'; 

    const configuracionFormacion = FORMACIONES[club.tactica?.formacion] || FORMACIONES[formacionPredefinida] || FORMACIONES['4-3-3'];
    const posicionesRequeridas = configuracionFormacion.posiciones;

    const titulares = [];
    const elegidosIds = new Set();

    // 4. Selección de Titulares puesto por puesto (Meritocracia pura)
    for (const posicion of posicionesRequeridas) {
        let candidatos = todosLosDisponibles
            .filter(j => j.posicionPrincipal === posicion && !elegidosIds.has(j._id.toString()))
            .map(j => {
                let pesoAlineacion = calcularNivel(j, posicion);
                const formaJugador = j.estado?.forma ?? 100;

                // Penalizaciones y bonos de rotación aplicados justamente a todos
                if (nivelRotacion === 'MODERADA' && formaJugador < 85) {
                    pesoAlineacion -= 10; 
                } 
                else if (nivelRotacion === 'INTENSA') {
                    if (formaJugador < 93) pesoAlineacion -= 20; 
                    if (j.edad <= 22 && j.potencial > j.valoracion) pesoAlineacion += 8; 
                }

                if (j.esCanteranoPromocionado) {
                    if (nivelRotacion === 'NINGUNA') {
                        pesoAlineacion -= 10; 
                    } 
                    else if (nivelRotacion === 'MODERADA') {
                        pesoAlineacion -= 5;
                    }
                }

                return { jugador: j, peso: pesoAlineacion };
            })
            .sort((a, b) => b.peso - a.peso);

        // Si no hay especialistas potentes, buscamos parches en el saco global (puede ser un canterano polivalente)
        if (candidatos.length === 0 || candidatos[0].peso < 30) {
            const parches = todosLosDisponibles
                .filter(j => !elegidosIds.has(j._id.toString()) && 
                            (j.posicionPrincipal === posicion || (j.posicionesSecundarias || []).includes(posicion)))
                .sort((a, b) => calcularNivel(b, posicion) - calcularNivel(a, posicion));
            
            if (parches.length > 0) {
                const elegido = parches[0];
                titulares.push(elegido);
                elegidosIds.add(elegido._id.toString());
                continue; 
            }
        }

        if (candidatos.length > 0) {
            const elegido = candidatos[0].jugador;
            titulares.push(elegido);
            elegidosIds.add(elegido._id.toString());
        }
    }

    // 5. Confección del banquillo reglamentario (13 suplentes de entre los que quedan)
    let suplentes = todosLosDisponibles
        .filter(j => !elegidosIds.has(j._id.toString()))
        .sort((a, b) => calcularNivel(b, b.posicionPrincipal) - calcularNivel(a, a.posicionPrincipal))
        .slice(0, 13);

    while (suplentes.length < 13) {
        suplentes.push(null);
    }

    // 6. PERSISTENCIA EN BBDD: ¿Quiénes han ganado un puesto en la convocatoria?
    const convocadosFinales = [...titulares, ...suplentes].filter(j => j !== null);
    
    // Filtramos cuáles de los ganadores de la convocatoria son de la cantera
    const canteranosQueVanConvocados = convocadosFinales.filter(j => j.esCanteranoPromocionado);

    // Los registramos en el array de la plantilla del primer equipo antes del partido
    for (const canterano of canteranosQueVanConvocados) {
        await clubesDAO.convocarCanterano(clubId, canterano._id);
    }

    return { 
        titulares, 
        suplentes,
        formacion: club.tactica?.formacion,
        estiloJuego: club.tactica?.estiloJuego,
        mentalidad: club.tactica?.mentalidad
    };
}

// RUTA PARA SIMULAR EL PARTIDO RAPIDO
router.get('/jugar_rapido/:idPartido', requireLogin, async (req, res) => {
    try {
        const partidoId = req.params.idPartido;
        
        const partidoUsuario = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
        if (!partidoUsuario) return res.status(404).send("Partido no encontrado.");

        // Traemos la partida primero para tener el ID real e inapelable del club del usuario
        const partidaJuego = await Partida.findById(partidoUsuario.partidaId).populate('clubSeleccionado');
        if (!partidaJuego) return res.status(404).send("Partida no encontrada.");

        const clubUsuarioId = partidaJuego.clubSeleccionado._id.toString();

        // Ahora buscamos el club del usuario con sus populates tácticos usando el ID real
        const clubUsuarioReal = await Club.findById(clubUsuarioId).populate('tactica.titulares').populate('tactica.suplentes');
        
        if (!clubUsuarioReal) return res.status(404).send("Club del mánager no encontrado.");
        
        // Extraemos los jugadores desde el objeto tactica
        const titularesUsuario = clubUsuarioReal.tactica?.titulares || [];
        const suplentesUsuario = clubUsuarioReal.tactica?.suplentes || [];
        const convocadosUsuario = [...titularesUsuario, ...suplentesUsuario];
        
        const tieneBajasConvocadas = convocadosUsuario.some(jugador => {
            if (!jugador) return false;
            const lesionado = jugador.estado?.lesion !== null && jugador.estado?.lesion !== undefined;
            let sancionado = false;
            if (jugador.estado?.sanciones && Array.isArray(jugador.estado.sanciones)) {
                sancionado = jugador.estado.sanciones.some(s => 
                    s && s.competicionId === partidoUsuario.competicionId && s.partidosRestantes > 0
                );
            }
            return lesionado || sancionado;
        });

        if (tieneBajasConvocadas) {
            return res.redirect(`/tactica?errorConvocatoria=true`);
        }

        const inicioDia = new Date(partidaJuego.fechaActual);
        inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(partidaJuego.fechaActual);
        finDia.setHours(23, 59, 59, 999);

        const partidosDeHoy = await Partido.find({
            partidaId: partidoUsuario.partidaId, 
            jugado: false,
            fecha: { $gte: inicioDia, $lte: finDia }
        }).populate('equipoLocal equipoVisitante');

        let resultadoUsuario = null;
        let equipoLocalUsuario = null;
        let equipoVisitanteUsuario = null;

        // DEFINIMOS E INYECTAMOS LAS PROMESAS CORRECTAMENTE
        const promesasPartidos = partidosDeHoy.map(async (partido) => {
            let equipoLocalData = { id: partido.equipoLocal._id, nombre: partido.equipoLocal.nombre, jugadores: [], suplentes: [] };
            let equipoVisitanteData = { id: partido.equipoVisitante._id, nombre: partido.equipoVisitante.nombre, jugadores: [], suplentes: [] };

            const esLocalUsuario = partido.equipoLocal._id.toString() === clubUsuarioId;
            const esVisitanteUsuario = partido.equipoVisitante._id.toString() === clubUsuarioId;

            const promesasConvocatoria = [];
            
            if (esLocalUsuario) {
                equipoLocalData.jugadores = titularesUsuario;
                equipoLocalData.suplentes = suplentesUsuario;
            } else {
                promesasConvocatoria.push(
                    seleccionarConvocatoriaIA(partido.equipoLocal._id, partido.equipoVisitante.reputacion, partido.competicionId)
                    .then(c => { equipoLocalData.jugadores = c.titulares; equipoLocalData.suplentes = c.suplentes; })
                );
            }

            if (esVisitanteUsuario) {
                equipoVisitanteData.jugadores = titularesUsuario;
                equipoVisitanteData.suplentes = suplentesUsuario;
            } else {
                promesasConvocatoria.push(
                    seleccionarConvocatoriaIA(partido.equipoVisitante._id, partido.equipoLocal.reputacion, partido.competicionId)
                    .then(c => { equipoVisitanteData.jugadores = c.titulares; equipoVisitanteData.suplentes = c.suplentes; })
                );
            }

            await Promise.all(promesasConvocatoria);
            
            let opcionesEliminatoria = { esVuelta: false, esIda: false };
            if (partido.tipo === 'ELIMINATORIA') {
                const partidoIda = await Partido.findOne({
                    partidaId: partido.partidaId,
                    competicionId: partido.competicionId,
                    llave: partido.llave,
                    equipoLocal: partido.equipoVisitante._id,
                    equipoVisitante: partido.equipoLocal._id,
                    jugado: true
                });

                if (partidoIda) {
                    opcionesEliminatoria = {
                        esVuelta: true,
                        esIda: false,
                        golesIdaLocal: partidoIda.golesLocal,
                        golesIdaVisitante: partidoIda.golesVisitante
                    };
                } else {
                    const tieneVueltaProgramada = await Partido.findOne({
                        partidaId: partido.partidaId,
                        competicionId: partido.competicionId,
                        llave: partido.llave,
                        equipoLocal: partido.equipoVisitante._id,
                        equipoVisitante: partido.equipoLocal._id,
                        jugado: false
                    });

                    if (tieneVueltaProgramada) opcionesEliminatoria.esIda = true;
                }
            }

            const resultado = simularPartido(equipoLocalData, equipoVisitanteData, partido.tipo, opcionesEliminatoria);

            partido.golesLocal = resultado.marcador.local;
            partido.golesVisitante = resultado.marcador.visitante; 
            
            if (resultado.ganadorPenaltis) {
                partido.ganadorPenaltis = resultado.ganadorPenaltis;
                partido.marcadorTanda = {
                    golesLocal: resultado.marcadorTanda.local,
                    golesVisitante: resultado.marcadorTanda.visitante
                };
            } else {
                partido.ganadorPenaltis = null;
                partido.marcadorTanda = { golesLocal: null, golesVisitante: null };
            }

            partido.jugado = true;
            
            await partido.save();
            await Promise.all([
                clubesDAO.limpiarConvocados(partido.equipoLocal._id),
                clubesDAO.limpiarConvocados(partido.equipoVisitante._id)
            ]);

            if (partido._id.toString() === partidoId) {
                resultadoUsuario = resultado;
                equipoLocalUsuario = equipoLocalData;
                equipoVisitanteUsuario = equipoVisitanteData;
            }
        });

        // ESPERAMOS A QUE TERMINEN DE SIMULARSE TODOS LOS PARTIDOS DE VERDAD 🏁
        await Promise.all(promesasPartidos);

        if (!resultadoUsuario) {
            const partidoYaJugado = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
            
            if (partidoYaJugado && partidoYaJugado.jugado) {
                resultadoUsuario = {
                    marcador: { local: partidoYaJugado.golesLocal, visitante: partidoYaJugado.golesVisitante },
                    goleadores: [], 
                    incidencias: []
                };

                const [clubLocal, clubVisitante] = await Promise.all([
                    Club.findById(partidoYaJugado.equipoLocal._id).populate('tactica.titulares').populate('tactica.suplentes'),
                    Club.findById(partidoYaJugado.equipoVisitante._id).populate('tactica.titulares').populate('tactica.suplentes')
                ]);

                equipoLocalUsuario = { nombre: partidoYaJugado.equipoLocal.nombre, jugadores: clubLocal.tactica?.titulares || [], suplentes: clubLocal.tactica?.suplentes || [] };
                equipoVisitanteUsuario = { nombre: partidoYaJugado.equipoVisitante.nombre, jugadores: clubVisitante.tactica?.titulares || [], suplentes: clubVisitante.tactica?.suplentes || [] };
            } else {
                return res.status(404).send("Partido no encontrado o no disponible.");
            }
        }

        const resultadosMiCompeticion = await Partido.find({
            partidaId: partidoUsuario.partidaId,
            competicionId: partidoUsuario.competicionId,
            fecha: { $gte: inicioDia, $lte: finDia },
            jugado: true
        }).populate('equipoLocal equipoVisitante');

        res.type('html');
        return res.render('resultadoPartido', {
            title: 'Resultado del Partido',  
            partida: partidaJuego,
            local: equipoLocalUsuario,
            visitante: equipoVisitanteUsuario,
            resultado: resultadoUsuario,
            partidoBBDD: partidoUsuario,
            restoJornada: resultadosMiCompeticion 
        });

    } catch (error) {
        console.error("Error en la simulación diaria:", error);
        return res.status(500).send("Error al procesar la jornada");
    }
});

// RUTA PARA SIMULAR EL PARTIDO VIENDOLO
router.get('/jugar_partido/:idPartido', requireLogin, async (req, res) => {
    try {
        const partidoId = req.params.idPartido;
        const clubUsuarioId = req.session.clubId; // Este es el ID real y seguro de tu club
        
        // 1. VERIFICACIÓN: Si el partido ya está en curso en la sesión, lo reanudamos directamente
        if (req.session.partidoEnVivo && req.session.partidoEnVivo.partidoId === partidoId) {
            const partidoUsuario = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
            const partidaJuego = await Partida.findById(partidoUsuario.partidaId).populate('clubSeleccionado');
            const esLocalUsuario = partidoUsuario.equipoLocal._id.toString() === clubUsuarioId;

            const equipoUser = esLocalUsuario ? req.session.partidoEnVivo.local : req.session.partidoEnVivo.visitante;

            return res.render('partidoEnVivo', {
                title: 'Partido en Directo - En Curso',  
                partida: partidaJuego,
                local: req.session.partidoEnVivo.local,
                visitor: req.session.partidoEnVivo.visitante, // Nota: abajo guardabas restoJornadaIa con 'visitor', asegúrate de que tu vista use el nombre correcto
                visitante: req.session.partidoEnVivo.visitante,
                partidoBBDD: partidoUsuario,
                esLocalUser: esLocalUsuario,
                equipoUser: equipoUser,
                tacticaInicial: equipoUser.formacion || '4-3-3',
                estiloInicial: equipoUser.estiloJuego || 'ESTÁNDAR',
                mentalidadInicial: equipoUser.mentalidad || 'EQUILIBRADA',
                formaciones: FORMACIONES,
                partidoEnVivo: req.session.partidoEnVivo
            });
        }
        
        // 2. CONFIGURACIÓN INICIAL (Si el partido empieza desde el minuto 0)
        const partidoUsuario = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
        if (!partidoUsuario) return res.status(404).send("Partido no encontrado.");

        // SOLUCIÓN VELOCIDAD Y ASIGNACIÓN: Buscamos la partida y el club del USUARIO en paralelo de forma limpia
        const [partidaJuego, clubUsuarioReal] = await Promise.all([
            Partida.findById(partidoUsuario.partidaId).populate('clubSeleccionado'),
            Club.findById(clubUsuarioId).populate('tactica.titulares').populate('tactica.suplentes')
        ]);

        if (!clubUsuarioReal) {
            return res.status(404).send("Club del usuario no encontrado en la base de datos.");
        }

        // Extraemos de forma segura los arrays tácticos usando encadenamiento opcional
        const titularesUsuario = clubUsuarioReal.tactica?.titulares || [];
        const suplentesUsuario = clubUsuarioReal.tactica?.suplentes || [];
        const convocadosUsuario = [...titularesUsuario, ...suplentesUsuario];

        const formacionBaseUser = clubUsuarioReal.tactica?.formacion || '4-3-3';
        const estiloBaseUser = clubUsuarioReal.tactica?.estiloJuego || 'ESTÁNDAR';
        const mentalidadBaseUser = clubUsuarioReal.tactica?.mentalidad || 'EQUILIBRADA';

        // Control de bajas y sanciones
        const tieneBajasConvocadas = convocadosUsuario.some(jugador => {
            if (!jugador) return false;
            const lesionado = jugador.estado?.lesion !== null && jugador.estado?.lesion !== undefined;
            let sancionado = false;
            if (jugador.estado?.sanciones && Array.isArray(jugador.estado.sanciones)) {
                sancionado = jugador.estado.sanciones.some(s => 
                    s && s.competicionId === partidoUsuario.competicionId && s.partidosRestantes > 0
                );
            }
            return lesionado || sancionado;
        });

        if (tieneBajasConvocadas) {
            return res.redirect(`/tactica?errorConvocatoria=true`);
        }

        const inicioDia = new Date(partidaJuego.fechaActual); inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(partidaJuego.fechaActual); finDia.setHours(23, 59, 59, 999);

        const partidosDeHoy = await Partido.find({
            partidaId: partidoUsuario.partidaId, 
            jugado: false,
            fecha: { $gte: inicioDia, $lte: finDia }
        }).populate('equipoLocal equipoVisitante');

        let equipoLocalUsuario = null;
        let equipoVisitanteUsuario = null;
        let opcionesEliminatoriaUsuario = { esVuelta: false, esIda: false };
        
        const partidosIADeHoy = [];

        await Promise.all(partidosDeHoy.map(async (partido) => {
            let equipoLocalData = { 
                id: partido.equipoLocal._id, nombre: partido.equipoLocal.nombre, jugadores: [], suplentes: [],
                formacion: '4-3-3', estiloJuego: 'ESTÁNDAR', mentalidad: 'EQUILIBRADA'
            };
            let equipoVisitanteData = { 
                id: partido.equipoVisitante._id, nombre: partido.equipoVisitante.nombre, jugadores: [], suplentes: [],
                formacion: '4-3-3', estiloJuego: 'ESTÁNDAR', mentalidad: 'EQUILIBRADA'
            };

            const esLocalUsuario = partido.equipoLocal._id.toString() === clubUsuarioId;
            const esVisitanteUsuario = partido.equipoVisitante._id.toString() === clubUsuarioId;

            // Procesamos convocatorias cruzadas en paralelo
            const promesasConvocatoria = [];

            if (esLocalUsuario) {
                equipoLocalData.jugadores = titularesUsuario;
                equipoLocalData.suplentes = suplentesUsuario;
                equipoLocalData.formacion = formacionBaseUser;
                equipoLocalData.estiloJuego = estiloBaseUser;
                equipoLocalData.mentalidad = mentalidadBaseUser;
            } else {
                promesasConvocatoria.push(
                    seleccionarConvocatoriaIA(partido.equipoLocal._id, partido.equipoVisitante.reputacion, partido.competicionId)
                    .then(cL => { 
                        equipoLocalData.jugadores = cL.titulares; 
                        equipoLocalData.suplentes = cL.suplentes;
                        equipoLocalData.formacion = cL.formacion;
                        equipoLocalData.estiloJuego = cL.estiloJuego;
                        equipoLocalData.mentalidad = cL.mentalidad;
                    })
                );
            }

            if (esVisitanteUsuario) {
                equipoVisitanteData.jugadores = titularesUsuario;
                equipoVisitanteData.suplentes = suplentesUsuario;
                equipoVisitanteData.formacion = formacionBaseUser;
                equipoVisitanteData.estiloJuego = estiloBaseUser;
                equipoVisitanteData.mentalidad = mentalidadBaseUser;
            } else {
                promesasConvocatoria.push(
                    seleccionarConvocatoriaIA(partido.equipoVisitante._id, partido.equipoLocal.reputacion, partido.competicionId)
                    .then(cV => { 
                        equipoVisitanteData.jugadores = cV.titulares; 
                        equipoVisitanteData.suplentes = cV.suplentes;
                        equipoVisitanteData.formacion = cV.formacion;
                        equipoVisitanteData.estiloJuego = cV.estiloJuego;
                        equipoVisitanteData.mentalidad = cV.mentalidad;
                    })
                );
            }

            await Promise.all(promesasConvocatoria);

            // Verificación de ida y vuelta...
            let opcionesEliminatoria = { esVuelta: false, esIda: false };
            if (partido.tipo === 'ELIMINATORIA') {
                const partidoIda = await Partido.findOne({
                    partidaId: partido.partidaId, competicionId: partido.competicionId, llave: partido.llave,
                    equipoLocal: partido.equipoVisitante._id, equipoVisitante: partido.equipoLocal._id, jugado: true
                });
                if (partidoIda) {
                    opcionesEliminatoria = { esVuelta: true, esIda: false, golesIdaLocal: partidoIda.golesLocal, golesIdaVisitante: partidoIda.golesVisitante };
                } else {
                    const tieneVueltaProgramada = await Partido.findOne({
                        partidaId: partido.partidaId, competicionId: partido.competicionId, llave: partido.llave,
                        equipoLocal: partido.equipoVisitante._id, equipoVisitante: partido.equipoLocal._id, jugado: false
                    });
                    if (tieneVueltaProgramada) opcionesEliminatoria.esIda = true;
                }
            }

            // Guardamos datos si es el partido del usuario, si no, lo simulamos ya
            if (partido._id.toString() === partidoId) {
                equipoLocalUsuario = equipoLocalData;
                equipoVisitanteUsuario = equipoVisitanteData;
                opcionesEliminatoriaUsuario = opcionesEliminatoria;
            } else {
                const resultadoIA = simularPartido(equipoLocalData, equipoVisitanteData, partido.tipo, opcionesEliminatoria);
                
                partido.golesLocal = resultadoIA.marcador.local;
                partido.golesVisitante = resultadoIA.marcador.visitante;
                partido.jugado = true;
                await partido.save();

                partidosIADeHoy.push({
                    partidoId: partido._id,
                    local: partido.equipoLocal.nombre,
                    visitor: partido.equipoVisitante.nombre,
                    golesFinales: resultadoIA.marcador,
                    cronogramaGoles: resultadoIA.goles || [] 
                });
            }
        }));

        req.session.partidoEnVivo = {
            partidoId: partidoId,
            minutoActual: 0,
            local: equipoLocalUsuario,
            visitante: equipoVisitanteUsuario,
            tipo: partidoUsuario.tipo,
            opcionesEliminatoria: opcionesEliminatoriaUsuario,
            estadoMarcador: { golesLocal: 0, golesVisitante: 0, eventos: [] },
            restoJornadaIa: partidosIADeHoy,
            enProrroga: false,   
            completado: false
        };

        const esLocalUsuarioFinal = partidoUsuario.equipoLocal._id.toString() === clubUsuarioId;
        
        res.render('partidoEnVivo', {
            title: 'Partido en Directo',  
            partida: partidaJuego,
            local: equipoLocalUsuario,
            visitante: equipoVisitanteUsuario,
            partidoBBDD: partidoUsuario,
            esLocalUser: esLocalUsuarioFinal,
            equipoUser: esLocalUsuarioFinal ? equipoLocalUsuario : equipoVisitanteUsuario,
            tacticaInicial: formacionBaseUser,
            estiloInicial: estiloBaseUser,
            mentalidadInicial: mentalidadBaseUser,
            formaciones: FORMACIONES,
            partidoEnVivo: req.session.partidoEnVivo
        });

    } catch (error) {
        console.error("Error al iniciar partido en vivo:", error);
        res.status(500).send("Error al procesar el partido en vivo");
    }
});

// Ruta para hacer el minuto a minuto en los partidos en vivo
router.post('/partido-en-vivo/:idPartido/tick', requireLogin, async (req, res) => {
    try {
        const { idPartido } = req.params;
        const sim = req.session.partidoEnVivo;

        // Validación de seguridad
        if (!sim || sim.partidoId !== idPartido) {
            return res.status(400).json({ success: false, message: "No hay ninguna simulación activa en sesión." });
        }

        // Si ya se completó el partido en un tick anterior
        if (sim.completado) {
            return res.json({ terminado: true, marcador: sim.estadoMarcador });
        }

        // --- INICIALIZACIÓN DE VARIABLES DE CONTROL EN LA SESIÓN (si no existen) ---
        if (sim.tiempoAnadido === undefined) sim.tiempoAnadido = 0;
        if (sim.minutoAdicionalActual === undefined) sim.minutoAdicionalActual = 0;
        if (sim.estadoPausa === undefined) sim.estadoPausa = null; 
        if (sim.tandaPenaltis === undefined) {
            sim.tandaPenaltis = {
                activo: false,
                turnoLocal: true,
                disparosLocal: [],     
                disparosVisitante: [], 
                golesLocal: 0,
                golesVisitante: 0,
                finalizada: false
            };
        }

        // --- 1. MANEJO EXCLUSIVO DE LA TANDA DE PENALTIS (TIRO A TIRO) ---
        if (sim.tandaPenaltis.activo) {
            const tanda = sim.tandaPenaltis;
            const anotado = Math.random() < 0.75 ? 'GOL' : 'FALLO'; 

            let eventoPenalti = {
                tipo: 'PENALTI_DISPARO',
                esLocal: tanda.turnoLocal,
                resultado: anotado
            };

            if (tanda.turnoLocal) {
                tanda.disparosLocal.push(anotado);
                if (anotado === 'GOL') tanda.golesLocal++;
                tanda.turnoLocal = false;
                eventoPenalti.texto = `¡Dispara ${sim.local.nombre}... y es ${anotado}!`;
            } else {
                tanda.disparosVisitante.push(anotado);
                if (anotado === 'GOL') tanda.golesVisitante++;
                tanda.turnoLocal = true;
                eventoPenalti.texto = `¡Dispara ${sim.visitante.nombre}... y es ${anotado}!`;
            }

            const nL = tanda.disparosLocal.length;
            const nV = tanda.disparosVisitante.length;
            const gL = tanda.golesLocal;
            const gV = tanda.golesVisitante;

            let terminado = false;
            if (nL >= 5 && nV >= 5) {
                if (nL === nV && gL !== gV) {
                    terminado = true;
                }
            } else {
                if (gL > gV + (5 - nV)) terminado = true;
                if (gV > gL + (5 - nL)) terminado = true;
            }

            if (terminado) {
                tanda.finalizada = true;
                sim.completado = true;
                sim.ganadorPenaltis = gL > gV ? sim.local._id : sim.visitante._id;
                sim.marcadorTanda = { golesLocal: gL, golesVisitante: gV };

                const partidoBBDD = await Partido.findById(idPartido);
                if (partidoBBDD) {
                    partidoBBDD.golesLocal = sim.estadoMarcador.golesLocal;
                    partidoBBDD.golesVisitante = sim.estadoMarcador.golesVisitante;
                    partidoBBDD.jugado = true;
                    partidoBBDD.ganadorPenaltis = sim.ganadorPenaltis;
                    partidoBBDD.marcadorTanda = sim.marcadorTanda;
                    await partidoBBDD.save();
                }
            }

            req.session.partidoEnVivo = sim; 
            return res.json({
                success: true,
                esPenaltis: true,
                tanda: tanda,
                evento: { tipo: 'INFO', texto: eventoPenalti.texto },
                terminado: terminado
            });
        }

        // --- 2. LOGICA DEL MINUTO DE JUEGO (REGULAR / PRÓRROGA) ---
        let limiteMinutos = sim.enProrroga ? 120 : 90;
        let minutoHito = sim.enProrroga ? 105 : 45;
        const requiereProrroga = sim.tipo === 'FINAL' || sim.tipo === 'ELIMINATORIA';

        if (sim.estadoPausa === 'DESCANSO') {
            sim.estadoPausa = null;
            sim.tiempoAnadido = 0;
            sim.minutoAdicionalActual = 0;
            sim.minutoActual = 46; 
        } else if (sim.estadoPausa === 'FIN_REGULAR_ESPERA_PRORROGA') {
            sim.estadoPausa = null;
            sim.tiempoAnadido = 0;
            sim.minutoAdicionalActual = 0;
            sim.enProrroga = true;
            sim.minutoActual = 91; 
            limiteMinutos = 120;
            minutoHito = 105;
        } else if (sim.estadoPausa === 'DESCANSO_PRORROGA') {
            sim.estadoPausa = null;
            sim.tiempoAnadido = 0;
            sim.minutoAdicionalActual = 0;
            sim.minutoActual = 106; 
        }

        let simulandoMinutoEfectivo = sim.minutoActual;
        let esDescuentoActivo = false;

        if (sim.minutoActual === minutoHito || sim.minutoActual === limiteMinutos) {
            if (sim.tiempoAnadido === 0) {
                sim.tiempoAnadido = Math.floor(Math.random() * 4) + 1; 
            }

            if (sim.minutoAdicionalActual < sim.tiempoAnadido) {
                sim.minutoAdicionalActual += 1;
                esDescuentoActivo = true;
                simulandoMinutoEfectivo = sim.minutoActual; 
            }
        } else {
            sim.minutoActual += 1;
            simulandoMinutoEfectivo = sim.minutoActual;
        }

        // --- 3. EJECUTAR TICK DE SIMULACIÓN EN EL MOTOR ---
        let estadoEstructuraMotor = {
            golesLocal: sim.estadoMarcador.golesLocal,
            golesVisitante: sim.estadoMarcador.golesVisitante,
            posesionLocal: sim.estadoMarcador.posesionLocal ?? 50,
            momentumLocal: sim.estadoMarcador.momentumLocal ?? 0,
            momentumVisitante: sim.estadoMarcador.momentumVisitante ?? 0,
            eventos: []
        };

        // Aquí el motor reduce la forma/cansancio y recalcula las notas de sim.local y sim.visitante
        const resultadoTick = simularTramoMinutos(
            sim.local, 
            sim.visitante, 
            simulandoMinutoEfectivo, 
            simulandoMinutoEfectivo, 
            estadoEstructuraMotor
        );

        sim.estadoMarcador.golesLocal = resultadoTick.golesLocal;
        sim.estadoMarcador.golesVisitante = resultadoTick.golesVisitante;
        sim.estadoMarcador.posesionLocal = resultadoTick.posesionLocal;
        sim.estadoMarcador.momentumLocal = resultadoTick.momentumLocal;
        sim.estadoMarcador.momentumVisitante = resultadoTick.momentumVisitante;

        let eventoOcurrido = null;
        if (resultadoTick.eventos && resultadoTick.eventos.length > 0) {
            eventoOcurrido = resultadoTick.eventos[0];
            sim.estadoMarcador.eventos.push(eventoOcurrido);
        }

        // --- 4. GESTIÓN DE LÍMITES Y TRÁNSITOS DE ESTADO ---
        let pausaDetectada = null;
        let partidoTerminado = false;

        if (sim.minutoActual === minutoHito && sim.minutoAdicionalActual === sim.tiempoAnadido) {
            sim.estadoPausa = sim.enProrroga ? 'DESCANSO_PRORROGA' : 'DESCANSO';
            pausaDetectada = sim.estadoPausa;
        }
        else if (sim.minutoActual === limiteMinutos && sim.minutoAdicionalActual === sim.tiempoAnadido) {
            if (sim.minutoActual === 90) {
                let irAProrroga = false;
                if (requiereProrroga && sim.estadoMarcador.golesLocal === sim.estadoMarcador.golesVisitante) {
                    if (sim.opcionesEliminatoria && sim.opcionesEliminatoria.esVuelta) {
                        const globalLocal = sim.estadoMarcador.golesLocal + (sim.opcionesEliminatoria.golesIdaVisitante || 0);
                        const globalVisitante = sim.estadoMarcador.golesVisitante + (sim.opcionesEliminatoria.golesIdaLocal || 0);
                        if (globalLocal === globalVisitante) irAProrroga = true;
                    } else if (!sim.opcionesEliminatoria?.esIda) {
                        irAProrroga = true; 
                    }
                }

                if (irAProrroga) {
                    sim.estadoPausa = 'FIN_REGULAR_ESPERA_PRORROGA';
                    pausaDetectada = sim.estadoPausa;
                } else {
                    partidoTerminado = true;
                }
            } 
            else if (sim.minutoActual === 120) {
                if (sim.estadoMarcador.golesLocal === sim.estadoMarcador.golesVisitante) {
                    sim.tandaPenaltis.activo = true;
                    sim.estadoPausa = 'TANDA_PENALTIS';
                    pausaDetectada = 'TANDA_PENALTIS';
                } else {
                    partidoTerminado = true;
                }
            }
        }

        if (partidoTerminado) {
            sim.completado = true;
            const partidoBBDD = await Partido.findById(idPartido);
            if (partidoBBDD) {
                partidoBBDD.golesLocal = sim.estadoMarcador.golesLocal;
                partidoBBDD.golesVisitante = sim.estadoMarcador.golesVisitante;
                partidoBBDD.jugado = true;
                await partidoBBDD.save();
            }
        }

        // --- mapeo de JUGADORES CON SUS DATOS EN VIVO ACTUALIZADOS POR EL MOTOR ---
        const jugadoresLocalActualizados = sim.local.jugadores.map(j => ({
            _id: j._id,
            estado: {
                forma: j.estado?.forma ?? 100,
                notaPartido: j.estado?.notaPartido ?? 6.0
            }
        }));

        const jugadoresVisitanteActualizados = sim.visitante.jugadores.map(j => ({
            _id: j._id,
            estado: {
                forma: j.estado?.forma ?? 100,
                notaPartido: j.estado?.notaPartido ?? 6.0
            }
        }));

        req.session.partidoEnVivo = sim; // Guardar sesión de Express

        let minFormateado = esDescuentoActivo 
            ? `${sim.minutoActual}+${sim.minutoAdicionalActual}` 
            : `${sim.minutoActual}`;

        // Devolvemos los datos del partido incluyendo los arreglos dinámicos
        return res.json({
            success: true,
            minuto: minFormateado,
            golesLocal: sim.estadoMarcador.golesLocal,
            golesVisitante: sim.estadoMarcador.golesVisitante,
            posesionLocal: Math.floor(Math.min(99, Math.max(1, sim.estadoMarcador.posesionLocal))),
            evento: eventoOcurrido,
            pausaEstado: pausaDetectada,
            terminado: partidoTerminado,
            jugadoresLocal: jugadoresLocalActualizados,
            jugadoresVisitante: jugadoresVisitanteActualizados
        });

    } catch (error) {
        console.error("Error al simular tick del partido:", error);
        return res.status(500).json({ success: false, message: "Error interno del motor." });
    }
});

// RUTA PARA MOSTRAR LA VISTA TÁCTICA
router.get('/partido/:idPartido/tactica', requireLogin, async (req, res) => {
    try {
        const partidoId = req.params.idPartido;

        // Validar que exista el partido en la base de datos
        const partidoUsuario = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
        if (!partidoUsuario) return res.status(404).send("Partido no encontrado.");

        // Recuperar los datos del partido en vivo desde la sesión
        const partidoEnVivo = req.session.partidoEnVivo;
        if (!partidoEnVivo || partidoEnVivo.partidoId !== partidoId) {
            // Si por alguna razón se limpia la sesión, lo mandamos de vuelta a recargar el partido
            return res.redirect(`/jugar_partido/${partidoId}`);
        }

        // Determinar cuál es el equipo del usuario en este partido
        const clubUsuarioId = req.session.clubId; 
        const esLocalUsuario = partidoUsuario.equipoLocal._id.toString() === clubUsuarioId;

        // ¡IMPORTANTE! Extraemos los jugadores directamente de la SESIÓN actual del partido,
        // así si ya ha hecho cambios durante el partido, se mantienen en la pizarra.
        const equipoUser = esLocalUsuario ? partidoEnVivo.local : partidoEnVivo.visitante;

        res.render('partidoTactica', {
            title: 'Ajustes Tácticos - ' + equipoUser.nombre,
            partidoBBDD: partidoUsuario,
            equipoUser: equipoUser, // Contiene { id, nombre, jugadores, suplentes } extraídos de la sesión
            tacticaInicial: equipoUser.formacion || '4-3-3',
            estiloInicial: equipoUser.estiloJuego || 'ESTÁNDAR',
            mentalidadInicial: equipoUser.mentalidad || 'EQUILIBRADA',
            formaciones: FORMACIONES // Asegúrate de que FORMACIONES esté accesible en este archivo
        });

    } catch (error) {
        console.error("Error al cargar la vista táctica del partido:", error);
        res.status(500).send("Error al procesar el panel táctico");
    }
});

// RUTA PARA GUARDAR Y VOLVER AL PARTIDO
router.post('/partido/:idPartido/tactica', requireLogin, async (req, res) => {
    try {
        const partidoId = req.params.idPartido;
        const { formacion, estiloJuego, mentalidad, titulares } = req.body;

        const partidoEnVivo = req.session.partidoEnVivo;
        if (!partidoEnVivo || partidoEnVivo.partidoId !== partidoId) {
            return res.status(400).json({ success: false, message: "No hay ninguna simulación activa para este partido." });
        }

        // Detectar si el usuario es local o visitante
        const clubUsuarioId = req.session.clubId;
        const esLocal = partidoEnVivo.local.id.toString() === clubUsuarioId;
        const equipoAEditar = esLocal ? 'local' : 'visitante';

        // 1. Actualizamos las opciones tácticas globales en la sesión del partido en vivo
        partidoEnVivo[equipoAEditar].formacion = formacion;
        partidoEnVivo[equipoAEditar].estiloJuego = estiloJuego;
        partidoEnVivo[equipoAEditar].mentalidad = mentalidad;

        // 2. Mapear y ordenar los nuevos titulares en la sesión
        // El cliente envía un array ordenado de IDs de titulares ['id1', 'id2', null, ...]
        const todosLosJugadoresDisponibles = [
            ...partidoEnVivo[equipoAEditar].jugadores,
            ...partidoEnVivo[equipoAEditar].suplentes
        ];

        let nuevosTitulares = [];
        let nuevosSuplentes = [];

        // Reconstruimos la lista de titulares basándonos en el orden de IDs que envió el GestorTactico
        titulares.forEach(id => {
            if (!id || id === 'vacio') {
                nuevosTitulares.push(null); // Huecos vacíos si tu GestorTactico los maneja
            } else {
                const jugador = todosLosJugadoresDisponibles.find(j => j && j._id.toString() === id.toString());
                if (jugador) nuevosTitulares.push(jugador);
            }
        });

        // Todos los que no se hayan quedado en la lista de titulares, van al banquillo de suplentes automáticamente
        todosLosJugadoresDisponibles.forEach(jugador => {
            if (jugador && !titulares.includes(jugador._id.toString())) {
                nuevosSuplentes.push(jugador);
            }
        });

        // Guardamos las nuevas listas en la sesión del partido
        partidoEnVivo[equipoAEditar].jugadores = nuevosTitulares;
        partidoEnVivo[equipoAEditar].suplentes = nuevosSuplentes;

        // Guardamos los cambios de forma explícita en la sesión de Express
        req.session.partidoEnVivo = partidoEnVivo;

        // Devolvemos una respuesta exitosa
        res.json({ success: true, redirectUrl: `/jugar_partido/${partidoId}` });

    } catch (error) {
        console.error("Error al guardar la táctica en vivo:", error);
        res.status(500).json({ success: false, message: "Error interno al aplicar los ajustes tácticos." });
    }
});

router.get('/competicion/:idCompeticion/clasificacion', requireLogin, async (req, res) => {
    try {
        const idCompeticion = req.params.idCompeticion;
        
        // 1. Buscar todos los partidos JUGADOS de esta competición
        const partidos = await Partido.find({ 
            competicionId: idCompeticion, 
            jugado: true 
        }).populate('equipoLocal equipoVisitante');

        // 2. Objeto temporal para ir sumando los puntos
        const tabla = {};

        partidos.forEach(p => {
            // Inicializar equipos en la tabla si no existen
            if (!tabla[p.equipoLocal._id]) tabla[p.equipoLocal._id] = { club: p.equipoLocal, pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 };
            if (!tabla[p.equipoVisitante._id]) tabla[p.equipoVisitante._id] = { club: p.equipoVisitante, pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 };

            // Sumar Partidos Jugados (PJ), Goles a Favor (GF) y Goles en Contra (GC)
            tabla[p.equipoLocal._id].pj += 1;
            tabla[p.equipoVisitante._id].pj += 1;
            
            tabla[p.equipoLocal._id].gf += p.golesLocal;
            tabla[p.equipoLocal._id].gc += p.golesVisitante;
            tabla[p.equipoVisitante._id].gf += p.golesVisitante;
            tabla[p.equipoVisitante._id].gc += p.golesLocal;

            // Calcular Puntos (PTS) y Victorias/Empates/Derrotas
            if (p.golesLocal > p.golesVisitante) {
                tabla[p.equipoLocal._id].pts += 3;
                tabla[p.equipoLocal._id].pg += 1;
                tabla[p.equipoVisitante._id].pp += 1;
            } else if (p.golesLocal < p.golesVisitante) {
                tabla[p.equipoVisitante._id].pts += 3;
                tabla[p.equipoVisitante._id].pg += 1;
                tabla[p.equipoLocal._id].pp += 1;
            } else {
                tabla[p.equipoLocal._id].pts += 1;
                tabla[p.equipoVisitante._id].pts += 1;
                tabla[p.equipoLocal._id].pe += 1;
                tabla[p.equipoVisitante._id].pe += 1;
            }
        });

        // 3. Convertir el objeto a Array y ordenarlo por puntos (y diferencia de goles)
        let clasificacion = Object.values(tabla).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts; // Mayor puntuación
            return (b.gf - b.gc) - (a.gf - a.gc);     // Diferencia de goles
        });

        res.render('clasificacion', { clasificacion });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar la clasificación");
    }
});
// Ruta para ver las Estadísticas del Club
router.get('/estadisticas', requireLogin, async (req, res) => {
    try {
        const partidaId = req.session.partidaId;
        // Hacemos populate anidado para traernos a los jugadores de la plantilla
        const partida = await Partida.findById(partidaId).populate({
            path: 'clubSeleccionado',
            populate: { path: 'plantilla' }
        });
        const clubUsuario = partida.clubSeleccionado;

        // --- 1. ESTADÍSTICAS DE FORMACIONES ---
        const partidosJugados = await Partido.find({
            partidaId: partidaId,
            jugado: true,
            $or: [{ equipoLocal: clubUsuario._id }, { equipoVisitante: clubUsuario._id }]
        });

        const statsFormaciones = {};

        partidosJugados.forEach(p => {
            let esLocal = p.equipoLocal.toString() === clubUsuario._id.toString();
            let formacion = esLocal ? p.formacionLocal : p.formacionVisitante;
            if (!formacion) formacion = 'Desconocida (Antigua)';

            if (!statsFormaciones[formacion]) {
                statsFormaciones[formacion] = { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
            }

            let stats = statsFormaciones[formacion];
            stats.pj++;

            let misGoles = esLocal ? p.golesLocal : p.golesVisitante;
            let susGoles = esLocal ? p.golesVisitante : p.golesLocal;

            stats.gf += misGoles;
            stats.gc += susGoles;

            if (misGoles > susGoles) {
                stats.pg++;
                stats.pts += 3;
            } else if (misGoles === susGoles) {
                stats.pe++;
                stats.pts += 1;
            } else {
                stats.pp++;
            }
        });

        // --- 2. RENDIMIENTO INDIVIDUAL (TOP 5) ---
        // Sumamos los stats de todas las competiciones para cada jugador
        const statsJugadores = clubUsuario.plantilla.map(jugador => {
            let tGoles = 0, tAsistencias = 0, tMinutos = 0, tPj = 0, sumaNotas = 0;
            
            jugador.statsTemporada.forEach(s => {
                tGoles += s.goles;
                tAsistencias += s.asistencias;
                tMinutos += s.minutos;
                tPj += s.pj;
                sumaNotas += (s.notaMedia * s.pj); // Ponderamos la nota por los partidos jugados
            });

            let notaMediaGlobal = tPj > 0 ? (sumaNotas / tPj).toFixed(2) : 0;

            return {
                nombre: jugador.nombre,
                posicion: jugador.posicionPrincipal,
                goles: tGoles,
                asistencias: tAsistencias,
                minutos: tMinutos,
                notaMedia: parseFloat(notaMediaGlobal),
                pj: tPj
            };
        });

        // Ordenamos y sacamos los Top 5 de cada categoría
        const topGoleadores = [...statsJugadores].filter(j => j.goles > 0).sort((a, b) => b.goles - a.goles).slice(0, 5);
        const topAsistentes = [...statsJugadores].filter(j => j.asistencias > 0).sort((a, b) => b.asistencias - a.asistencias).slice(0, 5);
        const topMinutos = [...statsJugadores].filter(j => j.minutos > 0).sort((a, b) => b.minutos - a.minutos).slice(0, 5);
        const topNotas = [...statsJugadores].filter(j => j.pj > 0).sort((a, b) => b.notaMedia - a.notaMedia).slice(0, 5);

        res.render('estadisticas', {
            title: 'Estadísticas del Club',
            partida,
            user: req.session.user,
            clubUsuario,
            statsFormaciones,
            topGoleadores,
            topAsistentes,
            topMinutos,
            topNotas
        });
    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
        res.status(500).send("Error al cargar la página de estadísticas");
    }
});
router.get('/clasificacion/:competicionId', requireLogin, async (req, res) => {
    try {
        const competicionId = req.params.competicionId;
        const partidaId = req.session.partidaId;
        
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        const competicion = await Competicion.findById(competicionId);
        if (!partida || !competicion) return res.redirect('/inicioJuego');
        const clubUsuario = partida.clubSeleccionado;

        const todosLosPartidos = await Partido.find({
            partidaId: partidaId,
            competicionId: competicionId
        }).populate('equipoLocal equipoVisitante').sort({ jornada: 1 });

        if (todosLosPartidos.length === 0) {
            return res.render('clasificacion', {
                user: req.session.user,
                partida, clubUsuario, competicion,
                clasificacion: [], grupos: null, rondas: {}, tieneEliminatorias: false
            });
        }

        const tieneEliminatorias = todosLosPartidos.some(p => p.tipo === 'ELIMINATORIA' || p.tipo === 'FINAL');

        // BLOQUE 1: PROCESAR TABLA DE CLASIFICACIÓN
        const tabla = {};
        const mapaEquiposGrupos = {};

        todosLosPartidos.forEach(p => {
            if (p.grupo) {
                mapaEquiposGrupos[p.equipoLocal._id.toString()] = p.grupo;
                mapaEquiposGrupos[p.equipoVisitante._id.toString()] = p.grupo;
            }
        });

        todosLosPartidos.forEach(p => {
            [p.equipoLocal, p.equipoVisitante].forEach(equipo => {
                const idStr = equipo._id.toString();
                if (!tabla[idStr]) {
                    tabla[idStr] = { 
                        club: equipo, 
                        pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0,
                        grupo: mapaEquiposGrupos[idStr] || "Sin Grupo"
                    };
                }
            });

            if (p.jugado && p.tipo === 'LIGA') {
                const idLocal = p.equipoLocal._id.toString();
                const idVisit = p.equipoVisitante._id.toString();

                tabla[idLocal].pj += 1; tabla[idVisit].pj += 1;
                tabla[idLocal].gf += p.golesLocal; tabla[idLocal].gc += p.golesVisitante;
                tabla[idVisit].gf += p.golesVisitante; tabla[idVisit].gc += p.golesLocal;

                if (p.golesLocal > p.golesVisitante) {
                    tabla[idLocal].pts += 3; tabla[idLocal].pg += 1; tabla[idVisit].pp += 1;
                } else if (p.golesLocal < p.golesVisitante) {
                    tabla[idVisit].pts += 3; tabla[idVisit].pg += 1; tabla[idLocal].pp += 1;
                } else {
                    tabla[idLocal].pts += 1; tabla[idVisit].pts += 1;
                    tabla[idLocal].pe += 1; tabla[idVisit].pe += 1;
                }
            }
        });

        let clasificacion = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));
        let grupos = null;

        if (competicion.tipo === 'internacional_america') {
            grupos = {};
            Object.values(tabla).forEach(fila => {
                const nombreG = fila.grupo;
                if (!grupos[nombreG]) grupos[nombreG] = [];
                grupos[nombreG].push(fila);
            });
            Object.keys(grupos).forEach(nombreG => {
                grupos[nombreG].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));
            });
        }

        // BLOQUE 2: PROCESAR CUADRO DE ELIMINATORIAS (SI TIENE)
        const rondas = {};
        if (tieneEliminatorias) {
            const getNombreRonda = (jornada, tipo) => {
                if (tipo === 'FINAL' || jornada === 17) return 'Final';
                if (jornada === 9 || jornada === 10) return 'Ronda de Play-offs';
                if (jornada === 11 || jornada === 12) return 'Octavos de Final';
                if (jornada === 13 || jornada === 14) return 'Cuartos de Final';
                if (jornada === 15 || jornada === 16) return 'Semifinales';
                return `Ronda ${jornada}`; 
            };

            todosLosPartidos.forEach(p => {
                if (p.tipo === 'ELIMINATORIA' || p.tipo === 'FINAL') {
                    const nombre = getNombreRonda(p.jornada, p.tipo);
                    if (!rondas[nombre]) rondas[nombre] = [];
                    rondas[nombre].push(p);
                }
            });
        }

        const partidosPorJornada = {};
        todosLosPartidos.forEach(p => {
            if (p.tipo === 'LIGA') { // Solo agrupamos jornadas de liga regular
                if (!partidosPorJornada[p.jornada]) partidosPorJornada[p.jornada] = [];
                partidosPorJornada[p.jornada].push(p);
            }
        });

        const jornadas = Object.keys(partidosPorJornada).sort((a, b) => a - b);
        const jornadaActual = jornadas.find(j => partidosPorJornada[j].some(p => !p.jugado)) || jornadas[jornadas.length - 1];

        // Renderizamos la vista unificada pasándole todo
        res.render('clasificacion', {
            user: req.session.user,
            partida,
            clubUsuario,
            competicion,
            clasificacion,
            grupos,
            partidosPorJornada,
            jornadas,
            jornadaActual,
            rondas,             
            tieneEliminatorias    
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar la clasificación");
    }
});

// Ruta para ver el Cuadro de la Copa
router.get('/copa/:competicionId', requireLogin, async (req, res) => {
    try {
        const competicionId = req.params.competicionId;
        const partidaId = req.session.partidaId;
        
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        const competicion = await Competicion.findById(competicionId);
        if (!partida || !competicion) return res.redirect('/inicioJuego');
        const clubUsuario = partida.clubSeleccionado;

        const partidosCopa = await Partido.find({
            partidaId: partidaId,
            competicionId: competicionId
        }).populate('equipoLocal equipoVisitante').sort({ jornada: 1 });

        if (!partidosCopa || partidosCopa.length === 0) {
            return res.render('copa', {
                user: req.session.user,
                partida,
                clubUsuario,
                competicion,
                rondas: {},
                mensaje: "La competición aún no ha comenzado."
            });
        }

        // Detectamos si es una copa con formato ida y vuelta en semis
        const nombreComp = competicion.nombre.toLowerCase();
        const copasConDobleSemi = ['copa del rey', 'coppa italia', 'taça de portugal', 'knvb beker', 'copa do brasil'];
        const esDobleSemi = copasConDobleSemi.includes(nombreComp);

        // 3. Agrupamos los partidos por Rondas
        const rondas = {};
        
        const getNombreRonda = (jornada) => {
            switch (jornada) {
                case 0: return 'Ronda Previa';
                case 1: return '1/16 de Final';
                case 2: return 'Octavos de Final';
                case 3: return 'Cuartos de Final';
                case 4: 
                    return esDobleSemi ? 'Semifinal' : 'Semifinal'; 
                case 5: 
                    return esDobleSemi ? 'Semifinal' : 'Semifinal'; // Ambas jornadas caen en la misma bolsa
                case 6: return 'Final';
                default: return `Ronda ${jornada}`;
            }
        };

        partidosCopa.forEach(p => {
            const nombre = getNombreRonda(p.jornada);
            if (!rondas[nombre]) rondas[nombre] = [];
            rondas[nombre].push(p);
        });

        if (req.query.ajax) {
            return res.render('partials/cuadroCopa', { 
                rondas, 
                competicion,
                clubUsuario: partida.clubSeleccionado,
                layout: false 
            });
        }

        res.render('copa', {
            user: req.session.user,
            partida,
            clubUsuario,
            competicion,
            rondas
        });

    } catch (error) {
        console.error("Error al cargar la copa:", error);
        res.status(500).send("Error al cargar la competición de Copa");
    }
});

router.get('/mis-competiciones', requireLogin, async (req, res) => {
    try {
        const partidaId = req.session.partidaId;
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        
        const clubUsuario = partida.clubSeleccionado;
        const partidosClub = await Partido.find({
            partidaId: partidaId,
            $or: [
                { equipoLocal: clubUsuario._id },
                { equipoVisitante: clubUsuario._id }
            ]
        }).distinct('competicionId');

        const misCompeticiones = await Competicion.find({
            $or: [
                { _id: { $in: partidosClub } },
                { 
                    pais: clubUsuario.pais, 
                    tipo: 'copa',
                    partidaId: partidaId
                }
            ]
        });

        const ordenPrioridad = { 'liga': 1, 'copa': 2, 'internacional_europa': 3, 'internacional_america': 3 };
        
        misCompeticiones.sort((a, b) => {
            return (ordenPrioridad[a.tipo] || 99) - (ordenPrioridad[b.tipo] || 99);
        });

        res.render('misCompeticiones', {
            title: 'Mis Competiciones',
            partida,
            misCompeticiones
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar mis competiciones");
    }
});

router.get('/ver-competiciones', requireLogin, async (req, res) => {
    try {
        const partidaId = req.session.partidaId;
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        const competiciones = await Competicion.find({ partidaId: partidaId });

        const paises = [...new Set(competiciones
            .map(c => c.pais)
            .filter(p => p && p !== 'Europa' && p !== 'Sudamérica'))];

        res.render('verTodasCompeticiones', {
            title: 'Explorar Mundo',
            partida,
            paises,
            competiciones
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al abrir el explorador");
    }
});
module.exports = {
    router: router,
    simularPartidosPendientes: simularPartidosPendientes
};