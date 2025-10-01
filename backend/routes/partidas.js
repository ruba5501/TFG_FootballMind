const express = require('express');
const partidaRouter = express.Router();
const partidaDAO = require('../daos/partidasDAO');

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

partidaRouter.get('/seleccionPartida', requireLogin, async (req, res) =>{
  res.render('seleccionPartida');
});

partidaRouter.post('/crearPartida', requireLogin, async (req, res) => {
  const { nombrePartida, clubSeleccionado } = req.body;
  try {
    const partida = await partidaDAO.crearPartida(req.session.userId, nombrePartida, clubSeleccionado);
    res.redirect('/partidas/listar'); //TO DO te manda a la ventana de crear partida
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al crear la partida");
  }
});

partidaRouter.get('/listarPartidas', requireLogin, async (req, res) => {
  try {
    const partidas = await partidaDAO.listarPartidasPorUsuario(req.session.userId);
    res.render('partidas', { partidas });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al listar partidas");
  }
});

partidaRouter.get('/cargarPartida/:id', requireLogin, async (req, res) => {
  try {
    const partida = await partidaDAO.obtenerPartidaPorId(req.params.id);
    if (!partida || partida.usuarioId.toString() !== req.session.userId) {
      return res.status(403).send("No tienes acceso a esta partida");
    }

    // Guardamos partida activa en la sesión
    req.session.partidaId = partida._id;
    res.redirect('/juego'); // aquí llevarías al menú principal del juego
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar partida");
  }
});

partidaRouter.post('/eliminarPartida/:id', requireLogin, async (req, res) => {
  try {
    await partidaDAO.eliminarPartida(req.params.id);
    res.redirect('/partidas/listar');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al eliminar partida");
  }
});

module.exports = partidaRouter;
