"use strict";

require('dotenv').config({ quiet: true });
const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const port = process.env.PORT || 3000;
// Conexión a MongoDB desde db.js
const connectDB = require('./backend/db');


// Middleware session
const middlewareSession = require('./backend/middleware/sessions');

// Middlewares globales
app.use(cors());                // Permite peticiones desde frontend
app.use(express.json());        // Parsear JSON
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'))); // Archivos estáticos
app.set('view engine', 'ejs');      //configuracion para EJS
app.set('views', path.join(__dirname, 'views'));


app.use(middlewareSession);

// Middleware para exponer el usuario logueado a todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

//Routes
const indexRouter = require('./backend/routes/index');
const usersRouter = require('./backend/routes/user_sesion');
const jugadoresRouter = require('./backend/routes/jugadores');
const clubesRouter = require('./backend/routes/clubes');
const estadiosRouter = require('./backend/routes/estadios');
const empleadosRouter = require('./backend/routes/empleados');
const partidasRouter = require('./backend/routes/partidas');
const partidosRouter = require('./backend/routes/partidos');
const juegoRouter = require('./backend/routes/juego');
const negociacionesRouter = require('./backend/routes/negociaciones');

app.use('/', indexRouter);
app.use('/', usersRouter);
app.use('/', jugadoresRouter);
app.use('/', clubesRouter);
app.use('/', estadiosRouter);
app.use('/', empleadosRouter);
app.use('/', partidasRouter);
app.use('/', partidosRouter);
app.use('/', juegoRouter);
app.use('/', negociacionesRouter);

// Middleware Error 404
app.use((request, response, next) => {
    response.status(404);
    response.render("error404", {url: request.url});
});

// Middleware Error 500: Internal Server Error
app.use((err, req, res, next) => {
    res.status(500);
    res.render('error500', {
        message: err.message,
        stack: err.stack
    });
});

// Iniciar servidor
async function initializeApp() {
    try {
        await connectDB(); 
        
        app.listen(port, (err) => {
            if (err)
                console.error(`No se pudo inicializar el servidor: ${err.message}`);
            else
                console.log(`Servidor FootballMind escuchando en http://localhost:${port}`);
        });

    } catch (error) {
        console.error("Error durante el arranque de la aplicación o al cargar los datos en la base de datos:", error);
    }
}
initializeApp();