const express = require('express');
const partidaRouter = express.Router();
const partidaDAO = require('../daos/partidasDAO');
const Liga = require('../models/liga');
const Club = require('../models/club');
const Empleado = require('../models/empleado');
const Partida = require('../models/partida');

// Middleware de sesión
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/');
  }
  next();
}

partidaRouter.get('/seleccionPartida', requireLogin, async (req, res) =>{
  res.render('seleccionPartida');
});

partidaRouter.get('/crearPartida', requireLogin, async (req, res) => {
  try {
    const ligas = await Liga.find();
    const clubes = await Club.find().populate('liga');
    res.render('crearPartida', { ligas, clubes });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar datos');
  }
});

partidaRouter.post('/crearPartida', requireLogin, async (req, res) => {
  try {
    const { nombreEntrenador, edad, nacionalidad, atributos, clubSeleccionado, nombrePartida } = req.body;

    const entrenador = new Empleado({
      nombre: nombreEntrenador,
      edad,
      nacionalidad,
      tipo: 'entrenadorPrincipal',
      atributos
    });
    await entrenador.save();

    const partida = new Partida({
      usuarioId: req.session.userId,
      nombre: nombrePartida,
      entrenador: entrenador._id,
      club: clubSeleccionado
    });

    await partida.save();
    res.redirect('/seleccionPartida');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al crear la partida');
  }
});

module.exports = partidaRouter;
