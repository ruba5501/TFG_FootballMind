// backend/routes/juego.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Modelos
const Partida = require('../models/partida');
const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Partido = require('../models/partido');
const Competicion = require('../models/competicion')
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

        const jugadoresLocal = await seleccionarMejorOnce(partido.equipoLocal._id);
        const jugadoresVisitante = await seleccionarMejorOnce(partido.equipoVisitante._id);

        // 1. Simulación total delegada al motor inteligente (pasa el tipo de partido)
        let resultado = simularPartido(
            { id: partido.equipoLocal._id, nombre: partido.equipoLocal.nombre, jugadores: jugadoresLocal },
            { id: partido.equipoVisitante._id, nombre: partido.equipoVisitante.nombre, jugadores: jugadoresVisitante },
            partido.tipo // <--- CRÍTICO: Avisa si es LIGA, ELIMINATORIA o FINAL
        );

        partido.golesLocal = resultado.marcador.local;
        partido.golesVisitante = resultado.marcador.visitante;

        if (resultado.ganadorPenaltis) {
            partido.ganadorPenaltis = resultado.ganadorPenaltis;
            
            // Guardamos los goles de la tanda usando la nueva estructura
            partido.marcadorTanda = {
                golesLocal: resultado.marcadorTanda.local,
                golesVisitante: resultado.marcadorTanda.visitante
            };
        } else {
            // Si no hubo penaltis, nos aseguramos de que esté limpio
            partido.ganadorPenaltis = null;
            partido.marcadorTanda = { golesLocal: null, golesVisitante: null };
        }

        partido.jugado = true;
        await partido.save();
    }
}

// Helper: Seleccionar los mejores 11 jugadores (para simular alineación)
async function seleccionarMejorOnce(clubId) {
    // Buscamos todos los jugadores del club
    const plantilla = await Jugador.find({ clubActual: clubId });
    
    // Separar porteros y jugadores de campo
    const porteros = plantilla.filter(j => j.posicionPrincipal === 'POR').sort((a,b) => b.valoracion - a.valoracion);
    const campo = plantilla.filter(j => j.posicionPrincipal !== 'POR').sort((a,b) => b.valoracion - a.valoracion);

    // Necesitamos 1 portero y 10 jugadores de campo
    const once = [];
    
    if (porteros.length > 0) once.push(porteros[0]); // Mejor portero
    else once.push(campo[0]); // Si no hay portero (raro), ponemos al mejor jugador de portero

    // Rellenar hasta 11 con los mejores de campo
    for(let i=0; i < 10 && i < campo.length; i++) {
        once.push(campo[i]);
    }

    return once;
}

// RUTA PARA JUGAR EL PARTIDO
router.get('/jugar-partido/:idPartido', requireLogin, async (req, res) => {
    try {
        const partidoId = req.params.idPartido;
        const partidoUsuario = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
        const partidaJuego = await Partida.findById(partidoUsuario.partidaId).populate('clubSeleccionado');

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
            const jugadoresLocal = await seleccionarMejorOnce(partido.equipoLocal._id);
            const jugadoresVisitante = await seleccionarMejorOnce(partido.equipoVisitante._id);
            
            const resultado = simularPartido(
                { nombre: partido.equipoLocal.nombre, jugadores: jugadoresLocal },
                { nombre: partido.equipoVisitante.nombre, jugadores: jugadoresVisitante }
            );

            partido.golesLocal = resultado.marcador.local;
            partido.golesVisitante = resultado.marcador.visible; 
            partido.jugado = true;
            await partido.save();

            // Limpiamos los convocados del equipo local y del visitante tras jugar
            await clubesDAO.limpiarConvocados(partido.equipoLocal._id);
            await clubesDAO.limpiarConvocados(partido.equipoVisitante._id);

            if (partido._id.toString() === partidoId) {
                resultadoUsuario = resultado;
                equipoLocalUsuario = { nombre: partido.equipoLocal.nombre, jugadores: jugadoresLocal };
                equipoVisitanteUsuario = { nombre: partido.equipoVisitante.nombre, jugadores: jugadoresVisitante };
            }
        }

        //por si hay una recarga de pagina o un fallo durante la simulacion
        if (!resultadoUsuario) {
            const partidoYaJugado = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
            
            if (partidoYaJugado && partidoYaJugado.jugado) {
                // Reconstruimos el objeto resultado básico que espera la vista
                resultadoUsuario = {
                    marcador: {
                        local: partidoYaJugado.golesLocal,
                        visitante: partidoYaJugado.golesVisitante
                    },
                    // Añadimos arrays vacíos o simulados para las crónicas si tu plantilla los exige
                    goleadores: [], 
                    incidencias: []
                };

                // Recuperamos las plantillas con su orden actual para pintar los nombres en la vista
                const clubLocal = await Club.findById(partidoYaJugado.equipoLocal._id).populate('plantilla');
                const clubVisitante = await Club.findById(partidoYaJugado.equipoVisitante._id).populate('plantilla');

                // Pasamos los primeros 11 como los jugadores que disputaron el partido
                equipoLocalUsuario = { 
                    nombre: partidoYaJugado.equipoLocal.nombre, 
                    jugadores: clubLocal.plantilla.slice(0, 11) 
                };
                equipoVisitanteUsuario = { 
                    nombre: partidoYaJugado.equipoVisitante.nombre, 
                    jugadores: clubVisitante.plantilla.slice(0, 11) 
                };
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

        // 🛑 NUEVO: Detectar si ya empezó la fase eliminatoria
        const tieneEliminatorias = todosLosPartidos.some(p => p.tipo === 'ELIMINATORIA' || p.tipo === 'FINAL');

        // ==========================================
        // BLOQUE 1: PROCESAR TABLA DE CLASIFICACIÓN
        // ==========================================
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

            // OJO: Solo sumamos a la tabla los partidos que fueron de tipo 'LIGA'
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

        // ==========================================
        // BLOQUE 2: PROCESAR CUADRO DE ELIMINATORIAS (SI TIENE)
        // ==========================================
        const rondas = {};
        if (tieneEliminatorias) {
            const getNombreRonda = (jornada, tipo) => {
                if (tipo === 'FINAL' || jornada === 17) return 'Gran Final';
                if (jornada === 9 || jornada === 10) return 'Ronda de Play-offs (1/16)';
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
            rondas,               // Enviamos las rondas eliminatorias
            tieneEliminatorias    // Flag para saber si mostramos el Navbar de pestañas
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar la clasificación");
    }
});

// Ruta para ver el Cuadro de la Copa
router.get('/copa/:partidaId/:competicionId', requireLogin, async (req, res) => {
    try {
        const { partidaId, competicionId } = req.params;
        
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        const competicion = await Competicion.findById(competicionId);
        if (!partida || !competicion) return res.redirect('/inicioJuego/' + partidaId);
        const clubUsuario = partida.clubSeleccionado;

        //Obtenemos TODOS los partidos de esa Copa
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
        // 3. Agrupamos los partidos por Rondas (Jornadas)
        const rondas = {};
        
        // Helper para traducir el número de jornada a texto según tus reglas
        const getNombreRonda = (jornada, tipo) => {
            if (tipo === 'FINAL') return 'Gran Final';
            if (jornada === 5) return 'Octavos de Final';
            if (jornada === 6) return 'Cuartos de Final';
            if (jornada === 7) return 'Semifinales';
            return `Ronda ${jornada}`; // Por si hay rondas previas
        };

        partidosCopa.forEach(p => {
            const nombre = getNombreRonda(p.jornada, p.tipo);
            if (!rondas[nombre]) rondas[nombre] = [];
            rondas[nombre].push(p);
        });

        //para usar AJAX y no recargar la pagina todo el rato
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