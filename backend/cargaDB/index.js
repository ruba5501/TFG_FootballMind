const cargarEstadios = require('./cargarEstadios'); 
const cargarCompeticiones = require('./cargarCompeticiones'); 
const cargarClubes = require('./cargarClubes'); 

async function cargarTodo() {
    console.log("--- Iniciando Proceso de Carga de Datos Iniciales ---");

    try {
        await cargarEstadios();
        await cargarCompeticiones(); 
        await cargarClubes();

        console.log("--- Carga de datos inicial completada con éxito. ---");
    } catch (error) {
        console.error("--- Error al cargar los datos en la base de datos ---");
        throw error;
    }
}

module.exports = cargarTodo;