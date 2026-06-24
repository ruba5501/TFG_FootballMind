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

async function generarEmpleadosNuevaPartida(partidaId, listaClubes, nombrePartida, clubUsuarioId) {
    try {
        // Al recibir clubUsuarioId como parámetro, eliminamos el "await Partida.findById"
        const clubes = listaClubes;

        let todosLosEmpleados = [];
        let operacionesClubes = [];

        for (const club of clubes) {
            // Aseguramos la comparación de string limpia
            const esClubUsuario = clubUsuarioId && club._id.toString() === clubUsuarioId.toString();
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
                    const resultado = obtenerIdentidad(club.pais, club.reputacion, true, 0, new Date(2025, 6, 1));
                    const nombre = resultado.nombreCompleto;
                    const nacionalidad = resultado.nacionalidad;
                    const nivelBase = calcularNivelBase(club.reputacion);
                    const atributosGenerados = generarAtributosPorRol(conf.rol, nivelBase);
        
                    if (conf.rol === 'entrenadorPrincipal') {
                        // El entrenador adopta la filosofía ideal que ya se calculó para el club y su plantilla
                        atributosGenerados.estiloJuego = club.tactica?.estiloJuego || 'ESTÁNDAR';
                        atributosGenerados.mentalidad = club.tactica?.mentalidad || 'EQUILIBRADA';
                    }

                    const empleadoTemporal = { tipo: conf.rol, atributos: atributosGenerados };
                    const salario = calcularSalarioEmpleado(empleadoTemporal, club.reputacion);
                    const finContrato = resultado.finContrato;
                    
                    todosLosEmpleados.push({
                        _id: idEmpleado,
                        partidaId: partidaId,
                        nombre: nombre,
                        edad: Math.floor(Math.random() * 35) + 35,
                        nacionalidad: nacionalidad,
                        bandera: `${nacionalidad}.png`,
                        tipo: conf.rol,
                        clubActual: club._id,
                        atributos: atributosGenerados,
                        estado: 'libre',
                        paisDestino: null,
                        fechaRegreso: null,
                        salario: salario,
                        finContrato: finContrato,
                    });

                    idsEmpleadosDelClub.push(idEmpleado);
                }
            }

            // Simplificamos el update. La táctica ya se actualizó en generarJugadoresNuevaPartida.
            // Aquí solo inyectamos los empleados generados.
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

        console.log(`Se han añadido ${todosLosEmpleados.length} empleados para partida ${nombrePartida}.`);
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

function generarAtributosPorRol(rol, nivelBase) {
    const variacion = () => Math.floor(Math.random() * 30) - 15;
    const aplicarNivel = (base) => Math.min(100, Math.max(1, base + variacion()));

    // Arrays de opciones para roles tácticos
    const estilosDisponibles = ['TIKI-TAKA', 'CONTRAATAQUE', 'AUTOBÚS', 'BALÓN LARGO', 'PRESIÓN ALTA', 'JUEGO POR BANDAS', 'PONER CENTROS', 'ESTÁNDAR'];
    const mentalidadesDisponibles = ['MUY_DEFENSIVA', 'DEFENSIVA', 'EQUILIBRADA', 'OFENSIVA', 'ULTRA_OFENSIVA'];

    let atr = {
        nivelFisico: 50, nivelTecnico: 50, nivelTactico: 50,
        nivelPortero: 50, nivelPsicologico: 50, nivelMedico: 50,
        nivelRecuperacion: 50, nivelPrevencionLesiones: 50,
        nivelDeteccion: 50, nivelCantera: 50,
        motivacion: nivelBase, desarrolloJovenes: nivelBase, 
        reputacion: nivelBase, experiencia: Math.floor(nivelBase * 0.8),
        // Valores por defecto no perjudiciales para roles no tácticos
        estiloJuego: 'ESTÁNDAR',
        mentalidad: 'EQUILIBRADA'
    };

    // Asignación de Estilo y Mentalidad aleatoria para entrenadores y segundos entrenadores
    if (rol === 'entrenadorPrincipal' || rol === 'segundoEntrenador' || rol === 'entrenadorCantera') {
        atr.estiloJuego = estilosDisponibles[Math.floor(Math.random() * estilosDisponibles.length)];
        atr.mentalidad = mentalidadesDisponibles[Math.floor(Math.random() * mentalidadesDisponibles.length)];
    }

    if (rol.includes('Fisico')) atr.nivelFisico = nivelBase;
    if (rol.includes('Tecnico')) atr.nivelTecnico = nivelBase;
    if (rol.includes('Tactico')) atr.nivelTactico = nivelBase;
    if (rol.includes('Porteros')) atr.nivelPortero = nivelBase;
    if (rol === 'psicologo') atr.nivelPsicologico = nivelBase;
    if (rol === 'medico') { atr.nivelMedico = nivelBase; atr.nivelPrevencionLesiones = nivelBase; }
    if (rol === 'fisio') { atr.nivelRecuperacion = nivelBase; atr.nivelPrevencionLesiones = nivelBase; }
    
    if (rol === 'ojeador') {
        atr.nivelDeteccion = aplicarNivel(nivelBase);
        atr.nivelCantera = aplicarNivel(nivelBase * 0.5); 
    }
    if (rol === 'ojeadorCantera') {
        atr.nivelDeteccion = aplicarNivel(nivelBase * 0.7);
        atr.nivelCantera = aplicarNivel(nivelBase); 
    }
    
    if (rol.includes('entrenador')) { 
        atr.nivelTecnico = nivelBase; 
        atr.nivelTactico = nivelBase; 
    }

    return atr;
};

function calcularSalarioEmpleado(empleado, reputacionClub) {
    const { tipo, atributos } = empleado;
    let nivelEspecifico = 0;

    switch (tipo) {
        case 'entrenadorPrincipal':
        case 'segundoEntrenador':
            nivelEspecifico = (atributos.nivelTecnico + atributos.nivelTactico + atributos.experiencia) / 3;
            break;
        case 'preparadorFisico':
            nivelEspecifico = atributos.nivelFisico;
            break;
        case 'preparadorTecnico':
            nivelEspecifico = atributos.nivelTecnico;
            break;
        case 'preparadorTactico':
            nivelEspecifico = atributos.nivelTactico;
            break;
        case 'preparadorPorteros':
            nivelEspecifico = atributos.nivelPortero;
            break;
        case 'psicologo':
            nivelEspecifico = atributos.nivelPsicologico;
            break;
        case 'medico':
            nivelEspecifico = (atributos.nivelMedico + atributos.nivelPrevencionLesiones) / 2;
            break;
        case 'fisio':
            nivelEspecifico = (atributos.nivelRecuperacion + atributos.nivelPrevencionLesiones) / 2;
            break;
        case 'ojeador':
            nivelEspecifico = atributos.nivelDeteccion;
            break;
        case 'ojeadorCantera':
            nivelEspecifico = (atributos.nivelDeteccion + atributos.nivelCantera) / 2;
            break;
        case 'entrenadorCantera':
            nivelEspecifico = (atributos.desarrolloJovenes + atributos.nivelTecnico) / 2;
            break;
        default:
            nivelEspecifico = 20;
    }

    const multiplicadores = {
        'entrenadorPrincipal': 2.5,
        'segundoEntrenador': 1.6,
        'medico': 1.3,
        'preparadorFisico': 1.1,
        'ojeador': 1.0,
        'ojeadorCantera': 0.85,
        'entrenadorCantera': 1.0
    };

    const multRol = multiplicadores[tipo] || 1.0;
    const reputacion = 0.5 + (atributos.reputacion / 100);
    const potenciaCalidad = Math.pow(nivelEspecifico, 2.1);
    const bonoClub = reputacionClub * 1.8;
    
    let sueldoAnual = (potenciaCalidad + bonoClub) * 12 * multRol * reputacion;

    return Math.max(18000, Math.floor(sueldoAnual / 1000) * 1000);
}

module.exports = {
    generarEmpleadosNuevaPartida,
    calcularSalarioEmpleado
}