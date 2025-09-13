const mongoose = require('mongoose');

const jugadorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  edad: { type: Number, required: true },
  nacionalidad: String,
  altura: Number,
  peso: Number,
  posicion: {
    type: String,
    enum: ['portero', 'defensa', 'medio', 'delantero'],
    required: true
  },
  piernaBuena: { type: String, enum: ['izquierda', 'derecha'], required: true },
  piernaMala: { type: Number, min: 1, max: 5, default: 2 },
  valorMercado: Number,
  salario: Number,

  atributos: {
    ataque: {
      regate: { type: Number, default: 0 },
      pase: { type: Number, default: 0 },
      disparo: { type: Number, default: 0 },
      vision: { type: Number, default: 0 },
      centros: { type: Number, default: 0 },
      desmarques: { type: Number, default: 0 }
    },
    defensa: {
      marcaje: { type: Number, default: 0 },
      entradas: { type: Number, default: 0 },
      intercepciones: { type: Number, default: 0 },
      despejes: { type: Number, default: 0 },
      duelosAereos: { type: Number, default: 0 },
      colocacion: { type: Number, default: 0 }
    },
    fisico: {
      velocidad: { type: Number, default: 0 },
      aceleracion: { type: Number, default: 0 },
      fuerza: { type: Number, default: 0 },
      resistencia: { type: Number, default: 0 },
      salto: { type: Number, default: 0 }
    },
    mental: {
      concentracion: { type: Number, default: 0 },
      anticipacion: { type: Number, default: 0 },
      valentia: { type: Number, default: 0 },
      liderazgo: { type: Number, default: 0 },
      decisiones: { type: Number, default: 0 }
    },
    portero: {
      reflejos: { type: Number, default: 0 },
      paradas: { type: Number, default: 0 },
      estirada: { type: Number, default: 0 },
      juegoAereo: { type: Number, default: 0 },
      unoContraUno: { type: Number, default: 0 },
      blocaje: { type: Number, default: 0 },
      saqueMano: { type: Number, default: 0 },
      comunicacion: { type: Number, default: 0 },
      penales: { type: Number, default: 0 }
    }
  },

  estado: {
    forma: { type: Number, default: 100 },
    moral: { type: Number, default: 100 },
    lesion: { type: String, default: null }
  },
  foto: { type: String } // URL a la imagen
});

module.exports = mongoose.model('Jugador', jugadorSchema);