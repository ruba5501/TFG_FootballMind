"use strict";

const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const PORT = 3001;

// Conexión a MongoDB desde db.js
require('./db');

// Middlewares
app.use(cors());                // Permite peticiones desde frontend
app.use(express.json());        // Parsear JSON
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'))); // Archivos estáticos

//Routes
const jugadoresRouter = require('./routes/jugadores');
const clubesRouter = require('./routes/clubes');
const estadiosRouter = require('./routes/estadios');

app.use('/jugadores', jugadoresRouter); //se puede poner solo '/' pero en el routes habria que añadir el /jugadores para cada llamada
app.use('/clubes', clubesRouter);
app.use('/estadios', estadiosRouter);

// Ruta de prueba (mirar si esta bien)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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