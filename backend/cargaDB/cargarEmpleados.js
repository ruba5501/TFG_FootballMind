const Club = require('../models/club');
const Empleado = require('../models/empleado');
const Partida = require('../models/partida');
const { obtenerIdentidad } = require('./cargarIdentidades');
const mongoose = require('mongoose');

const CONFIG_ROLES = [
    { rol: 'entrenadorPrincipal', cantidadBase: 1, extraPorReputacion: false },
    { rol: 'segundoEntrenador',   cantidadBase: 1, extraPorReputacion: false },
    { rol: 'preparadorFisico',    cantidadBase: 1, extraPorReputacion: true },
    { rol: 'preparadorTecnico',   cantidadBase: 1, extraPorReputacion: true },
    { rol: 'preparadorTactico',   cantidadBase: 1, extraPorReputacion: false },
    { rol: 'preparadorPorteros',  cantidadBase: 1, extraPorReputacion: false },
    { rol: 'psicologo',           cantidadBase: 1, extraPorReputacion: false },
    { rol: 'medico',              cantidadBase: 1, extraPorReputacion: false },
    { rol: 'fisio',               cantidadBase: 1, extraPorReputacion: true },
    { rol: 'ojeador',             cantidadBase: 1, esOjeador: true },      
    { rol: 'ojeadorCantera',      cantidadBase: 1, extraPorReputacion: false },
    { rol: 'entrenadorCantera',   cantidadBase: 1, extraPorReputacion: false }
];

async function generarEmpleadosNuevaPartida(partidaId) {
    try {
        const partida = await Partida.findById(partidaId);
        const clubUsuarioId = partida.clubSeleccionado.toString();
        const clubes = await Club.find();

        let todosLosEmpleados = [];
        let operacionesClubes = [];

        for (const club of clubes) {
            const esClubUsuario = club._id.toString() === clubUsuarioId;
            let idsEmpleadosDelClub = [];

            for (const conf of CONFIG_ROLES) {
                let cantidadACrear = conf.cantidadBase;
                
                if (esClubUsuario && conf.rol === 'entrenadorPrincipal') {
                    cantidadACrear = 0; 
                } else if (conf.esOjeador) {
                    cantidadACrear = club.reputacion > 70 ? 3 : (club.reputacion > 40 ? 2 : 1);
                } else if (conf.extraPorReputacion && club.reputacion > 75) {
                    cantidadACrear += 1; 
                }

                for (let i = 0; i < cantidadACrear; i++) {
                    const idEmpleado = new mongoose.Types.ObjectId();
                    const resultado = obtenerIdentidad(club.pais, club.reputacion, true, 0);
                    const nombre = resultado.nombreCompleto;
                    const nacionalidad = resultado.nacionalidad;
                    const nivelBase = calcularNivelBase(club.reputacion);
                    
                    todosLosEmpleados.push({
                        _id: idEmpleado,
                        partidaId: partidaId,
                        nombre: nombre,
                        edad: Math.floor(Math.random() * 35) + 35,
                        nacionalidad: nacionalidad,
                        bandera: `${nacionalidad}.png`,
                        tipo: conf.rol,
                        atributos: generarAtributosPorRol(conf.rol, nivelBase)
                    });

                    idsEmpleadosDelClub.push(idEmpleado);
                }
            }

            operacionesClubes.push({
                updateOne: {
                    filter: { _id: club._id },
                    update: { $set: { empleados: idsEmpleadosDelClub } }
                }
            });
        }

        if (todosLosEmpleados.length > 0) {
            await Empleado.insertMany(todosLosEmpleados);
            await Club.bulkWrite(operacionesClubes);
        }

        console.log(`Se han añadido ${todosLosEmpleados.length} empleados.`);
        return true;

    } catch (err) {
        console.error("Error en carga masiva de empleados:", err);
        throw err;
    }
}

function calcularNivelBase(reputacion) {
    let variacion = (Math.random() * 15) - 5; 
    let nivel = reputacion + variacion;
    return Math.min(98, Math.max(15, Math.floor(nivel)));
}

function generarAtributosPorRol(rol, nivel) {
    const rMin = () => Math.floor(Math.random() * 15) + 10;
    let atr = {
        nivelFisico: rMin(), nivelTecnico: rMin(), nivelTactico: rMin(),
        nivelPortero: rMin(), nivelPsicologico: rMin(), nivelMedico: rMin(),
        nivelRecuperacion: rMin(), nivelPrevencionLesiones: rMin(),
        nivelDeteccion: rMin(), nivelCantera: rMin(),
        motivacion: nivel, desarrolloJovenes: nivel, 
        reputacion: nivel, experiencia: Math.floor(nivel * 0.8)
    };

    if (rol.includes('Fisico')) atr.nivelFisico = nivel;
    if (rol.includes('Tecnico')) atr.nivelTecnico = nivel;
    if (rol.includes('Tactico')) atr.nivelTactico = nivel;
    if (rol.includes('Porteros')) atr.nivelPortero = nivel;
    if (rol === 'psicologo') atr.nivelPsicologico = nivel;
    if (rol === 'medico') { atr.nivelMedico = nivel; atr.nivelPrevencionLesiones = nivel; }
    if (rol === 'fisio') { atr.nivelRecuperacion = nivel; atr.nivelPrevencionLesiones = nivel; }
    if (rol.includes('ojeador')) atr.nivelDeteccion = nivel;
    if (rol.includes('Cantera')) atr.nivelCantera = nivel;
    if (rol.includes('entrenador')) { atr.nivelTecnico = nivel; atr.nivelTactico = nivel; }

    return atr;
}

module.exports = generarEmpleadosNuevaPartida;