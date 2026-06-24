const mongoose = require('mongoose');

const empleadoSchema = new mongoose.Schema({
  partidaId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partida',
    required: true,
    index: true 
  },
  nombre: { type: String, required: true, trim: true },
  edad: { type: Number, min: 18, max: 80, required: true },
  nacionalidad: { type: String, required: true, trim: true },
  bandera: { type: String, trim: true, default: null },
  estado: { 
    type: String, 
    enum: ['libre', 'enMision'], 
    default: 'libre' 
  },
  paisDestino: { type: String, default: null },
  fechaRegreso: { type: Date, default: null },
  salario: { type: Number, default: 0 },
  finContrato: { type: Date, required: true },
  tipo: { 
    type: String,
    enum: [
      'preparadorFisico',
      'preparadorTecnico',
      'preparadorTactico',
      'preparadorPorteros',
      'psicologo',
      'medico',
      'fisio',
      'ojeador',
      'ojeadorCantera',
      'entrenadorCantera',
      'entrenadorPrincipal',
      'segundoEntrenador'
    ],
    required: true
  },
  clubActual: {type: mongoose.Schema.Types.ObjectId, ref: 'Club', default: null},
  atributos: {
    nivelFisico: { type: Number, min: 0, max: 100, default: 0 },
    nivelTecnico: { type: Number, min: 0, max: 100, default: 0 },
    nivelTactico: { type: Number, min: 0, max: 100, default: 0 },
    nivelPortero: { type: Number, min: 0, max: 100, default: 0 },
    nivelPsicologico: { type: Number, min: 0, max: 100, default: 0 },
    nivelMedico: { type: Number, min: 0, max: 100, default: 0 },
    nivelRecuperacion: { type: Number, min: 0, max: 100, default: 0 },
    nivelPrevencionLesiones: { type: Number, min: 0, max: 100, default: 0 },
    nivelDeteccion: { type: Number, min: 0, max: 100, default: 0 },
    regionEspecialidad: { type: String, trim: true },
    nivelCantera: { type: Number, min: 0, max: 100, default: 0 },
    motivacion: { type: Number, min: 0, max: 100, default: 0 },
    desarrolloJovenes: { type: Number, min: 0, max: 100, default: 0 },
    reputacion: { type: Number, min: 0, max: 100, default: 0 },
    estiloJuego: { type: String, trim: true },
    experiencia: { type: Number, min: 0, max: 100, default: 0 },
    estiloJuego: { 
      type: String, 
      enum: ['TIKI-TAKA', 'CONTRAATAQUE', 'AUTOBÚS', 'BALÓN LARGO', 'PRESIÓN ALTA', 'JUEGO POR BANDAS', 'PONER CENTROS', 'ESTÁNDAR'], 
      default: 'ESTÁNDAR' 
    },
    mentalidad: {
      type: String,
      enum: ['MUY_DEFENSIVA', 'DEFENSIVA', 'EQUILIBRADA', 'OFENSIVA', 'ULTRA_OFENSIVA'],
      default: 'EQUILIBRADA'
    }
  }
});

module.exports = mongoose.model('Empleado', empleadoSchema);
