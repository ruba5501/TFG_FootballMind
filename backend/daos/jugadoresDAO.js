const Jugador = require('../models/jugador');

class JugadoresDAO {
  async crearJugador(data) {
    const jugador = new Jugador(data);
    return await jugador.save();
  }

  async listarJugadores() {
    return await Jugador.find();
  }

  async buscarJugadorPorId(id) {
    return await Jugador.findById(id);
  }

  async actualizarJugador(id, data) {
    return await Jugador.findByIdAndUpdate(id, data, { new: true });
  }

  async eliminarJugador(id) {
    return await Jugador.findByIdAndDelete(id);
  }
}

module.exports = new JugadoresDAO();