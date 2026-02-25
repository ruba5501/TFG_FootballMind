// backend/routes/juego.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Modelos
const Partida = require('../models/partida');
const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Partido = require('../models/partido');
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

router.get('/clasificacion/:idPartida', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.idPartida;
        
        // 1. Obtener la partida y tu club
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        if (!partida) return res.redirect('/listarPartidas');
        const clubUsuario = partida.clubSeleccionado;

        // 2. Averiguar en qué liga juega el usuario
        // Buscamos un partido cualquiera del usuario que sea de tipo 'LIGA'
        const partidoReferencia = await Partido.findOne({
            partidaId: partidaId,
            $or: [{ equipoLocal: clubUsuario._id }, { equipoVisitante: clubUsuario._id }],
            tipo: 'LIGA'
        }).populate('competicionId');

        if (!partidoReferencia) {
            return res.status(404).send("No se ha encontrado ninguna liga para tu equipo.");
        }

        const competicionLiga = partidoReferencia.competicionId;

        // 3. Obtener TODOS los partidos de esa liga (para saber qué equipos participan)
        const todosLosPartidos = await Partido.find({
            partidaId: partidaId,
            competicionId: competicionLiga._id
        }).populate('equipoLocal equipoVisitante');

        // 4. Construir la tabla
        const tabla = {};

        // Inicializamos los contadores de todos los equipos a cero
        todosLosPartidos.forEach(p => {
            if (!tabla[p.equipoLocal._id]) tabla[p.equipoLocal._id] = { club: p.equipoLocal, pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 };
            if (!tabla[p.equipoVisitante._id]) tabla[p.equipoVisitante._id] = { club: p.equipoVisitante, pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 };
        });

        // Sumamos las estadísticas solo de los partidos JUGADOS
        const partidosJugados = todosLosPartidos.filter(p => p.jugado === true);
        
        partidosJugados.forEach(p => {
            const idLocal = p.equipoLocal._id;
            const idVisit = p.equipoVisitante._id;

            // Partidos Jugados y Goles
            tabla[idLocal].pj += 1;
            tabla[idVisit].pj += 1;
            tabla[idLocal].gf += p.golesLocal;
            tabla[idLocal].gc += p.golesVisitante;
            tabla[idVisit].gf += p.golesVisitante;
            tabla[idVisit].gc += p.golesLocal;

            // Puntos y Victorias/Empates/Derrotas
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
        });

        // 5. Convertir la tabla a Array y ORDENARLA
        let clasificacion = Object.values(tabla).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts; // 1º Mayor puntuación
            
            const difB = b.gf - b.gc;
            const difA = a.gf - a.gc;
            if (difB !== difA) return difB - difA;     // 2º Diferencia de goles
            
            return b.gf - a.gf;                        // 3º Goles a favor
        });

        // Renderizamos la vista
        res.render('clasificacion', {
            user: req.session.user,
            partida,
            clubUsuario,
            competicion: competicionLiga,
            clasificacion
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar la clasificación");
    }
});

// Ruta para ver el Cuadro de la Copa
router.get('/copa/:idPartida', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.idPartida;
        
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        if (!partida) return res.redirect('/listarPartidas');
        const clubUsuario = partida.clubSeleccionado;

        // 1. Buscamos cualquier partido de tipo ELIMINATORIA o FINAL para saber qué copa juega tu equipo
        const partidoCopa = await Partido.findOne({
            partidaId: partidaId,
            tipo: { $in: ['ELIMINATORIA', 'FINAL'] },
            $or: [{ equipoLocal: clubUsuario._id }, { equipoVisitante: clubUsuario._id }]
        }).populate('competicionId');

        if (!partidoCopa) {
            return res.status(404).send("Aún no tienes partidos de Copa generados o fuiste eliminado antes de la creación.");
        }

        const competicionCopa = partidoCopa.competicionId;

        // 2. Obtenemos TODOS los partidos de esa Copa
        const partidosCopa = await Partido.find({
            partidaId: partidaId,
            competicionId: competicionCopa._id
        }).populate('equipoLocal equipoVisitante').sort({ jornada: 1 });

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

        res.render('copa', {
            user: req.session.user,
            partida,
            clubUsuario,
            competicion: competicionCopa,
            rondas
        });

    } catch (error) {
        console.error("Error al cargar la copa:", error);
        res.status(500).send("Error al cargar la competición de Copa");
    }
});
module.exports = router;