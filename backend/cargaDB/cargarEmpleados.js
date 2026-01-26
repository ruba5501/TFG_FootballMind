const Club = require('../models/club');
const Empleado = require('../models/empleado');
const Partida = require('../models/partida');
const { obtenerIdentidad } = require('./cargarIdentidades');

const ROLES_ESTANDAR = [
    'entrenadorPrincipal',
    'segundoEntrenador',
    'preparadorFisico',
    'preparadorTecnico',
    'preparadorTactico',
    'preparadorPorteros',
    'psicologo',
    'medico',
    'fisio',
    'ojeador',
    'ojeadorCantera',
    'entrenadorCantera'
];

async function generarEmpleadosNuevaPartida(partidaId) {
    try {
        const partida = await Partida.findById(partidaId);
        const clubUsuarioId = partida.clubSeleccionado.toString();
        
        const clubes = await Club.find();
        let contadorTotal = 0;

        for (const club of clubes) {
            let idsEmpleadosDelClub = [];
            const esClubUsuario = club._id.toString() === clubUsuarioId;

            for (const rol of ROLES_ESTANDAR) {
                if (esClubUsuario && rol === 'entrenadorPrincipal') continue;

                const identidad = obtenerIdentidad(club.pais, club.reputacion, false);
                const nivelBase = calcularNivelBase(club.reputacion);

                const nuevoEmpleado = new Empleado({
                    partidaId: partidaId, 
                    nombre: identidad.nombreCompleto,
                    edad: Math.floor(Math.random() * 35) + 35,
                    nacionalidad: identidad.nacionalidad,
                    bandera: identidad.bandera,
                    tipo: rol,
                    atributos: generarAtributosPorRol(rol, nivelBase)
                });

                const empleadoGuardado = await nuevoEmpleado.save();
                idsEmpleadosDelClub.push(empleadoGuardado._id);
            }

            await Club.findByIdAndUpdate(club._id, { 
                $set: { empleados: idsEmpleadosDelClub } 
            });

            contadorTotal += idsEmpleadosDelClub.length;
        }

        console.log(`Se han añadido ${contadorTotal} empleados`);
        return true;
    } catch (err) {
        console.error("Error en carga de empleados:", err);
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

module.exports = generarEmpleadosNuevaPartida ;