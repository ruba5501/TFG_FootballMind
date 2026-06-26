const mongoose = require('mongoose');

const jugadorSchema = new mongoose.Schema({
  partidaId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Partida', 
    required: true,
    index: true 
  },
  nombre: { type: String, required: true, trim: true },
  dorsal: { type: Number, min: 1, max: 99 },
  edad: { type: Number, required: true },
  nacionalidad: String,
  altura: Number,
  peso: Number,

  posicionPrincipal: {
    type: String,
    enum: [
      'POR',       
      'LD', 'LI', 'DFC', 'CAD', 'CAI', 
      'MCD', 'MC', 'MCO', 'MD', 'MI', 
      'ED', 'EI', 'DC', 'SD'         
    ],
    required: true
  },

  posicionesSecundarias: [{
    type: String,
    enum: [
      'LD', 'LI', 'DFC', 'CAD', 'CAI', 
      'MCD', 'MC', 'MCO', 'MD', 'MI', 
      'ED', 'EI', 'DC', 'SD'
    ]
  }],

  rolEquipo: {
    type: String,
    enum: ['clave', 'importante', 'suplente', 'reserva', 'promesa'],
    required: true,
    default: 'suplente'
  },

  piernaBuena: { type: String, enum: ['izquierda', 'derecha'], required: true },
  piernaMala: { type: Number, min: 0, max: 5, default: 0 },
  versatilidad: { type: Number, min: 0, max: 5, default: 0 },

  valorMercado: Number,
  salario: Number,
  finContrato: { type: Date, required: true },
  fechaFinContratoOriginal: { type: Date, default: null },
  valoracion: { type: Number, min: 0, max: 100, default: 0 },
  potencial: { type: Number, min: 0, max: 100, default: 0 },

  clubActual: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  estadoClub: {
    type: String,
    enum: ['primerEquipo', 'cantera', 'cedido'],
    required: true,
    default: 'primerEquipo'
  },
  
  atributos: {
    habilidad: {
      regate: { type: Number, min: 0, max: 100, default: 0 },
      controlBalon: { type: Number, min: 0, max: 100, default: 0 },
      desmarques: { type: Number, min: 0, max: 100, default: 0 }
    },
    tiro: {
      definicion: { type: Number, min: 0, max: 100, default: 0 },
      potenciaTiro: { type: Number, min: 0, max: 100, default: 0 },
      tiroLejano: { type: Number, min: 0, max: 100, default: 0 },
      lanzamientoFaltas: { type: Number, min: 0, max: 100, default: 0 },
      lanzamientoPenaltis: { type: Number, min: 0, max: 100, default: 0 },
      remateCabeza: { type: Number, min: 0, max: 100, default: 0 }
    },
    pase: {
      paseCorto: { type: Number, min: 0, max: 100, default: 0 },
      paseLargo: { type: Number, min: 0, max: 100, default: 0 },
      vision: { type: Number, min: 0, max: 100, default: 0 },
      centros: { type: Number, min: 0, max: 100, default: 0 }
    },
    defensa: {
      marcaje: { type: Number, min: 0, max: 100, default: 0 },
      entradas: { type: Number, min: 0, max: 100, default: 0 },
      intercepciones: { type: Number, min: 0, max: 100, default: 0 },
      despejes: { type: Number, min: 0, max: 100, default: 0 },
      duelosAereos: { type: Number, min: 0, max: 100, default: 0 },
      colocacion: { type: Number, min: 0, max: 100, default: 0 }
    },
    fisico: {
      velocidad: { type: Number, min: 0, max: 100, default: 0 },
      aceleracion: { type: Number, min: 0, max: 100, default: 0 },
      agilidad: { type: Number, min: 0, max: 100, default: 0 },
      fuerza: { type: Number, min: 0, max: 100, default: 0 },
      resistencia: { type: Number, min: 0, max: 100, default: 0 },
      equilibrio: { type: Number, min: 0, max: 100, default: 0 },
      salto: { type: Number, min: 0, max: 100, default: 0 }
    },
    mental: {
      concentracion: { type: Number, min: 0, max: 100, default: 0 },      
      liderazgo: { type: Number, min: 0, max: 100, default: 0 },
      agresividad: { type: Number, min: 0, max: 100, default: 0 },
      motivacion: { type: Number, min: 0, max: 100, default: 0 },
      composturaBajoPresion: { type: Number, min: 0, max: 100, default: 0 }
    },
    portero: {
      reflejos: { type: Number, min: 0, max: 100, default: 0 },
      paradas: { type: Number, min: 0, max: 100, default: 0 },
      estirada: { type: Number, min: 0, max: 100, default: 0 },
      juegoAereo: { type: Number, min: 0, max: 100, default: 0 },
      unoContraUno: { type: Number, min: 0, max: 100, default: 0 },
      blocaje: { type: Number, min: 0, max: 100, default: 0 },
      saque: { type: Number, min: 0, max: 100, default: 0 },
      comunicacion: { type: Number, min: 0, max: 100, default: 0 },
      penales: { type: Number, min: 0, max: 100, default: 0 }
    }
  },

  estado: {
    forma: { type: Number, default: 100 },
    moral: { type: Number, default: 100 },
    satisfaccion: { type: Number, default: 100 },
    lesion: { type: String, default: null },
    sanciones: [{
        competicionId: { type: String }, // 'LIGA', 'CHAMPIONS', 'COPA'
        partidosRestantes: { type: Number, default: 0 } // Cuántos partidos le quedan de castigo
    }],
    rendimiento: { type: Number, default: 80 }
  },

  mercado: {
    transferible: { type: Boolean, default: false },
    cedible: { type: Boolean, default: false },
    clausulaRescision: { type: Number, default: 0 }
  },

  statsTemporada: [
    {
        competicionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competicion' },
        pj: { type: Number, default: 0 },
        titular: { type: Number, default: 0 },
        minutos: { type: Number, default: 0 },
        goles: { type: Number, default: 0 },
        asistencias: { type: Number, default: 0 },
        porteriasACero: { type: Number, default: 0 },
        amarillas: { type: Number, default: 0 },
        rojas: { type: Number, default: 0 },
        notaMedia: { type: Number, default: 0 }
    }
  ]
}, { 
  timestamps: true,
  collection: 'jugadores' 
});

module.exports = mongoose.model('Jugador', jugadorSchema);
