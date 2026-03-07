const express = require('express');
const empleadoRouter = express.Router();
const Empleado = require('../models/empleado');
const clubesDAO = require('../daos/clubesDAO');
const empleadosDAO = require('../daos/empleadosDAO');
const partidasDAO = require('../daos/partidasDAO');
const Club = require('../models/club');
const { requireLogin } = require('../middleware/autenticacion');

const grupos = {
    "Preparadores": ['preparadorFisico', 'preparadorTecnico', 'preparadorTactico', 'preparadorPorteros'],
    "Médicos y Salud": ['psicologo', 'medico', 'fisio'],
    "Ojeadores": ['ojeador'],
    "Cantera": ['ojeadorCantera', 'entrenadorCantera'],
    "Equipo Técnico": ['entrenadorPrincipal', 'segundoEntrenador']
};

empleadoRouter.post('/empleados', async (req, res) => {
  try {
    const empleado = new Empleado(req.body);
    const guardado = await empleado.save();
    res.json(guardado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

empleadoRouter.get('/empleados', async (req, res) => {
  try {
    const empleados = await Empleado.find();
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

empleadoRouter.get('/buscarEmpleado/:id', async (req, res) => {
  try {
    const empleado = await Empleado.findById(req.params.id);
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(empleado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

empleadoRouter.get('/empleados/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        
        const filtros = {
            nombre: req.query.nombre,
            estado: req.query.estado,
            clubActual: partida.clubSeleccionado,
            atributos: {}
        };

        if (req.query.estado === 'libre') delete filtros.clubActual;

        const empleados = await empleadosDAO.buscarEmpleados(filtros);

        res.render('empleados', {
            empleados,
            grupos,
            partida
        });
    } catch (err) {
        res.status(500).send("Error al cargar los empleados");
    }
});

empleadoRouter.get('/buscar', async (req, res) => {
    const filtros = {
        nombre: req.query.nombre,
        clubActual: req.query.club,
        estado: req.query.estado,
        atributos: {
            nivelFisico: req.query.minFisico, 
            nivelTecnico: req.query.minTecnico
        }
    };
    
    if (!filtros.atributos.nivelFisico) delete filtros.atributos.nivelFisico;
    
    const empleados = await empleadosDAO.buscarEmpleados(filtros);
    res.json(empleados);
});

empleadoRouter.get('/empleado/atributos/:id', async (req, res) => {
    const emp = await empleadosDAO.buscarEmpleadoPorId(req.params.id);
    res.json({ atributos: emp.atributos });
});

empleadoRouter.post('/empleados/despedir/:id', async (req, res) => {
    await empleadosDAO.eliminarEmpleado(req.params.id);
    res.status(200).send('Empleado despedido');
});

// Ruta para mandar a misión
empleadoRouter.post('/ojeador/enviar-ojeador', requireLogin, async (req, res) => {
  try {
        const { ojeadorId, pais, meses } = req.body;
        const ojeador = await empleadosDAO.buscarEmpleadoPorId(ojeadorId);
        const club = await clubesDAO.buscarClubPorId(ojeador.clubActual);
        const partida = await partidasDAO.obtenerPartidaPorId(club.partidaId);

        const costePorMes = 35000; 
        const costeTotal = costePorMes * meses;
      
        if (club.presupuestoTraspasos < costeTotal) {
            return res.status(400).json({ success: false, message: "Fondos insuficientes" });
        }

        const fechaRegreso = new Date(partida.fechaActual);
        fechaRegreso.setMonth(fechaRegreso.getMonth() + parseInt(meses));

        await empleadosDAO.actualizarEmpleado(ojeadorId, {
            estado: 'enMision',
            paisDestino: pais,
            fechaRegreso: fechaRegreso,
            fechaInicioMision: partida.fechaActual
        });

        await clubesDAO.modificarPresupuesto(club._id, -costeTotal);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error interno" });
    }
});


// Ruta para ver el informe
empleadoRouter.get('/ojeador/informe/:ojeadorId', requireLogin, async (req, res) => {
    try {
        const ojeador = await Empleado.findById(req.params.ojeadorId);
        const jugadoresEncontrados = await Jugador.find({ 
            informeOrigen: ojeador._id 
        });

        res.render('informe-cantera', { 
            ojeador, 
            jugadores: jugadoresEncontrados 
        });
    } catch (err) {
        res.status(500).send("Error al cargar el informe");
    }
});

// Ruta para cancelar misión
empleadoRouter.post('/ojeador/cancelar', requireLogin, async (req, res) => {
    try {
        const { ojeadorId } = req.body;
        await Empleado.findByIdAndUpdate(ojeadorId, { 
            estado: 'libre', 
            paisDestino: null, 
            fechaRegreso: null 
        });
        res.json({ success: true, message: "Misión cancelada" });
    } catch (err) {
        res.status(500).json({ success: false, error: "No se pudo cancelar" });
    }
});


module.exports = empleadoRouter;
