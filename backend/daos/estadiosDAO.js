const Estadio = require('../models/estadio');

class EstadiosDAO {
  async crearEstadio(data) {
    const estadio = new Estadio(data);
    return await estadio.save();
  }

  async listarEstadios() {
    return await Estadio.find();
  }

  async buscarEstadioPorId(id) {
    return await Estadio.findById(id);
  }

  async actualizarEstadio(id, data) {
    return await Estadio.findByIdAndUpdate(id, data, { new: true });
  }

  async eliminarEstadio(id) {
    return await Estadio.findByIdAndDelete(id);
  }
}

module.exports = new EstadiosDAO();