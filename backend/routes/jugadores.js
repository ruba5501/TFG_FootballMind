const express = require('express');
const router = express.Router();
const jugadoresDAO = require('../daos/jugadoresDAO');

router.post('/jugadores', async (req, res) => {
  try {
    const jugador = await jugadoresDAO.crearJugador(req.body);
    res.json(jugador);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/jugadores', async (req, res) => {
  const jugadores = await jugadoresDAO.listarJugadores();
  res.json(jugadores);
});

router.get('/buscarJugador/:id', async (req, res) => {
  const jugador = await jugadoresDAO.buscarJugadorPorId(req.params.id);
  res.json(jugador);
});

router.put('/editarJugador/:id', async (req, res) => {
  const jugador = await jugadoresDAO.actualizarJugador(req.params.id, req.body);
  res.json(jugador);
});

router.delete('/eliminarJugador/:id', async (req, res) => {
  await jugadoresDAO.eliminarJugador(req.params.id);
  res.json({ mensaje: "Jugador eliminado" });
});

module.exports = router;
