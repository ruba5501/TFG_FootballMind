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

        // 1. Buscar el partido específico y cargar los datos de los clubes
        const partido = await Partido.findById(partidoId).populate('equipoLocal equipoVisitante');
        if (!partido) return res.redirect('/listarPartidas');

        // Opcional: obtener los datos de la partida de guardado para la vista
        const partidaJuego = await Partida.findById(partido.partidaId).populate('clubSeleccionado');

        // 2. Seleccionar los mejores 11 jugadores de cada equipo
        const jugadoresLocal = await seleccionarMejorOnce(partido.equipoLocal._id);
        const jugadoresVisitante = await seleccionarMejorOnce(partido.equipoVisitante._id);

        // 3. Preparar objetos para el motor de simulación
        const equipoLocal = { nombre: partido.equipoLocal.nombre, jugadores: jugadoresLocal };
        const equipoVisitante = { nombre: partido.equipoVisitante.nombre, jugadores: jugadoresVisitante };

        // 4. EJECUTAR SIMULACIÓN
        const resultado = simularPartido(equipoLocal, equipoVisitante);

        // 5. GUARDAR EL RESULTADO EN LA BASE DE DATOS
        partido.golesLocal = resultado.golesLocal;
        partido.golesVisitante = resultado.golesVisitante;
        partido.jugado = true;
        await partido.save(); 

        // 6. Renderizar vista de resultado
        res.render('resultadoPartido', {
            title: 'Resultado del Partido',  
            partida: partidaJuego,
            local: equipoLocal,
            visitante: equipoVisitante,
            resultado: resultado,
            partidoBBDD: partido // Pasamos la info del partido guardado
        });

    } catch (error) {
        console.error("Error en la simulación:", error);
        res.status(500).send("Error al simular el partido");
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
module.exports = router;