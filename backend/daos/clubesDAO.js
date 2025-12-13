const Club = require('../models/club');

class ClubsDAO {

  async crearClub(data) {
    if (data.esFilial && !data.clubMatriz) {
      throw new Error('Un club filial debe tener clubMatriz');
    }
    return await new Club(data).save();
  }

  async listarClubes() {
    return await Club.find()
      .populate('plantilla')
      .populate('clubMatriz', 'nombre');
  }

  async buscarClubPorId(id) {
    const club = await Club.findById(id)
      .populate('plantilla')
      .populate('clubMatriz', 'nombre');

    if (!club) return null;

    return {
      ...club.toObject(),
      tieneCantera: !club.esFilial
    };
  }

  async actualizarClub(id, datos) {
    return await Club.findByIdAndUpdate(id, datos, { new: true });
  }

  async eliminarClub(id) {
    return await Club.findByIdAndDelete(id);
  }
}

module.exports = new ClubsDAO();
