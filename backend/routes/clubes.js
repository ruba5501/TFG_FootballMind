const express = require('express');
const clubRouter = express.Router();
const partidasDAO = require('../daos/partidasDAO');
const clubesDAO = require('../daos/clubesDAO');
const Club = require('../models/club');
const { requireLogin } = require('../middleware/autenticacion');

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

clubRouter.put('/editarClub/:id', async (req, res) => {
  const club = await clubesDAO.actualizarClub(req.params.id, req.body);
  res.json(club);
});

clubRouter.delete('/eliminarClubes/:id', async (req, res) => {
  await clubesDAO.eliminarClub(req.params.id);
  res.json({ mensaje: "Club eliminado" });
});

clubRouter.get('/formacion/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        if (!partida) {
          return res.redirect('/');
        }

        const clubUsuario = await clubesDAO.buscarClubPorId(partida.clubSeleccionado);

        const filial = await Club.findOne({ clubMatriz: clubUsuario._id }).populate('plantilla');

        res.render('formacion', {
            partida,
            clubUsuario,
            filial,
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

module.exports = clubRouter;