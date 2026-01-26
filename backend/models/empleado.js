const mongoose = require('mongoose');

const empleadoSchema = new mongoose.Schema({
  partidaId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partida',
    required: true
  },
  nombre: { type: String, required: true, trim: true },
  edad: { type: Number, min: 18, max: 80, required: true },
  nacionalidad: { type: String, required: true, trim: true },
  bandera: { type: String, trim: true, default: null },
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
  atributos: {
    nivelFisico: { type: Number, min: 0, max: 100, default: 50 },
    nivelTecnico: { type: Number, min: 0, max: 100, default: 50 },
    nivelTactico: { type: Number, min: 0, max: 100, default: 50 },
    nivelPortero: { type: Number, min: 0, max: 100, default: 50 },
    nivelPsicologico: { type: Number, min: 0, max: 100, default: 50 },
    nivelMedico: { type: Number, min: 0, max: 100, default: 50 },
    nivelRecuperacion: { type: Number, min: 0, max: 100, default: 50 },
    nivelPrevencionLesiones: { type: Number, min: 0, max: 100, default: 50 },
    nivelDeteccion: { type: Number, min: 0, max: 100, default: 50 },
    regionEspecialidad: { type: String, trim: true },
    nivelCantera: { type: Number, min: 0, max: 100, default: 50 },
    motivacion: { type: Number, min: 0, max: 100, default: 50 },
    desarrolloJovenes: { type: Number, min: 0, max: 100, default: 50 },
    reputacion: { type: Number, min: 0, max: 100, default: 50 },
    estiloJuego: { type: String, trim: true },
    experiencia: { type: Number, min: 0, max: 100, default: 50 }
  }
});

module.exports = mongoose.model('Empleado', empleadoSchema);
