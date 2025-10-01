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
  clubSeleccionado: {
    type: String,
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
    type: Object, // aquí puedes guardar JSON con jugadores, ligas, etc.
    default: {}
  }
});

module.exports = mongoose.model('Partida', partidaSchema);
