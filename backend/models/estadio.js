const mongoose = require('mongoose');

const estadioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  ciudad: { type: String, required: true },
  capacidad: { type: Number, required: true },
  anioConstruccion: { type: Number, required: true },
  estadoActual: { type: String, enum: ['excelente', 'bueno', 'regular', 'malo'], default: 'bueno' }
});

module.exports = mongoose.model('Estadio', estadioSchema);