const Competicion = require('../models/competicion');

class CompeticionesDAO {
  async crearCompeticion(data) {
    const comp = new Competicion(data);
    return await comp.save();
  }

  async listarCompeticiones() {
    return await Competicion.find().populate('clubes');
  }

  async buscarCompeticionPorId(id) {
    return await Competicion.findById(id).populate('clubes');
  }

  async actualizarCompeticion(id, datos) {
    return await Competicion.findByIdAndUpdate(id, datos, { new: true });
  }

  async eliminarCompeticion(id) {
    return await Competicion.findByIdAndDelete(id);
  }
}

module.exports = new CompeticionesDAO();
