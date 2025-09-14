const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Empleado = require('../models/empleado');

async function cargarEmpleados() {
  try {
    await connectDB();

    const dataPath = path.join(__dirname, '../../base_datos/empleados.json');
    const empleados = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    await Empleado.deleteMany({});
    const empleadosAniadidos = await Empleado.insertMany(empleados);

    console.log(`Se han cargado ${empleadosAniadidos.length} empleados`);
    process.exit();
  } catch (err) {
    console.error('Error cargando los empleados:', err);
    process.exit(1);
  }
}

cargarEmpleados();
