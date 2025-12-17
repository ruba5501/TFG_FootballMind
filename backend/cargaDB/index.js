const cargarEstadios = require('./cargarEstadios'); 
const cargarCompeticiones = require('./cargarCompeticiones'); 
const cargarClubes = require('./cargarClubes'); 
// const cargarJugadores = require('./cargarJugadores');
// const cargarEmpleados = require('./cargarEmpleados'); 

async function cargarTodo() {
    console.log("--- Iniciando Proceso de Carga de Datos Iniciales ---");

    try {await cargarEstadios();
        await cargarCompeticiones(); 
        await cargarClubes();
        //(Jugadores y Empleados, cuando estén listos)
        // await cargarJugadores(); 
        // await cargarEmpleados(); 

        console.log("--- Carga de datos inicial completada con éxito. ---");
    } catch (error) {
        console.error("--- Error al cargar los datos en la base de datos ---");
        throw error;
    }
}

module.exports = cargarTodo;