const express = require('express');
const empleadoRouter = express.Router();
const Empleado = require('../models/empleado');
const clubesDAO = require('../daos/clubesDAO');
const empleadosDAO = require('../daos/empleadosDAO');
const partidasDAO = require('../daos/partidasDAO');
const Club = require('../models/club');
const Competicion = require('../models/competicion');
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
        const ligas = await Competicion.find({ 
            tipo: 'liga',
            partidaId: partida._id,
        }).select('nombre').lean();
        const filial = await Club.findOne({ clubMatriz: partida.clubSeleccionado }).select('_id');
        const clubes = await Club.find({
            _id: { 
                $ne: partida.clubSeleccionado,
                $not: { $eq: filial ? filial._id : null }
            },
            partidaId: partida._id,
        }).lean();
        const clubUsuario = await Club.findById(partida.clubSeleccionado).populate('empleados').populate({
            path: 'listaObjetivosEmpleados',
            populate: { path: 'clubActual', select: 'nombre escudo' }
        });
        const filtros = {
            nombre: req.query.nombre,
            estado: req.query.estado,
            clubActual: partida.clubSeleccionado,
            atributos: {}
        };

        if (req.query.estado === 'libre') delete filtros.clubActual;

        const empleados = await empleadosDAO.buscarEmpleados(filtros);

        res.render('empleados', {
            partida,
            empleados,
            grupos,
            ligas: ligas,  
            clubes: clubes,
            listaObjetivos: clubUsuario.listaObjetivosEmpleados,
            errorFiltros: null
        });
    } catch (err) {
        res.status(500).send("Error al cargar los empleados");
    }
});

const esRangoValido = (valorMin, valorMax, min, max) => {
    if (valorMin > valorMax) return false;
    if (valorMin < min) return false;
    if (valorMax > max) return false;
    return true;
}

empleadoRouter.get('/empleados/buscar/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        const filtros = req.query;
        const ligas = await Competicion.find({ 
            tipo: 'liga',
            partidaId: partida._id,
        }).select('nombre').lean();
        const filial = await Club.findOne({ clubMatriz: partida.clubSeleccionado }).select('_id');
        const clubes = await Club.find({
            _id: { 
                $ne: partida.clubSeleccionado,
                $not: { $eq: filial ? filial._id : null }
            },
            partidaId: partida._id,
        }).lean();
        const clubUsuario = await Club.findById(partida.clubSeleccionado).populate('empleados').populate({
            path: 'listaObjetivosEmpleados',
            populate: { path: 'clubActual', select: 'nombre escudo' }
        });
        const ojeadores = clubUsuario.empleados.filter(emp => 
            emp.tipo === 'ojeador' 
        );
        

        let mongoQuery = { 
            partidaId: req.params.partidaId,
            clubActual: { 
                $ne: partida.clubSeleccionado,
                $not: { $eq: filial ? filial._id : null }
            }
        };

        if (filtros.query) mongoQuery.nombre = { $regex: filtros.query, $options: 'i' };
        
        if (filtros.clubId && filtros.clubId !== "") {
            mongoQuery.clubActual = filtros.clubId;
        }
        else if (filtros.liga && filtros.liga !== "") {
            const clubesEnLiga = await Club.find({ 
                competiciones: filtros.liga,
                _id: { 
                    $ne: partida.clubSeleccionado, 
                    $not: { $eq: filial ? filial._id : null }
                }
            }).select('_id').lean();
            const idsClubes = clubesEnLiga.map(c => c._id);
            
            mongoQuery.clubActual = { $in: idsClubes };
        }
        if (filtros.cargo) mongoQuery.tipo = filtros.cargo;
        if (filtros.estado) mongoQuery.estado = filtros.estado;
        
        
        if (filtros.edadMin || filtros.edadMax) {
            mongoQuery.edad = {};
            const valorMin = filtros.edadMin ? parseInt(filtros.edadMin) : 0;
            const valorMax = filtros.edadMax ? parseInt(filtros.edadMax) : 100;
            const esValido = esRangoValido(valorMin, valorMax, 0, 100)
            if (esValido) {
                if (filtros.edadMin) mongoQuery.edad.$gte = valorMin;
                if (filtros.edadMax) mongoQuery.edad.$lte = valorMax;
            }
            else{
                return res.render('empleados', {
                    partida,
                    clubUsuario,
                    ojeadores: ojeadores,
                    ligas: ligas,  
                    clubes: clubes,
                    listaObjetivos: clubUsuario.listaObjetivosEmpleados,
                    errorFiltros: 'El valor introducido esta fuera del rango'
                });   
             }
        }

        const mapaAtributos = [
            ['nivFis', 'atributos.nivelFisico'],
            ['nivTec', 'atributos.nivelTecnico'],
            ['nivTac', 'atributos.nivelTactico'],
            ['nivPor', 'atributos.nivelPortero'],
            ['nivPsi', 'atributos.nivelPsicologico'],
            ['nivMed', 'atributos.nivelMedico'],
            ['nivRec', 'atributos.nivelRecuperacion'],
            ['nivPrevLes', 'atributos.nivelPrevencionLesiones'],
            ['nivDet', 'atributos.nivelDeteccion'],
            ['nivCan', 'atributos.nivelCantera'],
            ['nivMot', 'atributos.motivacion'],
            ['nivDesJov', 'atributos.desarrolloJovenes'],
            ['nivRep', 'atributos.reputacion'],
            ['nivExp', 'atributos.experiencia']
        ];

        for (const [prefijo, rutaDB] of mapaAtributos) {
            const minVal = filtros[`${prefijo}Min`];
            const maxVal = filtros[`${prefijo}Max`];

            if (minVal || maxVal) {
                mongoQuery[rutaDB] = {};
                const valorMin = minVal ? minVal : 0;
                const valorMax = maxVal ? maxVal : 99;
                const esValido = esRangoValido(valorMin, valorMax, 0, 99)
                if (esValido) {
                    if (minVal) mongoQuery[rutaDB].$gte = valorMin;
                    if (maxVal) mongoQuery[rutaDB].$lte = valorMax;
                }
                else{
                    return res.render('empleados', {
                        partida,
                        clubUsuario,
                        ojeadores: ojeadores,
                        ligas: ligas,  
                        clubes: clubes,
                        listaObjetivos: clubUsuario.listaObjetivosEmpleados,
                        errorFiltros: 'El valor introducido esta fuera del rango'
                    });   
                }
            }
        }

        const empleadosEncontrados = await Empleado.find(mongoQuery)
            .populate('clubActual');

        res.render('resultadosBusquedaEmpleados', {
            empleados: empleadosEncontrados,
            partida,
            clubUsuario: await Club.findById(partida.clubSeleccionado)
        });

    } catch (err) {
        res.status(500).send("Error en la búsqueda");
    }
});
empleadoRouter.get('/empleado/detalle/:empleadoId', requireLogin, async (req, res) => {
    try {
        const empleado = await empleadosDAO.buscarEmpleadoPorId(req.params.empleadoId);   
        const club = await clubesDAO.buscarClubPorId(empleado.clubActual);
        const partida = await partidasDAO.obtenerPartidaPorId(empleado.partidaId);
        const clubSeleccionado = await clubesDAO.buscarClubPorId(partida.clubSeleccionado);     
        const estaEnListaObjetivos = clubSeleccionado.listaObjetivosEmpleados.some(objId => 
            objId.equals(empleado._id)
        ); 
        res.render('partials/detalleEmpleado', { 
            empleado,
            layout: false,
            club,
            clubSeleccionado,
            estaEnListaObjetivos
        });
    } catch (err) {
        res.status(500).send("Error al obtener detalles");
    }
});

empleadoRouter.get('/empleado/atributos/:id', async (req, res) => {
    try {
        const empleado = await empleadosDAO.buscarEmpleadoPorId(req.params.id);        
        res.render('partials/atributosEmpleado', { empleado: empleado });
    } catch (error) {
        res.status(500).send("Error");
    }
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
