const express = require('express');
const partidaRouter = express.Router();
const mongoose = require('mongoose');

const partidaDAO = require('../daos/partidasDAO');
const empleadoDAO = require('../daos/empleadosDAO');
const clubesDAO = require('../daos/clubesDAO');
const Competicion = require('../models/competicion');
const Club = require('../models/club');
const generarJugadores = require('../cargaDB/cargarJugadores');
const generarEmpleados = require('../cargaDB/cargarEmpleados');
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
  res.redirect('/crearPartida/step1?reset=true');
});

// Paso 1
partidaRouter.get('/crearPartida/step1', requireLogin, (req, res) => {
  if (req.query.reset === 'true') {
      req.session.crearPartida = {}; 
  }
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

  req.session.save((err) => {
    if (err) return res.status(500).send("Error en sesión");
    res.redirect('/crearPartida/step2');
  });
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

  req.session.save((err) => {
    if (err) return res.status(500).send("Error en sesión");
    res.redirect('/crearPartida/step3');
  });
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
    const entrenadorId = new mongoose.Types.ObjectId();

    const nuevaPartida = await partidaDAO.crearPartida(
      req.session.user._id,
      datos.nombrePartida,
      datos.clubSeleccionado,
      entrenadorId
    );

    const entrenador = await empleadoDAO.crearEmpleado({
      _id: entrenadorId,
      partidaId: nuevaPartida._id,
      nombre: `${datos.nombreEntrenador} ${datos.apellidoEntrenador}`,
      edad: datos.edad,
      nacionalidad: datos.nacionalidad,
      tipo: 'entrenadorPrincipal',
      atributos: datos.atributos
    });

    await generarJugadores(nuevaPartida._id);
    await generarEmpleados(nuevaPartida._id);

    const club = await clubesDAO.buscarClubPorId(datos.clubSeleccionado);

    req.session.crearPartida = null;

    res.render('crearPartidaFinal', { 
      datos: {
        id: nuevaPartida._id,
        nombrePartida: datos.nombrePartida,
        nombreEntrenador: entrenador.nombre,
        clubNombre: club ? club.nombre : 'Desconocido'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al crear la partida');
  }
});

partidaRouter.get('/listarPartidas', requireLogin, async (req, res) => {
    try {
        const partidas = await partidaDAO.listarPartidasPorUsuario(req.session.user._id);
        
        res.render('listarPartidas', { partidas });
    } catch (error) {
        console.error("Error al cargar partidas:", error);
        res.status(500).send("Error al cargar tus partidas.");
    }
});

partidaRouter.post('/eliminarPartida/:id', requireLogin, async (req, res) => {
    try {
        const id = req.params.id;
        const partida = await partidaDAO.obtenerPartidaPorId(id);
        
        if (!partida || partida.usuarioId.toString() !== req.session.user._id.toString()) {
            return res.status(403).send("No tienes permiso para borrar esta partida.");
        }

        await partidaDAO.eliminarPartida(id);
        
        res.redirect('/listarPartidas');
    } catch (error) {
        console.error("Error al borrar la partida:", error);
        res.status(500).send("Error interno al intentar eliminar.");
    }
});

partidaRouter.get('/inicioJuego/:id', requireLogin, async (req, res) => {
    const partida = await partidaDAO.obtenerPartidaPorId(req.params.id);
    res.render('inicioJuego', { user: req.session.user, partida });
});

partidaRouter.get('/partida/:id', requireLogin, async (req, res) => {
    try {
        const partida = await partidaDAO.obtenerPartidaPorId(req.params.id);
        res.render('menuSalidaPartida', { partida });
    } catch (error) {
        res.redirect('/opcionPartida');
    }
});
// RUTA: SOLO GUARDAR
partidaRouter.get('/guardar/:id', requireLogin, async (req, res) => {
    try {
        await partidaDAO.actualizarPartida(req.params.id, {}); 
        const partida = await partidaDAO.obtenerPartidaPorId(req.params.id);
        res.render('menuSalidaPartida', { partida, mensaje: "¡Partida guardada con éxito!" });
    } catch (error) {
        res.redirect('/inicioJuego/' + req.params.id);
    }
});
// RUTA: GUARDAR Y SALIR
partidaRouter.get('/guardar-y-salir/:id', requireLogin, async (req, res) => {
    try {
        await partidaDAO.actualizarPartida(req.params.id, {});
        res.redirect('/opcionPartida');
    } catch (error) {
        res.redirect('/opcionPartida');
    }
});
module.exports = partidaRouter;
