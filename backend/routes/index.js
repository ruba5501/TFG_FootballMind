const express = require('express');
const index_router = express.Router();

index_router.get('/index', (req, res) => {
  res.render('index', { errorUsername: null, errorPassword: null });
});

index_router.get('/', (req, res) => {
    res.render('inicio', { partida: null }); 
});

module.exports = index_router;