const express = require('express');
const partidaRouter = express.Router();
const partidaDAO = require('../daos/partidasDAO');
const empleadoDAO = require('../daos/empleadosDAO');
const Competicion = require('../models/competicion');
const Club = require('../models/club');
const { requireLogin } = require('../middleware/autenticacion');

partidaRouter.get('/seleccionPartida', requireLogin, async (req, res) =>{
  res.render('seleccionPartida');
});

partidaRouter.get('/crearPartida', requireLogin, async (req, res) => {
  try {
    const ligas = await Competicion.find({ tipo: 'liga' });
    const clubes = await Club.find().populate('competiciones');
    res.render('crearPartida', { ligas, clubes });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar datos');
  }
});

partidaRouter.post('/crearPartida', requireLogin, async (req, res) => {
  try {
    const { nombreEntrenador, edad, nacionalidad, atributos, clubSeleccionado, nombrePartida } = req.body;

    const entrenador = await empleadoDAO.crearEmpleado({nombre: nombreEntrenador, edad, nacionalidad, tipo: 'entrenadorPrincipal', atributos});

    await partidaDAO.crearPartida(req.session.userId, nombrePartida, clubSeleccionado, entrenador._id);
    
    res.redirect('/seleccionPartida');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al crear la partida');
  }
});

module.exports = partidaRouter;
