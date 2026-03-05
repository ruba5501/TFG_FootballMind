const express = require('express');
const jugadoresRouter = express.Router();
const jugadoresDAO = require('../daos/jugadoresDAO');
const Jugador = require('../models/jugador');
const { requireLogin } = require('../middleware/autenticacion');

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

// Cambiar estado (Transferible / Cedible)
jugadoresRouter.post('/jugador/cambiar-estado/:id', requireLogin, async (req, res) => {
    try {
        const { tipo } = req.body; 
        const jugador = await Jugador.findById(req.params.id);

        if (tipo === 'transferible') {
            jugador.mercado.transferible = !jugador.mercado.transferible;
            if (jugador.mercado.transferible) jugador.mercado.cedible = false;
        }
        
        else if (tipo === 'cedible') {
            jugador.mercado.cedible = !jugador.mercado.cedible;
            if (jugador.mercado.cedible) jugador.mercado.transferible = false;
        }
        await jugador.save();
        res.json({ success: true, transferible: jugador.mercado.transferible, cedible: jugador.mercado.cedible });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Cambiar Dorsal
jugadoresRouter.post('/jugador/cambiar-dorsal/:id', requireLogin, async (req, res) => {
    try {
        const { dorsal } = req.body;
        const nuevoDorsal = parseInt(dorsal);
        const jugadorEditado = await Jugador.findById(req.params.id);

        if (!jugadorEditado) return res.status(404).json({ error: "Jugador no encontrado" });

        const isOcupado = await Jugador.findOne({
            clubActual: jugadorEditado.clubActual,
            dorsal: nuevoDorsal,
            _id: { $ne: jugadorEditado._id } 
        });

        if (isOcupado) {
            const dorsalesOcupados = await Jugador.find({ clubActual: jugadorEditado.clubActual }).distinct('dorsal');
            let dorsalLibre = 1;
            while (dorsalesOcupados.includes(dorsalLibre) || dorsalLibre === nuevoDorsal) {
                dorsalLibre++;
            }
            isOcupado.dorsal = dorsalLibre;
            await isOcupado.save();
        }
        jugadorEditado.dorsal = nuevoDorsal;
        await jugadorEditado.save();

        res.json({ success: true, mensaje: isOcupado ? "Dorsales intercambiados" : "Dorsal asignado" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
module.exports = jugadoresRouter;
