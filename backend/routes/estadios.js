const express = require('express');
const router = express.Router();
const estadiosDAO = require('../daos/estadiosDAO');

router.post('/estadios', async (req, res) => {
  try {
    const estadio = await estadiosDAO.crearEstadio(req.body);
    res.json(estadio);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/estadios', async (req, res) => {
  const estadios = await estadiosDAO.listarEstadios();
  res.json(estadios);
});

router.get('/buscarEstadio/:id', async (req, res) => {
  const estadio = await estadiosDAO.buscarEstadioPorId(req.params.id);
  res.json(estadio);
});

router.put('/editarEstadio/:id', async (req, res) => {
  const estadio = await estadiosDAO.actualizarEstadio(req.params.id, req.body);
  res.json(estadio);
});

router.delete('/eliminarEstadio/:id', async (req, res) => {
  await estadiosDAO.eliminarEstadio(req.params.id);
  res.json({ mensaje: 'Estadio eliminado' });
});

module.exports = router;