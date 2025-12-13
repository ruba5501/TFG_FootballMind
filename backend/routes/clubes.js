const express = require('express');
const clubRouter = express.Router();
const clubesDAO = require('../daos/clubesDAO');

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

module.exports = clubRouter;