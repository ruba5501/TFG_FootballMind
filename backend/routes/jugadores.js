//comprobarlo mas

const express = require('express');
const router = express.Router();
const jugadoresDAO = require('../daos/jugadoresDAO');

router.post('/', async (req, res) => {
  try {
    const jugador = await jugadoresDAO.crear(req.body);
    res.json(jugador);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const jugadores = await jugadoresDAO.listar();
  res.json(jugadores);
});

router.get('/:id', async (req, res) => {
  const jugador = await jugadoresDAO.buscarPorId(req.params.id);
  res.json(jugador);
});

router.put('/:id', async (req, res) => {
  const jugador = await jugadoresDAO.actualizar(req.params.id, req.body);
  res.json(jugador);
});

router.delete('/:id', async (req, res) => {
  await jugadoresDAO.eliminar(req.params.id);
  res.json({ mensaje: "Jugador eliminado" });
});

module.exports = router;
