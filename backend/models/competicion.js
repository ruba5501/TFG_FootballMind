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
    enum: ['liga', 'copa', 'internacional'],
    required: true
  },
  logo: { type: String, trim: true, default: null },
  clubes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }]
}, { 
    collection: 'competiciones' 
}
);

module.exports = mongoose.model('Competicion', competicionSchema);
