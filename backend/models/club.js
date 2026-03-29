const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  partidaId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Partida', 
    required: true, 
    index: true 
  },
  nombre: { type: String, required: true, trim: true },
  ciudad: { type: String, required: true, trim: true },
  pais: { type: String, required: true, trim: true },
  estadio: { type: mongoose.Schema.Types.ObjectId, ref: 'Estadio', required: false },
  competiciones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Competicion', required: true }],
  division: { type: Number, default: 1 },
  
  esFilial: { type: Boolean, default: false },
  clubMatriz: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', default: null },

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

  escudo: { type: String, trim: true, default: null }, // URL
  popularidad: { type: Number, min: 0, max: 100, default: 0 },
  reputacion: { type: Number, min: 0, max: 100, default: 0 },
  
  historialTitulos: [
    {
      competicion: { type: String, required: true },
      cantidad: { type: Number, default: 0 },
      trofeo: { type: String, trim: true, default: null } // URL
    }
  ],
  statsTemporada: [
    {
      competicionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competicion' },
      pj: { type: Number, default: 0 },
      pg: { type: Number, default: 0 },
      pe: { type: Number, default: 0 },
      pp: { type: Number, default: 0 },
      gf: { type: Number, default: 0 },
      gc: { type: Number, default: 0 },
      puntos: { type: Number, default: 0 },
      eliminado: { type: Boolean, default: false }
    }
  ],
  tactica: {
    formacion: { type: String, default: '4-3-3' },
    titulares: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Jugador' }],
      validate: [v => v.length <= 11, 'No pueden haber más de 11 titulares']
    },
    suplentes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Jugador' }],
      validate: [v => v.length <= 13, 'El banquillo no puede superar los 13 jugadores']
    },
    reservas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Jugador' }],
    capitan: { type: mongoose.Schema.Types.ObjectId, ref: 'Jugador', default: null },
    penaltis: { type: mongoose.Schema.Types.ObjectId, ref: 'Jugador', default: null },
    faltasIzquierda: { type: mongoose.Schema.Types.ObjectId, ref: 'Jugador', default: null },
    faltasDerecha: { type: mongoose.Schema.Types.ObjectId, ref: 'Jugador', default: null },
    faltasLejanas: { type: mongoose.Schema.Types.ObjectId, ref: 'Jugador', default: null },
    cornersIzquierda: { type: mongoose.Schema.Types.ObjectId, ref: 'Jugador', default: null },
    cornersDerecha: { type: mongoose.Schema.Types.ObjectId, ref: 'Jugador', default: null }
  },
  listaObjetivos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Jugador' }],
  listaObjetivosEmpleados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' }]

}, { 
    collection: 'clubes' 
}
);

module.exports = mongoose.model('Club', clubSchema);