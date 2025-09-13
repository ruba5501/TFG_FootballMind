//comprobalo mas

const Jugador = require('../models/jugador');

class JugadoresDAO {
  async crear(data) {
    const jugador = new Jugador(data);
    return await jugador.save();
  }

  async listar() {
    return await Jugador.find();
  }

  async buscarPorId(id) {
    return await Jugador.findById(id);
  }

  async actualizar(id, data) {
    return await Jugador.findByIdAndUpdate(id, data, { new: true });
  }

  async eliminar(id) {
    return await Jugador.findByIdAndDelete(id);
  }
}

module.exports = new JugadoresDAO();