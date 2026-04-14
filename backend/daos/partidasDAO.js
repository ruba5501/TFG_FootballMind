const Partida = require('../models/partida');
const Jugador = require('../models/jugador');
const Empleado = require('../models/empleado');
const Club = require('../models/club');
const Competicion = require('../models/competicion');
const Estadio = require('../models/estadio');
const Partido = require('../models/partido');
const Negociacion = require('../models/negociacion');

class PartidaDAO {
  async crearPartida(usuarioId, nombrePartida, clubSeleccionado, entrenadorId, _id) {
    const partida = new Partida({
      _id,
      usuarioId,
      nombrePartida,
      clubSeleccionado: clubSeleccionado,
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
    await Empleado.deleteMany({ partidaId: id });
    await Club.deleteMany({ partidaId: id });
    await Competicion.deleteMany({ partidaId: id });
    await Estadio.deleteMany({ partidaId: id });
    await Partido.deleteMany({ partidaId: id });
    await Negociacion.deleteMany({ partidaId: id });
    
    return await Partida.findByIdAndDelete(id);
  }
}

module.exports = new PartidaDAO();
