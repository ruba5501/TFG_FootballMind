const express = require('express');
const partidaRouter = express.Router();
const partidaDAO = require('../daos/partidasDAO');
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
