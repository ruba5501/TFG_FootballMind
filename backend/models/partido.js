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
    jornada: { type: Number, required: true }, // para liga poner de 1 a el num jornadas y para copa poner un numero cualquiera pero luego saberlo para saber si es octavos, cuartos...
  
    equipoLocal: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    equipoVisitante: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  
    golesLocal: { type: Number, default: 0 },
    golesVisitante: { type: Number, default: 0 },
  
    jugado: { type: Boolean, default: false },
    fecha: { type: Date, required: true } 
});

module.exports = mongoose.model('Partido', partidoSchema);