const express = require('express');
const clubRouter = express.Router();
const partidasDAO = require('../daos/partidasDAO');
const clubesDAO = require('../daos/clubesDAO');
const Club = require('../models/club');
const Jugador = require('../models/jugador');
const { requireLogin } = require('../middleware/autenticacion');
const { FORMACIONES } = require('../service/cargarFormaciones');

const ORDEN_POSICIONES = { 
    'POR': 1, 
    'LD': 2, 'LI': 2, 'DFC': 3,
    'MCD': 4, 'MC': 5, 'MI': 6, 'MD': 6, 'MCO': 7,
    'ED': 8, 'EI': 8, 'SD': 9, 'DC': 10 
};

clubRouter.post('/clubes', async (req, res) => {
  try {
    if (req.body.esFilial && !req.body.clubMatriz) {
      return res.status(400).json({ error: 'Club filial sin club matriz' });
    }
    const nuevoClub = await clubesDAO.crearClub(req.body);
    res.json(nuevoClub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

clubRouter.get('/clubes', async (req, res) => {
  const clubes = await clubesDAO.listarClubes();
  res.json(clubes);
});

clubRouter.get('/buscarClub/:id', async (req, res) => {
  const club = await clubesDAO.buscarClubPorId(req.params.id);
  res.json(club);
});

clubRouter.get('/formacion/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        if (!partida) {
          return res.redirect('/');
        }

        const clubUsuario = await clubesDAO.buscarClubPorId(partida.clubSeleccionado);
        const filial = await clubesDAO.buscarFilialPorId(clubUsuario._id);

        let porteros = clubUsuario.plantilla.filter(j => j.posicionPrincipal === 'POR');
        let resto = clubUsuario.plantilla.filter(j => j.posicionPrincipal !== 'POR');

        porteros.sort((a, b) => b.media - a.media);
        resto.sort((a, b) => b.media - a.media);

        let titulares = [porteros[0], ...resto.slice(0, 10)];
        let demas = [...porteros.slice(1), ...resto.slice(10)];

        demas.sort((a, b) => (ORDEN_POSICIONES[a.posicionPrincipal] || 99) - (ORDEN_POSICIONES[b.posicionPrincipal] || 99));
        titulares.sort((a, b) => (ORDEN_POSICIONES[a.posicionPrincipal] || 99) - (ORDEN_POSICIONES[b.posicionPrincipal] || 99));

        clubUsuario.plantilla = [...titulares, ...demas];

        res.render('formacion', {
            partida,
            clubUsuario,
            filial,
            formaciones: FORMACIONES
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al cargar la formación");
    }
});

clubRouter.post('/guardarAlineacion/:clubId', requireLogin, async (req, res) => {
    try {
        const { nuevaPlantilla } = req.body; // Es el array de IDs
        await clubesDAO.actualizarAlineacion(req.params.clubId, nuevaPlantilla);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo guardar la alineación" });
    }
});

clubRouter.post('/actualizarRoles/:clubId', requireLogin, async (req, res) => {
    try {
        await clubesDAO.actualizarRolesTacticos(req.params.clubId, req.body);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al actualizar roles" });
    }
});

clubRouter.post('/subirCanterano/:jugadorId', requireLogin, async (req, res) => {
    try {
        const { jugadorId } = req.params;
        const filial = await Club.findOne({ plantilla: jugadorId });
        
        if (!filial) return res.status(404).json({ error: "Jugador no encontrado" });

        await clubesDAO.convocarCanterano(filial.clubMatriz, jugadorId);
      //falta la logica para subirlo para siempre
        res.json({ success: true, mensaje: "Convocado para el próximo partido" });
    } catch (err) {
        res.status(500).json({ error: "Error al convocar" });
    }
});

clubRouter.get('/plantilla/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        const clubUsuario = await Club.findById(partida.clubSeleccionado).populate('plantilla');
        
        clubUsuario.plantilla.sort((a, b) => (ORDEN_POSICIONES[a.posicionPrincipal] || 99) - (ORDEN_POSICIONES[b.posicionPrincipal] || 99));

        res.render('plantilla', {
            partida,
            clubUsuario,
            jugadores: clubUsuario.plantilla
        });
    } catch (err) {
        res.status(500).send("Error al cargar la plantilla");
    }
});

clubRouter.get('/club/dorsales-ocupados', requireLogin, async (req, res) => {
    try {
        const idDelClub = req.query.clubId;
        const jugadores = await Jugador.find({ clubActual: idDelClub });
        
        const ocupados = {};
        jugadores.forEach(j => {
            if (j.dorsal) {
                ocupados[String(j.dorsal)] = j.nombre;
            }
        });

        res.json({ ocupados });
    } catch (err) {
        console.error("Error en servidor:", err);
        res.status(500).json({ ocupados: {}, error: err.message });
    }
});

clubRouter.get('/cantera/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        
        const clubUsuario = await Club.findById(partida.clubSeleccionado)
            .populate('empleados');

        const clubFilial = await Club.findOne({ 
            partidaId: req.params.partidaId,
            clubMatriz: clubUsuario._id,
            esFilial: true 
        }).populate('plantilla');

        const ojeadoresCantera = clubUsuario.empleados.filter(emp => 
            emp.tipo === 'ojeadorCantera' 
        );

        let jugadoresFilial = [];
        if (clubFilial && clubFilial.plantilla) {
            jugadoresFilial = clubFilial.plantilla.sort((a, b) => 
                (ORDEN_POSICIONES[a.posicionPrincipal] || 99) - (ORDEN_POSICIONES[b.posicionPrincipal] || 99)
            );
        }
        res.render('cantera', {
            partida,
            clubUsuario,
            clubFilial, 
            jugadoresFilial,
            ojeadores: ojeadoresCantera
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error al cargar la gestión de cantera");
    }
});
module.exports = clubRouter;