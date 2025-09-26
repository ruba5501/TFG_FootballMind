const express = require('express');
const router = express.Router();
const Empleado = require('../models/empleado');

router.post('/empleados', async (req, res) => {
  try {
    const empleado = new Empleado(req.body);
    const guardado = await empleado.save();
    res.json(guardado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/empleados', async (req, res) => {
  try {
    const empleados = await Empleado.find();
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/buscarEmpleado/:id', async (req, res) => {
  try {
    const empleado = await Empleado.findById(req.params.id);
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(empleado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/editarEmplado/:id', async (req, res) => {
  try {
    const empleado = await Empleado.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(empleado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/eliminarEmpleado/:id', async (req, res) => {
  try {
    await Empleado.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Empleado eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
