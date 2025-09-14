const mongoose = require('mongoose');

const empleadoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipo: { 
    type: String,
    enum: ['preparadorFisico','preparadorTecnico','preparadorTactico','preparadorPorteros','psicologo','medico','fisio','ojeador', 'ojeadorCantera','entrenadorCantera','entrenadorPrincipal','segundoEntrenador'],
    required: true
  },
  atributos: {
    // Comunes a todos (se pueden dejar vacíos)
    //igual poner min y max
    nivelFisico: Number,
    nivelTecnico: Number,
    nivelTactico: Number,
    nivelPortero: Number,
    nivelPsicologico: Number,
    nivelMedico: Number,
    nivelRecuperacion: Number,
    nivelPrevencionLesiones: Number,
    nivelDeteccion: Number,
    regionEspecialidad: String,
    nivelCantera: Number,
    motivacion: Number,
    desarrolloJovenes: Number,
    reputacion: Number,
    estiloJuego: String,
    experiencia: Number
  }
});

module.exports = mongoose.model('Empleado', empleadoSchema);
