const Partida = require('../models/partida');

class PartidaDAO {
  async crearPartida(usuarioId, nombrePartida, clubSeleccionado, entrenadorId) {
    const partida = new Partida({
      usuarioId,
      nombrePartida,
      clubSeleccionado,
      entrenadorId,
      estadoJuego: {}
    });
    return await partida.save();
  }

 async listarPartidasPorUsuario(usuarioId) {
    return await Partida.find({ usuarioId })
      .populate('clubSeleccionado')
      .populate('entrenadorId')
      .sort({ ultimaActualizacion: -1 });
  }

  async obtenerPartidaPorId(id) {
    return await Partida.findById(id);
  }

  async actualizarPartida(id, estadoJuego) {
    return await Partida.findByIdAndUpdate(
      id,
      { estadoJuego, ultimaActualizacion: new Date() },
      { new: true }
    );
  }

  async eliminarPartida(id) {
    await Jugador.deleteMany({ partidaId: id });
    return await Partida.findByIdAndDelete(id);
  }
}

module.exports = new PartidaDAO();
