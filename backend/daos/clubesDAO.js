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
      .populate({path: 'plantilla',})
      .populate('clubMatriz', 'nombre');

    if (!club) return null;

    return {
      ...club.toObject(),
      tieneCantera: !club.esFilial
    };
  }

  async buscarFilialPorId(id) {
    const club = await Club.findOne({"clubMatriz": id})
      .populate({path: 'plantilla',})

    if (!club) return null;

    return {
      ...club.toObject()
    };
  }

  async actualizarAlineacion(clubId, nuevoOrdenIds) {
    return await Club.findByIdAndUpdate(
      clubId, 
      { $set: { plantilla: nuevoOrdenIds } }, 
      { new: true }
    ).populate('plantilla');
  }

  // Nota: Asegúrate de tener estos campos en tu Schema de Club o crear un Schema de 'Tactica'
  async actualizarRolesTacticos(clubId, roles) {
    /* roles = { 
         capitanId: '...', 
         penaltisId: '...', 
         faltasId: '...', 
         formacion: '4-4-2' 
       } 
    */
    return await Club.findByIdAndUpdate(
      clubId,
      { $set: { tactica: roles } }, 
      { new: true }
    );
  }
  async promoverCanteranoDefinitivo(clubMatrizId, filialId, jugadorId) {
    await Club.findByIdAndUpdate(filialId, { $pull: { plantilla: jugadorId } });
    return await Club.findByIdAndUpdate(clubMatrizId, { $addToSet: { plantilla: jugadorId } });
  }

  async convocarCanterano(clubMatrizId, jugadorId) {
      return await Club.findByIdAndUpdate(clubMatrizId, { $addToSet: { plantilla: jugadorId } });
  }

  //funcion para borrar canteranos que se han subido para un partido
  async limpiarConvocados(clubId) {
    const filial = await Club.findOne({ clubMatriz: clubId });
    
    if (!filial) return null;

    const idsCanteranos = filial.plantilla;

    return await Club.findByIdAndUpdate(
        clubId, 
        { $pull: { plantilla: { $in: idsCanteranos } } },
        { new: true }
    ).populate('plantilla');
  }

  async actualizarClub(id, datos) {
    return await Club.findByIdAndUpdate(id, datos, { new: true });
  }

  async eliminarClub(id) {
    return await Club.findByIdAndDelete(id);
  }
}

module.exports = new ClubsDAO();
