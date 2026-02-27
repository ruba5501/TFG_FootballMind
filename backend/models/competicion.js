const mongoose = require('mongoose');

const competicionSchema = new mongoose.Schema({
  partidaId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Partida', 
    required: true, 
    index: true 
  },
  nombre: { type: String, required: true },
  pais: { type: String, default: null }, // null si es internacional
  tipo: {
    type: String,
    enum: ['liga', 'copa', 'internacional_europa', 'internacional_america'],
    required: true
  },
  temporada: { type: Number, default: 2026 },
  logo: { type: String, trim: true, default: null },
  clubes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }],

  // DATOS DE LIGA (Si tipo === 'liga' o fase grupos)
  tabla: [{
        club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
        pj: { type: Number, default: 0 },
        pg: { type: Number, default: 0 },
        pe: { type: Number, default: 0 },
        pp: { type: Number, default: 0 },
        gf: { type: Number, default: 0 },
        gc: { type: Number, default: 0 },
        puntos: { type: Number, default: 0 },
        grupo: { type: String, default: null } // Para Libertadores: 'A', 'B', etc.
    }],

    //ELIMINATORIAS
    eliminatorias: [{
        ronda: { type: String }, // 'Octavos', 'Cuartos', etc.
        enfrentamientos: [{
            local: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
            visitante: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
            golesLocal: { type: Number, default: 0 },
            golesVisitante: { type: Number, default: 0 },
            penaltisLocal: { type: Number, default: 0 },
            penaltisVisitante: { type: Number, default: 0 },
            completado: { type: Boolean, default: false }
        }]
    }],
    faseActual: { 
        type: String, 
        default: 'regular', // 'regular', 'grupos', 'eliminatorias', 'finalizada'
    },
    actualCampeon: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', default: null }
}, { 
    collection: 'competiciones' 
}
);

module.exports = mongoose.model('Competicion', competicionSchema);
