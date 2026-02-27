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
// Se llama por ejemplo: /jugar-partido/ID_PARTIDA?rival=ID_CLUB_RIVAL
router.get('/jugar-partido/:idPartido', requireLogin, async (req, res) => {
    try {
        const partidoId = req.params.idPartido;

        // 1. Buscar el partido del usuario para saber la competición y la jornada
        const partidoUsuario = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
        if (!partidoUsuario) return res.redirect('/listarPartidas');

        const partidaJuego = await Partida.findById(partidoUsuario.partidaId).populate('clubSeleccionado');

        // 2. Buscar TODOS los partidos de esa misma jornada y competición
        const partidosJornada = await Partido.find({
            competicionId: partidoUsuario.competicionId,
            jornada: partidoUsuario.jornada,
            jugado: false // Solo los que no se han jugado aún
        }).populate('equipoLocal equipoVisitante');

        let resultadoUsuario = null;
        let equipoLocalUsuario = null;
        let equipoVisitanteUsuario = null;

        // 3. Bucle para simular toda la jornada (usamos for...of para poder usar await)
        for (let partido of partidosJornada) {
            
            // Seleccionamos los 11 jugadores para los equipos de este partido
            const jugadoresLocal = await seleccionarMejorOnce(partido.equipoLocal._id);
            const jugadoresVisitante = await seleccionarMejorOnce(partido.equipoVisitante._id);

            const equipoLocal = { nombre: partido.equipoLocal.nombre, jugadores: jugadoresLocal };
            const equipoVisitante = { nombre: partido.equipoVisitante.nombre, jugadores: jugadoresVisitante };

            // Ejecutamos el motor del juego
            const resultado = simularPartido(equipoLocal, equipoVisitante);

            // Guardamos el resultado en la base de datos
            partido.golesLocal = resultado.marcador.local;
            partido.golesVisitante = resultado.marcador.visitante;
            partido.jugado = true;
            await partido.save();

            // Si este partido es el del usuario, guardamos los datos para mandarlos a la vista
            if (partido._id.toString() === partidoUsuario._id.toString()) {
                resultadoUsuario = resultado;
                equipoLocalUsuario = equipoLocal;
                equipoVisitanteUsuario = equipoVisitante;
            }
        }

        // 4. Renderizamos la vista con el resultado de tu partido, 
        // y opcionalmente pasamos "partidosJornada" por si quieres mostrar los otros resultados.
        res.render('resultadoPartido', {
            title: 'Resultado del Partido',  
            partida: partidaJuego,
            local: equipoLocalUsuario,
            visitante: equipoVisitanteUsuario,
            resultado: resultadoUsuario,
            partidoBBDD: partidoUsuario,
            restoJornada: partidosJornada // ¡Te paso toda la jornada por si quieres usarla!
        });

    } catch (error) {
        console.error("Error al simular la jornada:", error);
        res.status(500).send("Error al simular la jornada entera");
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

router.get('/clasificacion/:partidaId/:competicionId', requireLogin, async (req, res) => {
    try {
        const { partidaId, competicionId } = req.params;
        
        // 1. Obtener la partida y tu club
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        const competicion = await Competicion.findById(competicionId);
        if (!partida || !competicion) return res.redirect('/inicioJuego/' + partidaId);
        const clubUsuario = partida.clubSeleccionado;

        const todosLosPartidos = await Partido.find({
            partidaId: partidaId,
            competicionId: competicionId
        }).populate('equipoLocal equipoVisitante');

        if (todosLosPartidos.length === 0) {
            // Si no hay partidos, enviamos una clasificación vacía o error
            return res.render('clasificacion', {
                user: req.session.user,
                partida,
                clubUsuario,
                competicion,
                clasificacion: [],
                grupos: null
            });
        }

        const tabla = {};

        todosLosPartidos.forEach(p => {
            [p.equipoLocal, p.equipoVisitante].forEach(equipo => {
                const idStr = equipo._id.toString();
                if (!tabla[idStr]) {
                    tabla[idStr] = { 
                        club: equipo, 
                        pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0,
                        grupo: p.grupo || "Liga" 
                    };
                }
            });

            if (p.jugado) {
                const idLocal = p.equipoLocal._id.toString();
                const idVisit = p.equipoVisitante._id.toString();

                tabla[idLocal].pj += 1;
                tabla[idVisit].pj += 1;
                tabla[idLocal].gf += p.golesLocal;
                tabla[idLocal].gc += p.golesVisitante;
                tabla[idVisit].gf += p.golesVisitante;
                tabla[idVisit].gc += p.golesLocal;

                if (p.golesLocal > p.golesVisitante) {
                    tabla[idLocal].pts += 3;
                    tabla[idLocal].pg += 1;
                    tabla[idVisit].pp += 1;
                } else if (p.golesLocal < p.golesVisitante) {
                    tabla[idVisit].pts += 3;
                    tabla[idVisit].pg += 1;
                    tabla[idLocal].pp += 1;
                } else {
                    tabla[idLocal].pts += 1;
                    tabla[idVisit].pts += 1;
                    tabla[idLocal].pe += 1;
                    tabla[idVisit].pe += 1;
                }
            }
        });

        let clasificacion = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));

        let grupos = null;

        if (competicion.tipo === 'internacional_america') {
            grupos = {};
            const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
           
            clasificacion.forEach((fila, index) => {
                
                let nombreG = (fila.grupo && fila.grupo !== "Liga" && fila.grupo !== "Sin Grupo") 
                            ? fila.grupo 
                            : "Grupo " + letras[Math.floor(index / 4)];
                
                if (!grupos[nombreG]) grupos[nombreG] = [];
                grupos[nombreG].push(fila);
            });

            Object.keys(grupos).forEach(nombreG => {
                grupos[nombreG].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));
            });
        }
        let viewToRender = grupos ? 'partials/tablaGrupos' : 'partials/tablaLiga';
        
        //para usar AJAX y no recargar la pagina todo el rato
        if (req.query.ajax) {
            return res.render(viewToRender, { 
                clasificacion, 
                grupos, 
                competicion, 
                clubUsuario, 
                layout: false 
            });
        }

        // Renderizamos la vista
        res.render('clasificacion', {
            user: req.session.user,
            partida,
            clubUsuario,
            competicion,
            clasificacion,
            grupos
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
module.exports = router;