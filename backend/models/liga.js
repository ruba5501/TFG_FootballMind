const mongoose = require('mongoose');

const ligaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true, trim: true },
  pais: { type: String, required: true, trim: true },
  //nivel: { type: Number, default: 1 }, // Por ejemplo: 1 = primera división
  logo: { type: String, default: null } // URL o imagen
});

module.exports = mongoose.model('Liga', ligaSchema);
