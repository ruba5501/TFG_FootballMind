// backend/routes/juego.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Modelos
const Partida = require('../models/partida');
const Club = require('../models/club');
const Jugador = require('../models/jugador');

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
router.get('/jugar-partido/:idPartida', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.idPartida;
        const rivalId = req.query.rival; // Debes pasar el ID del rival por URL

        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        if (!partida) return res.redirect('/listarPartidas');

        // 1. Obtener datos del Club Usuario (Local)
        const clubUsuario = partida.clubSeleccionado;
        const jugadoresUsuario = await seleccionarMejorOnce(clubUsuario._id);

        // 2. Obtener datos del Club Rival (Visitante)
        // Si no hay rivalId (ej. partido de prueba), cogemos uno aleatorio de la misma liga
        let clubRival;
        if (rivalId) {
            clubRival = await Club.findById(rivalId);
        } else {
             // Lógica temporal: buscar un rival random que no sea el mío
            clubRival = await Club.findOne({ _id: { $ne: clubUsuario._id }, partidaId: partida._id });
        }
        
        const jugadoresRival = await seleccionarMejorOnce(clubRival._id);

        // 3. Preparar objetos para el motor
        const equipoLocal = { nombre: clubUsuario.nombre, jugadores: jugadoresUsuario };
        const equipoVisitante = { nombre: clubRival.nombre, jugadores: jugadoresRival };

        // 4. EJECUTAR SIMULACIÓN
        const resultado = simularPartido(equipoLocal, equipoVisitante);

        // 5. Guardar/Renderizar
        // Aquí podrías guardar el resultado en el historial de la partida
        
        // Renderizamos una vista con el resultado
        res.render('resultadoPartido', {
            title: 'Resultado del Partido',  
            partida,
            local: equipoLocal,
            visitante: equipoVisitante,
            resultado: resultado
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al simular el partido");
    }
});

module.exports = router;