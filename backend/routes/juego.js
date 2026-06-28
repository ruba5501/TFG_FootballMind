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
const { simularPartido } = require('../engine/motorJuego');
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

    for (let partido of partidos) {
        // SI ES EL PARTIDO DEL USUARIO, LO SALTAMOS
        const esPartidoUsuario = partido.equipoLocal._id.toString() === clubUsuarioId.toString() || 
                                 partido.equipoVisitante._id.toString() === clubUsuarioId.toString();
        
        if (esPartidoUsuario) continue; 

        // Mandamos a la IA a armar las alineaciones
        const convocatoriaLocal = await seleccionarConvocatoriaIA(
            partido.equipoLocal._id, 
            partido.equipoVisitante.reputacion || 50, 
            partido.competicionId?.toString()
        );
        
        const convocatoriaVisitante = await seleccionarConvocatoriaIA(
            partido.equipoVisitante._id, 
            partido.equipoLocal.reputacion || 50, 
            partido.competicionId?.toString()
        );

        const jugadoresLocal = convocatoriaLocal.titulares;
        const jugadoresVisitante = convocatoriaVisitante.titulares;

        // LÓGICA REINICIADA Y CORREGIDA PARA ELIMINATORIAS (IA)
        let opcionesEliminatoria = { esVuelta: false };
        if (partido.tipo === 'ELIMINATORIA') {
            const partidoIda = await Partido.findOne({
                partidaId: partido.partidaId,
                competicionId: partido.competicionId,
                llave: partido.llave, 
                equipoLocal: partido.equipoVisitante._id, // En la ida el visitante de hoy fue Local
                equipoVisitante: partido.equipoLocal._id, // En la ida el local de hoy fue Visitante
                jugado: true
            });

            if (partidoIda) {
                // CORRECCIÓN MATEMÁTICA: Mapeo directo de la ida al motor
                // golesIdaLocal: Goles que metió el Local de la ida (que es el Visitante de hoy)
                // golesIdaVisitante: Goles que metió el Visitante de la ida (que es el Local de hoy)
                opcionesEliminatoria = {
                    esVuelta: true,
                    golesIdaLocal: partidoIda.golesLocal, 
                    golesIdaVisitante: partidoIda.golesVisitante  
                };
            }
        }

        // Simulación total delegada al motor inteligente
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
        await partido.save();
    }
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
async function seleccionarConvocatoriaIA(clubId, rivalReputacion, competicionId, formacionPredefinida = '4-3-3') {
    const plantillaTotal = await Jugador.find({ clubActual: clubId });
    const club = await Club.findById(clubId);
    if (!club || plantillaTotal.length === 0) return { titulares: [], suplentes: [] };

    // 1. Filtrar disponibles sanos
    const disponibles = plantillaTotal.filter(j => {
        if (j.estado?.lesion !== null) return false;
        if ((j.estado?.forma ?? 100) < 40) return false; 
        if (j.estado?.sanciones && j.estado.sanciones.length > 0) {
            const sancionActiva = j.estado.sanciones.find(s => s.competicionId === competicionId && s.partidosRestantes > 0);
            if (sancionActiva) return false;
        }
        return true;
    });

    // 2. Determinar política de rotación
    const diferenciaReputacion = club.reputacion - rivalReputacion;
    let nivelRotacion = 'NINGUNA';

    if (diferenciaReputacion > 20 && diferenciaReputacion <= 30) {
        nivelRotacion = 'MODERADA';
    } else if (diferenciaReputacion > 30) {
        nivelRotacion = 'INTENSA'; 
    }

    // 🛡️ CORREGIDO: formacionPredefinida corregida
    const configuracionFormacion = FORMACIONES[club.formacion] || FORMACIONES[formacionPredefinida] || FORMACIONES['4-3-3'];
    const posicionesRequeridas = configuracionFormacion.posiciones;

    const titulares = [];
    const elegidosIds = new Set();

    // 3. Selección de Titulares puesto por puesto
    for (const posicion of posicionesRequeridas) {
        
        let candidatos = disponibles
            .filter(j => j.posicionPrincipal === posicion && !elegidosIds.has(j._id.toString()))
            .map(j => {
                let pesoAlineacion = calcularNivel(j, posicion);
                const formaJugador = j.estado?.forma ?? 100;

                if (nivelRotacion === 'MODERADA' && formaJugador < 85) {
                    pesoAlineacion -= 10; 
                } 
                else if (nivelRotacion === 'INTENSA') {
                    if (formaJugador < 93) pesoAlineacion -= 20; 
                    if (j.edad <= 22 && j.potencial > j.valoracion) pesoAlineacion += 8; 
                }

                return { jugador: j, peso: pesoAlineacion };
            })
            .sort((a, b) => b.peso - a.peso);

        if (candidatos.length === 0 || candidatos[0].peso < 30) {
            const parches = disponibles
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

    // 4. Confección del banquillo reglamentario (13 suplentes)
    let suplentes = disponibles
        .filter(j => !elegidosIds.has(j._id.toString()))
        .sort((a, b) => calcularNivel(b, b.posicionPrincipal) - calcularNivel(a, a.posicionPrincipal))
        .slice(0, 13);

    while (suplentes.length < 13) {
        suplentes.push(null);
    }

    return { titulares, suplentes };
}

// RUTA PARA JUGAR EL PARTIDO
router.get('/jugar-partido/:idPartido', requireLogin, async (req, res) => {
    try {
        const partidoId = req.params.idPartido;
        const partidoUsuario = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
        const partidaJuego = await Partida.findById(partidoUsuario.partidaId).populate('clubSeleccionado');

        const clubUsuarioId = partidaJuego.clubSeleccionado._id.toString();
        const clubUserVerificacion = await Club.findById(clubUsuarioId).populate('plantilla');
        
        const convocadosUsuario = clubUserVerificacion.plantilla.slice(0, 18);
        
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

        for (let partido of partidosDeHoy) {
            let equipoLocalData = { id: partido.equipoLocal._id, nombre: partido.equipoLocal.nombre, jugadores: [] };
            let equipoVisitanteData = { id: partido.equipoVisitante._id, nombre: partido.equipoVisitante.nombre, jugadores: [] };

            // --- CONFIGURACIÓN EQUIPO LOCAL ---
            if (partido.equipoLocal._id.toString() === clubUsuarioId) {
                equipoLocalData.jugadores = clubUserVerificacion.plantilla.slice(0, 11);
                equipoLocalData.suplentes = clubUserVerificacion.plantilla.slice(11, 18); 
            } else {
                const convocatoria = await seleccionarConvocatoriaIA(partido.equipoLocal._id, partido.equipoVisitante.reputacion, partido.competicionId);
                equipoLocalData.jugadores = convocatoria.titulares;
                equipoLocalData.suplentes = convocatoria.suplentes;
            }

            // --- CONFIGURACIÓN EQUIPO VISITANTE ---
            if (partido.equipoVisitante._id.toString() === clubUsuarioId) {
                equipoVisitanteData.jugadores = clubUserVerificacion.plantilla.slice(0, 11);
                equipoVisitanteData.suplentes = clubUserVerificacion.plantilla.slice(11, 18);
            } else {
                const convocatoria = await seleccionarConvocatoriaIA(partido.equipoVisitante._id, partido.equipoLocal.reputacion, partido.competicionId);
                equipoVisitanteData.jugadores = convocatoria.titulares;
                equipoVisitanteData.suplentes = convocatoria.suplentes;
            }
            
            // 🔍 LÓGICA REINICIADA Y CORREGIDA PARA ELIMINATORIAS
            let opcionesEliminatoria = { esVuelta: false };
            
            if (partido.tipo === 'ELIMINATORIA') {
                const partidoIda = await Partido.findOne({
                    partidaId: partido.partidaId,
                    competicionId: partido.competicionId,
                    llave: partido.llave,
                    equipoLocal: partido.equipoVisitante._id, // En la ida el visitante de hoy fue Local
                    equipoVisitante: partido.equipoLocal._id, // En la ida el local de hoy fue Visitante
                    jugado: true
                });

                if (partidoIda) {
                    opcionesEliminatoria = {
                        esVuelta: true,
                        golesIdaLocal: partidoIda.golesLocal,
                        golesIdaVisitante: partidoIda.golesVisitante
                    };
                }
            }

            // Simulación pasándole todos los parámetros requeridos por el motor
            const resultado = simularPartido(equipoLocalData, equipoVisitanteData, partido.tipo, opcionesEliminatoria);

            partido.golesLocal = resultado.marcador.local;
            partido.golesVisitante = resultado.marcador.visitante; 
            
            // Guardamos los penaltis si existieron en el partido del usuario o simulados
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

            await clubesDAO.limpiarConvocados(partido.equipoLocal._id);
            await clubesDAO.limpiarConvocados(partido.equipoVisitante._id);

            if (partido._id.toString() === partidoId) {
                resultadoUsuario = resultado;
                equipoLocalUsuario = equipoLocalData;
                equipoVisitanteUsuario = equipoVisitanteData;
            }
        }

        if (!resultadoUsuario) {
            const partidoYaJugado = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
            
            if (partidoYaJugado && partidoYaJugado.jugado) {
                resultadoUsuario = {
                    marcador: { local: partidoYaJugado.golesLocal, visitante: partidoYaJugado.golesVisitante },
                    goleadores: [], 
                    incidencias: []
                };

                const clubLocal = await Club.findById(partidoYaJugado.equipoLocal._id).populate('plantilla');
                const clubVisitante = await Club.findById(partidoYaJugado.equipoVisitante._id).populate('plantilla');

                equipoLocalUsuario = { nombre: partidoYaJugado.equipoLocal.nombre, jugadores: clubLocal.plantilla.slice(0, 11) };
                equipoVisitanteUsuario = { nombre: partidoYaJugado.equipoVisitante.nombre, jugadores: clubVisitante.plantilla.slice(0, 11) };
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

        res.render('resultadoPartido', {
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
        res.status(500).send("Error al procesar la jornada");
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
router.get('/estadisticas/:partidaId', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.partidaId;
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
router.get('/clasificacion/:partidaId/:competicionId', requireLogin, async (req, res) => {
    try {
        const { partidaId, competicionId } = req.params;
        
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        const competicion = await Competicion.findById(competicionId);
        if (!partida || !competicion) return res.redirect('/inicioJuego/' + partidaId);
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
// --- CONTROLADOR CORREGIDO ---
router.get('/copa/:partidaId/:competicionId', requireLogin, async (req, res) => {
    try {
        const { partidaId, competicionId } = req.params;
        
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        const competicion = await Competicion.findById(competicionId);
        if (!partida || !competicion) return res.redirect('/inicioJuego/' + partidaId);
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

router.get('/mis-competiciones/:idPartida', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.idPartida;
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

router.get('/ver-competiciones/:idPartida', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.idPartida;
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