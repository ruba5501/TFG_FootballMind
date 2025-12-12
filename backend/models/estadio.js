const mongoose = require('mongoose');

const estadioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  ciudad: { type: String, required: true, trim: true },
  capacidad: { type: Number, required: true },
  anioConstruccion: { type: Number, required: true },
  estadoActual: { type: String, enum: ['excelente', 'bueno', 'regular', 'malo'], default: 'bueno' },
  foto: { type: String, trim: true, default: null }
});

module.exports = mongoose.model('Estadio', estadioSchema);