"use strict";

const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const PORT = 3000;

// Conexión a MongoDB desde db.js
require('./backend/db');

// Middlewares
app.use(cors());                // Permite peticiones desde frontend
app.use(express.json());        // Parsear JSON
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'))); // Archivos estáticos
app.set('view engine', 'ejs');      //configuracion para EJS
app.set('views', path.join(__dirname, 'views'));

//Routes
const indexRouter = require('./backend/routes/index');
const usersRouter = require('./backend/routes/user_sesion');
const jugadoresRouter = require('./backend/routes/jugadores');
const clubesRouter = require('./backend/routes/clubes');
const estadiosRouter = require('./backend/routes/estadios');
const empleadosRouter = require('./backend/routes/empleados');

app.use('/', indexRouter);
app.use('/', usersRouter);
app.use('/', jugadoresRouter);
app.use('/', clubesRouter);
app.use('/', estadiosRouter);
app.use('/', empleadosRouter);


// Middleware Error 404
app.use((req, res, next) => {
  res.status(404).send('Página no encontrada');
});

// Middleware Error 500
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Error interno del servidor');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor FootballMind escuchando en http://localhost:${PORT}`);
});