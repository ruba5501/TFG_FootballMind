const express = require('express');
const partidaRouter = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const partidaDAO = require('../daos/partidasDAO');
const empleadoDAO = require('../daos/empleadosDAO');
const clubesDAO = require('../daos/clubesDAO');

const Competicion = require('../models/competicion');
const Club = require('../models/club');
const Partida = require('../models/partida');
const Partido = require('../models/partido'); 

const cargarEstadios = require('../service/cargarEstadios'); 
const cargarCompeticiones = require('../service/cargarCompeticiones');
const cargarClubes = require('../service/cargarClubes');
const generarJugadores = require('../service/cargarJugadores');
const generarEmpleados = require('../service/cargarEmpleados');
const generarCalendario = require('../service/generarCalendario');
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
partidaRouter.get('/opcionPartida', requireLogin, async(req, res) => {
  const totalPartidas = await Partida.countDocuments({ usuarioId: req.session.user._id });
  res.render('opcionPartida', { totalPartidas });
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
  try {
      const pathClubes = path.join(__dirname, '../../base_datos/clubes.json');
      const pathCompeticiones = path.join(__dirname, '../../base_datos/competiciones.json');
      const ligas = JSON.parse(fs.readFileSync(pathCompeticiones, 'utf8')).filter(c => c.tipo === 'liga');
      const clubes = JSON.parse(fs.readFileSync(pathClubes, 'utf8'));

      res.render('crearPartidaStep2', {
          datos: req.session.crearPartida,
          ligas,
          clubes,
          error: null
      });
    } catch (err) {
        console.error("Error al leer archivos base:", err);
        res.status(500).send("Error al cargar los datos de selección.");
    }
});

partidaRouter.post('/crearPartida/step2', requireLogin, async (req, res) => {
  const { ligaSelect, club } = req.body;

  if (!ligaSelect || !club) {
    const pathClubes = path.join(__dirname, '../../base_datos/clubes.json');
    const pathCompeticiones = path.join(__dirname, '../../base_datos/competiciones.json');     
    const ligas = JSON.parse(fs.readFileSync(pathCompeticiones, 'utf8')).filter(c => c.tipo === 'liga');
    const clubes = JSON.parse(fs.readFileSync(pathClubes, 'utf8'));

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
    const partidaId = new mongoose.Types.ObjectId();
    const entrenadorId = new mongoose.Types.ObjectId();

    const estadios = await cargarEstadios(partidaId, datos.nombrePartida); 
    const competiciones = await cargarCompeticiones(partidaId, datos.nombrePartida);
    const clubes = await cargarClubes(partidaId, estadios, competiciones, datos.nombrePartida);

    const clubJugador = clubes.find(c => c.nombre === datos.clubSeleccionado);

    const nuevaPartida = await partidaDAO.crearPartida(
      req.session.user._id,
      datos.nombrePartida,
      clubJugador._id,
      entrenadorId,
      partidaId
    );

    const entrenador = await empleadoDAO.crearEmpleado({
      _id: entrenadorId,
      partidaId: partidaId,
      nombre: `${datos.nombreEntrenador} ${datos.apellidoEntrenador}`,
      edad: datos.edad,
      nacionalidad: datos.nacionalidad,
      tipo: 'entrenadorPrincipal',
      clubActual: clubJugador._id,
      atributos: datos.atributos
    });

    await generarJugadores(partidaId, clubes, datos.nombrePartida);
    await generarEmpleados(partidaId, clubes, datos.nombrePartida);
    await generarCalendario(partidaId);
    req.setTimeout(0);

    req.session.crearPartida = null;

    res.render('crearPartidaFinal', { 
      datos: {
        id: partidaId,
        nombrePartida: datos.nombrePartida,
        nombreEntrenador: entrenador.nombre,
        clubNombre: clubJugador ? clubJugador.nombre : 'Desconocido'
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
    try {
        const partidaId = req.params.id;
        
        // Obtenemos la partida y usamos populate para tener los datos completos del club seleccionado
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');
        if (!partida) return res.redirect('/listarPartidas');

        const clubUsuario = partida.clubSeleccionado;

        // Buscamos todos los partidos de ESTA partida donde juegue el equipo del usuario
        const partidos = await Partido.find({
            partidaId: partidaId,
            $or: [{ equipoLocal: clubUsuario._id }, { equipoVisitante: clubUsuario._id }]
        }).populate('equipoLocal equipoVisitante competicionId').sort({ fecha: 1 }); // Ordenados por fecha

        // Filtramos para buscar el próximo partido (el primero que no se haya jugado)
        const proximosPartidos = partidos.filter(p => p.jugado === false);
        const proximoPartido = proximosPartidos.length > 0 ? proximosPartidos[0] : null;

        // Calculamos quién es el rival en ese próximo partido
        let rivalId = null;
        if (proximoPartido) {
            const esLocal = proximoPartido.equipoLocal._id.toString() === clubUsuario._id.toString();
            rivalId = esLocal ? proximoPartido.equipoVisitante._id : proximoPartido.equipoLocal._id;
        }

        // Ahora sí pasamos TODAS las variables necesarias a la vista
        res.render('inicioJuego', { 
            user: req.session.user, 
            partida,
            clubUsuario,
            partidos,
            proximoPartido,
            rivalId
        });

    } catch (error) {
        console.error("Error al cargar inicio de juego:", error);
        res.status(500).send("Error al cargar el inicio del juego");
    }
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

partidaRouter.get('/avanzar-fecha/:id', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.id;
        const partida = await partidaDAO.obtenerPartidaPorId(partidaId);
        
        if (!partida) return res.redirect('/listarPartidas');

        // Sumar 1 día a la fecha actual de la partida
        const nuevaFecha = new Date(partida.fechaActual);
        nuevaFecha.setDate(nuevaFecha.getDate() + 1);
        partida.fechaActual = nuevaFecha;

        // Guardamos el cambio en la base de datos (asegúrate de que tu modelo tenga save o haz un update)
        await Partida.findByIdAndUpdate(partidaId, { fechaActual: nuevaFecha });

        // Recargamos el menú de inicio
        res.redirect('/inicioJuego/' + partidaId);

    } catch (error) {
        console.error("Error al avanzar fecha:", error);
        res.status(500).send("Error interno al intentar avanzar el tiempo.");
    }
});

partidaRouter.get('/avanzar-hasta-partido/:id', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.id;
        const partida = await partidaDAO.obtenerPartidaPorId(partidaId);
        if (!partida) return res.redirect('/listarPartidas');

        // 1. Buscamos el próximo partido del usuario
        const clubUsuarioId = partida.clubSeleccionado._id;
        const proximoPartido = await Partido.findOne({
            partidaId: partidaId,
            $or: [{ equipoLocal: clubUsuarioId }, { equipoVisitante: clubUsuarioId }],
            jugado: false
        }).sort({ fecha: 1 });

        // 2. Si hay un partido futuro, actualizamos la fecha del juego a la fecha de ese partido
        if (proximoPartido) {
            partida.fechaActual = new Date(proximoPartido.fecha);
            await Partida.findByIdAndUpdate(partidaId, { fechaActual: partida.fechaActual });
        }

        // 3. Recargamos la página
        res.redirect('/inicioJuego/' + partidaId);

    } catch (error) {
        console.error("Error al avanzar hasta el partido:", error);
        res.status(500).send("Error interno al intentar avanzar el tiempo.");
    }
});
module.exports = partidaRouter;
