const express = require('express');
const partidaRouter = express.Router();

const partidaDAO = require('../daos/partidasDAO');
const empleadoDAO = require('../daos/empleadosDAO');
const clubesDAO = require('../daos/clubesDAO');
const Competicion = require('../models/competicion');
const Club = require('../models/club');
const { requireLogin } = require('../middleware/autenticacion');

const atributosDefault = {
  nivelFisico: 0,
  nivelTecnico: 0,
  nivelTactico: 0,
  nivelPortero: 0,
  nivelCantera: 0,
  motivacion: 0,
  desarrolloJovenes: 0,
  reputacion: 0,
  experiencia: 0
};

// Selección de partidas existentes
partidaRouter.get('/opcionPartida', requireLogin, (req, res) => {
  res.render('opcionPartida');
});

// Redirección correcta al primer paso
partidaRouter.get('/crearPartida', requireLogin, (req, res) => {
  res.redirect('/crearPartida/step1');
});

// Paso 1
partidaRouter.get('/crearPartida/step1', requireLogin, (req, res) => {
  const datos = req.session.crearPartida || {};
  res.render('crearPartidaStep1', { datos, error: null });
});

partidaRouter.post('/crearPartida/step1', requireLogin, (req, res) => {
  const { nombrePartida, nombreEntrenador, apellidoEntrenador, edad, nacionalidad } = req.body;

  if (!nombrePartida || !nombreEntrenador || !apellidoEntrenador) {
    return res.render('crearPartidaStep1', {
      datos: req.body,
      error: "Debes rellenar todos los campos obligatorios."
    });
  }

  req.session.crearPartida = {
    nombrePartida,
    nombreEntrenador,
    apellidoEntrenador,
    edad,
    nacionalidad
  };

  res.redirect('/crearPartida/step2');
});

// Paso 2
partidaRouter.get('/crearPartida/step2', requireLogin, async (req, res) => {
  if (!req.session.crearPartida) return res.redirect('/crearPartida/step1');
  
  const ligas = await Competicion.find({ tipo: 'liga' });
  const clubes = await Club.find().populate('competiciones');

  res.render('crearPartidaStep2', {
    datos: req.session.crearPartida,
    ligas,
    clubes,
    error: null
  });
});

partidaRouter.post('/crearPartida/step2', requireLogin, async (req, res) => {
  const { ligaSelect, club } = req.body;

  if (!ligaSelect || !club) {
    const ligas = await Competicion.find({ tipo: 'liga' });
    const clubes = await Club.find().populate('competiciones');

    return res.render('crearPartidaStep2', {
      datos: req.session.crearPartida,
      ligas,
      clubes,
      error: "Debes seleccionar una liga y un club"
    });
  }

  req.session.crearPartida.liga = ligaSelect;
  req.session.crearPartida.clubSeleccionado = club;

  res.redirect('/crearPartida/step3');
});

// Paso 3
partidaRouter.get('/crearPartida/step3', requireLogin, (req, res) => {
  if (!req.session.crearPartida?.clubSeleccionado)
    return res.redirect('/crearPartida/step1');

  res.render('crearPartidaStep3', {
    datos: req.session.crearPartida,
    error: null,
    atributosDefault
  });
});

partidaRouter.post('/crearPartida/step3', requireLogin, (req, res) => {
  req.session.crearPartida.atributos = req.body;
  req.session.save(() => {
    res.redirect('/crearPartida/final');
  });
});

// Paso Final
partidaRouter.get('/crearPartida/final', requireLogin, async (req, res) => {
  const datos = req.session.crearPartida;

  if (!datos) return res.redirect('/crearPartida/step1');

  try {
    const entrenador = await empleadoDAO.crearEmpleado({
      nombre: datos.nombreEntrenador,
      apellido: datos.apellidoEntrenador,
      edad: datos.edad,
      nacionalidad: datos.nacionalidad,
      tipo: 'entrenadorPrincipal',
      atributos: datos.atributos
    });

    await partidaDAO.crearPartida(
      req.session.userId,
      datos.nombrePartida,
      datos.clubSeleccionado,
      entrenador._id
    );

    const club = await clubesDAO.buscarClubPorId(datos.clubSeleccionado);

    req.session.crearPartida = null;

    res.render('crearPartidaFinal', { 
      datos: {
        nombrePartida: datos.nombrePartida,
        nombreEntrenador: `${entrenador.nombre} ${entrenador.apellido}`,
        clubNombre: club ? club.nombre : 'Desconocido'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al crear la partida');
  }
});

module.exports = partidaRouter;
