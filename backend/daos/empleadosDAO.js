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

  async actualizarEmpleado(id, datos) {
    return await Empleado.findByIdAndUpdate(id, datos, { new: true });
  }

  async eliminarEmpleado(id) {
    return await Empleado.findByIdAndDelete(id);
  }
}

module.exports = new EmpleadosDAO();