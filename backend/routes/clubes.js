const express = require('express');
const router = express.Router();
const clubesDAO = require('../daos/clubesDAO');

router.post('/', async (req, res) => {
  try {
    const nuevoClub = await clubesDAO.crearClub(req.body);
    res.json(nuevoClub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const clubes = await clubesDAO.listarClubes();
  res.json(clubes);
});

router.get('/:id', async (req, res) => {
  const club = await clubesDAO.buscarClubPorId(req.params.id);
  res.json(club);
});

router.put('/:id', async (req, res) => {
  const club = await clubesDAO.actualizarClub(req.params.id, req.body);
  res.json(club);
});

router.delete('/:id', async (req, res) => {
  await clubesDAO.eliminarClub(req.params.id);
  res.json({ mensaje: "Club eliminado" });
});

module.exports = router;