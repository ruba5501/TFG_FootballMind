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

  async actualizarRoles(clubId, datosRoles) {
    return await Club.findByIdAndUpdate(
      clubId,
      { 
        $set: { 
          "tactica.capitan": datosRoles.capitan,
          "tactica.penaltis": datosRoles.penaltis,
          "tactica.faltasIzquierda": datosRoles.faltasIzquierda,
          "tactica.faltasDerecha": datosRoles.faltasDerecha,
          "tactica.faltasLejanas": datosRoles.faltasLejanas,
          "tactica.cornersIzquierda": datosRoles.cornersIzquierda,
          "tactica.cornersDerecha": datosRoles.cornersDerecha
        } 
      },
      { new: true }
    );
  }

  async actualizarTactica(clubId, estiloJuego, mentalidad) {
    try {
        const resultado = await Club.updateOne(
            { _id: clubId },
            { 
                $set: { 
                    'tactica.estiloJuego': estiloJuego,
                    'tactica.mentalidad': mentalidad
                } 
            }
        );
        return resultado;
    } catch (error) {
        console.error("Error en clubesDAO al actualizar filosofía táctica:", error);
        throw error;
    }
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
    // Buscamos si este club tiene un filial asignado
    const filial = await Club.findOne({ clubMatriz: clubId });
    
    if (!filial || !filial.plantilla || filial.plantilla.length === 0) return null;

    const idsCanteranos = filial.plantilla;

    // Saca de la plantilla del primer equipo a todos los IDs que pertenecen originalmente al filial
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
  // Actualiza el presupuesto de forma directa (p.ej. tras una venta o ajuste manual)
  async actualizarPresupuesto(clubId, cantidad) {
    return await Club.findByIdAndUpdate(
      clubId,
      { $set: { presupuestoTraspasos: cantidad } },
      { new: true }
    );
  }

  // Modifica el presupuesto sumando o restando (ideal para pagar misiones de ojeadores)
  async modificarPresupuesto(clubId, cantidad) {
    return await Club.findByIdAndUpdate(
      clubId,
      { $inc: { presupuestoTraspasos: cantidad } },
      { new: true }
    );
  }
}

module.exports = new ClubsDAO();
