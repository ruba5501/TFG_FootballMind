const mongoose = require('mongoose');

const partidaSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nombrePartida: {
    type: String,
    required: true
  },
  // CAMBIO: Ahora es ObjectId con referencia al modelo Club
  clubSeleccionado: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Club', 
    required: true
  },
  // CAMBIO: Añadimos el campo que faltaba con referencia al modelo Empleado
  entrenadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empleado',
    required: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  ultimaActualizacion: {
    type: Date,
    default: Date.now
  },
  estadoJuego: {
    type: Object,
    default: {}
  }
});

module.exports = mongoose.model('Partida', partidaSchema);