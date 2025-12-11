const express = require('express');
const sesionRouter = express.Router();
const bcrypt = require('bcrypt');
const usersDAO = require('../daos/usersDAO');

sesionRouter.post('/registro', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validar campos
    if (!username || !email || !password) {
      return res.status(400).send('Faltan datos');
    }

    // Comprobar si ya existe
    const existeUsername = await usersDAO.buscarPorUsername(username);
    if (existeUsername) {
      return res.status(400).send('El nombre de usuario ya están en uso');
    }
    const existeEmail = await usersDAO.buscarPorEmail(email);
    if (existeEmail) {
      return res.status(400).send('El email ya están en uso');
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    await usersDAO.crearUsuario({ username, email, password: hashedPassword });

    const user = await usersDAO.buscarPorUsername(username);
    req.session.userId = user._id;
    req.session.username = user.username;

    res.redirect('/opcionPartida');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el registro');
  }
});

sesionRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Buscar usuario
    const user =  await usersDAO.buscarPorUsername(username);
    if (!user) {
      return res.render('index', { errorUsername: 'El usuario no existe', errorPassword: null });
    }

    // Comparar contraseña
    const isCorrecta = await bcrypt.compare(password, user.password);
    if (!isCorrecta) {
      return res.render('index', { errorUsername: null, errorPassword: 'Contraseña incorrecta' });
    }

    // Guardar sesión
    req.session.userId = user._id;
    req.session.username = user.username;

    res.redirect('/opcionPartida');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el login');
  }
});

sesionRouter.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error al cerrar sesión');
    }
    res.redirect('/');
  });
});

module.exports = sesionRouter;
