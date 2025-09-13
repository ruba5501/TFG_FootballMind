const express = require('express');
const router = express.Router();
const estadiosDAO = require('../daos/estadiosDAO');

router.post('/', async (req, res) => {
  try {
    const estadio = await estadiosDAO.crearEstadio(req.body);
    res.json(estadio);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const estadios = await estadiosDAO.listarEstadios();
  res.json(estadios);
});

router.get('/:id', async (req, res) => {
  const estadio = await estadiosDAO.buscarEstadioPorId(req.params.id);
  res.json(estadio);
});

router.put('/:id', async (req, res) => {
  const estadio = await estadiosDAO.actualizarEstadio(req.params.id, req.body);
  res.json(estadio);
});

router.delete('/:id', async (req, res) => {
  await estadiosDAO.eliminarEstadio(req.params.id);
  res.json({ mensaje: 'Estadio eliminado' });
});

module.exports = router;