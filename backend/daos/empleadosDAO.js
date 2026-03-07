const Empleado = require('../models/empleado');

class EmpleadosDAO {
  async crearEmpleado(data) {
    const empleado = new Empleado(data);
    return await empleado.save();
  }
  
  async listarEmpleados() {
    return await Empleado.find();
  }

  async buscarEmpleadoPorId(id) {
    return await Empleado.findById(id);
  }

  async buscarEmpleadosPorClub(clubId) {
    return await Empleado.find({ clubActual: clubId });
  }

  async buscarEmpleados(filtros) {
    let query = {};

    if (filtros.nombre) {
      query.nombre = { $regex: filtros.nombre, $options: 'i' };
    }

    if (filtros.clubActual) {
      query.clubActual = filtros.clubActual;
    } else if (filtros.estado === 'libre') {
      query.clubActual = null;
    }

    if (filtros.atributos) {
      for (const [key, value] of Object.entries(filtros.atributos)) {
        query[`atributos.${key}`] = { $gte: Number(value) };
      }
    }

    return await Empleado.find(query);
  }

  async actualizarEmpleado(id, datos) {
    return await Empleado.findByIdAndUpdate(id, datos, { new: true });
  }

  async eliminarEmpleado(id) {
    return await Empleado.findByIdAndDelete(id);
  }
}

module.exports = new EmpleadosDAO();