const Club = require('../models/club');

class ClubsDAO {
  async crearClub(datos) {
    const club = new Club(datos);
    return await club.save();
  }

  async listarClubes() {
    return await Club.find().populate('jugadores');
  }

  async buscarClubPorId(id) {
    return await Club.findById(id).populate('jugadores');
  }

  async actualizarClub(id, datos) {
    return await Club.findByIdAndUpdate(id, datos, { new: true });
  }

  async eliminarClub(id) {
    return await Club.findByIdAndDelete(id);
  }
}

module.exports = new ClubsDAO();