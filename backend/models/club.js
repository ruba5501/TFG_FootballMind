const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  ciudad: { type: String, required: true },
  estadio: { type: String, required: true },

  presupuesto: {
    traspasos: { type: Number, default: 0 },
    salarios: { type: Number, default: 0 }
  },

  ingresos: {
    entradas: { type: Number, default: 0 },
    television: { type: Number, default: 0 },
    merchandising: { type: Number, default: 0 }
  },

  jugadores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Jugador' }],
  empleados: [{ type: String }], //TO DO hacer un modelo Empleado

  popularidad: { type: Number, min: 0, max: 100, default: 50 },
  reputacion: { type: Number, min: 0, max: 100, default: 50 },

  infraestructuras: {
    entrenamiento: { type: Number, min: 1, max: 5, default: 3 },
    cantera: { type: Number, min: 1, max: 5, default: 3 }
  },

  //escudo: { type: String }, // URL a la imagen
  historialTitulos: [{ type: String }]
});

module.exports = mongoose.model('Club', clubSchema);