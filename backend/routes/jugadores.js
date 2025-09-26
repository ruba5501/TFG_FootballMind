const express = require('express');
const jugadoresRouter = express.Router();
const jugadoresDAO = require('../daos/jugadoresDAO');

jugadoresRouter.post('/jugadores', async (req, res) => {
  try {
    const jugador = await jugadoresDAO.crearJugador(req.body);
    res.json(jugador);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

jugadoresRouter.get('/jugadores', async (req, res) => {
  const jugadores = await jugadoresDAO.listarJugadores();
  res.json(jugadores);
});

jugadoresRouter.get('/buscarJugador/:id', async (req, res) => {
  const jugador = await jugadoresDAO.buscarJugadorPorId(req.params.id);
  res.json(jugador);
});

jugadoresRouter.put('/editarJugador/:id', async (req, res) => {
  const jugador = await jugadoresDAO.actualizarJugador(req.params.id, req.body);
  res.json(jugador);
});

jugadoresRouter.delete('/eliminarJugador/:id', async (req, res) => {
  await jugadoresDAO.eliminarJugador(req.params.id);
  res.json({ mensaje: "Jugador eliminado" });
});

module.exports = jugadoresRouter;
