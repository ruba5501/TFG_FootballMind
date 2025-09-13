const mongoose = require('mongoose');
const Club = require('../models/club');
const clubsData = require('../../base_datos/clubes.json');
const connectDB = require('../db');

const cargarClubes = async () => {
  try {
    await connectDB();

    await Club.deleteMany();

    await Club.insertMany(clubsData);
    
    console.log(`Se han cargado ${clubsData.length} clubes`);
    process.exit();
  } catch (err) {
    console.error('Error cargando los clubes:', err);
    process.exit(1);
  }
};

cargarClubes();