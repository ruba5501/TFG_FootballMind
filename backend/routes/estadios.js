const express = require('express');
const estadioRouter = express.Router();
const estadiosDAO = require('../daos/estadiosDAO');

estadioRouter.post('/estadios', async (req, res) => {
  try {
    const estadio = await estadiosDAO.crearEstadio(req.body);
    res.json(estadio);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

estadioRouter.get('/estadios', async (req, res) => {
  const estadios = await estadiosDAO.listarEstadios();
  res.json(estadios);
});

estadioRouter.get('/buscarEstadio/:id', async (req, res) => {
  const estadio = await estadiosDAO.buscarEstadioPorId(req.params.id);
  res.json(estadio);
});

estadioRouter.put('/editarEstadio/:id', async (req, res) => {
  const estadio = await estadiosDAO.actualizarEstadio(req.params.id, req.body);
  res.json(estadio);
});

estadioRouter.delete('/eliminarEstadio/:id', async (req, res) => {
  await estadiosDAO.eliminarEstadio(req.params.id);
  res.json({ mensaje: 'Estadio eliminado' });
});

module.exports = estadioRouter;