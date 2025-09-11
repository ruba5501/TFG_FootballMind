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

/* TO DO Rutas ejemplo
const equiposRouter = require('./routes/equipos');
const jugadoresRouter = require('./routes/jugadores');

app.use('/api/equipos', equiposRouter);
app.use('/api/jugadores', jugadoresRouter);
*/
// Ruta de prueba
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