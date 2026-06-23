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
    jornada: { type: Number, required: true }, // para liga poner de 1 a el num jornadas, para copa (octavos = 5 e ir subiendo), 
    // para internacional europea (jornadas de liga de 1 a 8 y dieciseisavos = 9 y 10 (ida y vuelta) y subiendo) y para internacional sudamericana da igual por ahora
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
    ganadorPenaltis: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', default: null }
});

module.exports = mongoose.model('Partido', partidoSchema);