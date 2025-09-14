const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  ciudad: { type: String, required: true },
  estadio: { type: mongoose.Schema.Types.ObjectId, ref: 'Estadio' },

  presupuestoTraspasos: { type: Number, default: 0 },
  presupuestoSalarios: { type: Number, default: 0 },
  ingresos: {
    entradas: { type: Number, default: 0 },
    television: { type: Number, default: 0 },
    merchandising: { type: Number, default: 0 }
  },

  plantilla: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Jugador' }],
  empleados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' }],

  infraestructuras: {
    entrenamiento: { type: Number, min: 1, max: 5, default: 1 },
    cantera: { type: Number, min: 1, max: 5, default: 1 }
  },

  escudo: { type: String, default: null }, // URL
  popularidad: { type: Number, min: 0, max: 100, default: 0 },
  reputacion: { type: Number, min: 0, max: 100, default: 0 },
  historialTitulos: [
    {
      competicion: { type: String, required: true },
      cantidad: { type: Number, default: 0 },
      trofeo: { type: String, default: null } // URL
    }
  ]
});

module.exports = mongoose.model('Club', clubSchema);