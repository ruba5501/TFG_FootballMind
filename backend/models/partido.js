// backend/models/partido.js
const mongoose = require('mongoose');

const partidoSchema = new mongoose.Schema({
    partidaId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Partida', 
        required: true, 
        index: true 
    },
    competicionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competicion', required: true },
  
    tipo: { type: String, enum: ['LIGA', 'ELIMINATORIA', 'FINAL'], default: 'LIGA' },
    jornada: { type: Number, required: true }, 
    grupo: { type: String },
    
    equipoLocal: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    equipoVisitante: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  
    formacionLocal: { type: String, default: '4-3-3' },      
    formacionVisitante: { type: String, default: '4-3-3' },
    
    golesLocal: { type: Number, default: 0 },
    golesVisitante: { type: Number, default: 0 },
  
    jugado: { type: Boolean, default: false },
    fecha: { type: Date, required: true },

    llave: { type: String, default: null }, 
    ganadorPenaltis: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', default: null },

    marcadorTanda: {
        golesLocal: { type: Number, default: null },
        golesVisitante: { type: Number, default: null }
    }
});

partidoSchema.index({ partidaId: 1, fecha: 1 });
partidoSchema.index({ partidaId: 1, competicionId: 1, jornada: 1, jugado: 1 });

module.exports = mongoose.model('Partido', partidoSchema);