const express = require('express');
const clubRouter = express.Router();
const partidasDAO = require('../daos/partidasDAO');
const clubesDAO = require('../daos/clubesDAO');
const competicionesDAO = require('../daos/competicionesDAO');
const Partida = require('../models/partida');
const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Empleado = require('../models/empleado');
const Competicion = require('../models/competicion');
const Negociacion = require('../models/negociacion');
const { requireLogin } = require('../middleware/autenticacion');
const { FORMACIONES } = require('../service/cargarFormaciones');

const ORDEN_POSICIONES = { 
    'POR': 1, 
    'LD': 2, 'LI': 2, 'DFC': 3,
    'MCD': 4, 'MC': 5, 'MI': 6, 'MD': 6, 'MCO': 7,
    'ED': 8, 'EI': 8, 'SD': 9, 'DC': 10 
};

clubRouter.post('/clubes', async (req, res) => {
  try {
    if (req.body.esFilial && !req.body.clubMatriz) {
      return res.status(400).json({ error: 'Club filial sin club matriz' });
    }
    const nuevoClub = await clubesDAO.crearClub(req.body);
    res.json(nuevoClub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

clubRouter.get('/clubes', async (req, res) => {
  const clubes = await clubesDAO.listarClubes();
  res.json(clubes);
});

clubRouter.get('/buscarClub/:id', async (req, res) => {
  const club = await clubesDAO.buscarClubPorId(req.params.id);
  res.json(club);
});

clubRouter.get('/formacion/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        if (!partida) {
          return res.redirect('/');
        }

        const clubUsuario = await clubesDAO.buscarClubPorId(partida.clubSeleccionado);
        const filial = await clubesDAO.buscarFilialPorId(clubUsuario._id);

        let porteros = clubUsuario.plantilla.filter(j => j.posicionPrincipal === 'POR');
        let resto = clubUsuario.plantilla.filter(j => j.posicionPrincipal !== 'POR');

        porteros.sort((a, b) => b.media - a.media);
        resto.sort((a, b) => b.media - a.media);

        let titulares = [porteros[0], ...resto.slice(0, 10)];
        let demas = [...porteros.slice(1), ...resto.slice(10)];

        demas.sort((a, b) => (ORDEN_POSICIONES[a.posicionPrincipal] || 99) - (ORDEN_POSICIONES[b.posicionPrincipal] || 99));
        titulares.sort((a, b) => (ORDEN_POSICIONES[a.posicionPrincipal] || 99) - (ORDEN_POSICIONES[b.posicionPrincipal] || 99));

        clubUsuario.plantilla = [...titulares, ...demas];

        res.render('formacion', {
            partida,
            clubUsuario,
            filial,
            formaciones: FORMACIONES
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al cargar la formación");
    }
});

clubRouter.post('/guardarAlineacion/:clubId', requireLogin, async (req, res) => {
    try {
        const { nuevaPlantilla, formacion } = req.body;
        
        // Actualizamos la plantilla, la formación y repartimos a los jugadores 
        // en titulares, suplentes y reservas automáticamente
        await Club.findByIdAndUpdate(req.params.clubId, {
            $set: {
                plantilla: nuevaPlantilla,
                "tactica.formacion": formacion,
                "tactica.titulares": nuevaPlantilla.slice(0, 11),
                "tactica.suplentes": nuevaPlantilla.slice(11, 24),
                "tactica.reservas": nuevaPlantilla.slice(24)
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Error al guardar alineación y formación:", err);
        res.status(500).json({ error: "No se pudo guardar la estrategia" });
    }
});

clubRouter.post('/actualizarRoles/:clubId', requireLogin, async (req, res) => {
    try {
        await clubesDAO.actualizarRolesTacticos(req.params.clubId, req.body);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al actualizar roles" });
    }
});

clubRouter.post('/subirCanterano/:jugadorId', requireLogin, async (req, res) => {
    try {
        const { jugadorId } = req.params;
        const filial = await Club.findOne({ plantilla: jugadorId });
        
        if (!filial) return res.status(404).json({ error: "Jugador no encontrado" });

        await clubesDAO.convocarCanterano(filial.clubMatriz, jugadorId);
      //falta la logica para subirlo para siempre
        res.json({ success: true, mensaje: "Convocado para el próximo partido" });
    } catch (err) {
        res.status(500).json({ error: "Error al convocar" });
    }
});

clubRouter.get('/plantilla/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        const clubUsuario = await Club.findById(partida.clubSeleccionado).populate('plantilla');
        
        clubUsuario.plantilla.sort((a, b) => (ORDEN_POSICIONES[a.posicionPrincipal] || 99) - (ORDEN_POSICIONES[b.posicionPrincipal] || 99));

        res.render('plantilla', {
            partida,
            clubUsuario,
            jugadores: clubUsuario.plantilla
        });
    } catch (err) {
        res.status(500).send("Error al cargar la plantilla");
    }
});

clubRouter.get('/club/dorsales-ocupados', requireLogin, async (req, res) => {
    try {
        const idDelClub = req.query.clubId;
        const jugadores = await Jugador.find({ clubActual: idDelClub });
        
        const ocupados = {};
        jugadores.forEach(j => {
            if (j.dorsal) {
                ocupados[String(j.dorsal)] = j.nombre;
            }
        });

        res.json({ ocupados });
    } catch (err) {
        console.error("Error en servidor:", err);
        res.status(500).json({ ocupados: {}, error: err.message });
    }
});

clubRouter.get('/cantera/:partidaId', requireLogin, async (req, res) => {
    try {
        const partida = await partidasDAO.obtenerPartidaPorId(req.params.partidaId);
        
        const clubUsuario = await Club.findById(partida.clubSeleccionado)
            .populate('empleados');

        const clubFilial = await Club.findOne({ 
            partidaId: req.params.partidaId,
            clubMatriz: clubUsuario._id,
            esFilial: true 
        }).populate('plantilla');

        const ojeadoresCantera = clubUsuario.empleados.filter(emp => 
            emp.tipo === 'ojeadorCantera' 
        );

        let jugadoresFilial = [];
        if (clubFilial && clubFilial.plantilla) {
            jugadoresFilial = clubFilial.plantilla.sort((a, b) => 
                (ORDEN_POSICIONES[a.posicionPrincipal] || 99) - (ORDEN_POSICIONES[b.posicionPrincipal] || 99)
            );
        }
        res.render('cantera', {
            partida,
            clubUsuario,
            clubFilial, 
            jugadoresFilial,
            ojeadores: ojeadoresCantera
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error al cargar la gestión de cantera");
    }
});

clubRouter.get('/traspasos/:partidaId', requireLogin, async (req, res) => {
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
            path: 'listaObjetivos',
            populate: { path: 'clubActual', select: 'nombre escudo' }
        });

        const negociacionesActivas = await Negociacion.find({
            clubEmisor: partida.clubSeleccionado,
            finalizada: false
        }).lean();

        const listaConEstado = clubUsuario.listaObjetivos.map(obj => {
            const objetivo = obj.toObject(); 
            objetivo.negociacionActiva = negociacionesActivas.find(n => 
                n.objetivoId.toString() === objetivo._id.toString()
            );
            return objetivo;
        });

        const ojeadores = clubUsuario.empleados.filter(emp => emp.tipo === 'ojeador');

        res.render('traspasos', {
            partida,
            clubUsuario,
            ojeadores: ojeadores,
            ligas: ligas,  
            clubes: clubes,
            listaObjetivos: listaConEstado,
            errorFiltros: null
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error al cargar el centro de traspasos");
    }
});
clubRouter.get('/negociaciones/:partidaId', requireLogin, async (req, res) => {
   try {
        const { partidaId } = req.params;
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado').lean();
        const miClubId = partida.clubSeleccionado._id;
        const ofertasEnviadas = await Negociacion.find({ partidaId, clubEmisor: miClubId })
        .populate('objetivoId') 
        .populate('clubReceptor')
        .sort({ ultimaModificacion: -1 })
        .lean();

        const ofertasRecibidas = await Negociacion.find({ partidaId, clubReceptor: miClubId, clubEmisor: { $ne: miClubId } })
        .populate('objetivoId')
        .populate('clubEmisor')
        .sort({ ultimaModificacion: -1 })
        .lean();

        res.render('negociaciones', {
            partida,
            miClub: partida.clubSeleccionado,
            ofertasEnviadas,
            ofertasRecibidas
        });

    } catch (error) {
        console.error("Error en vista negociaciones:", error);
        res.status(500).send("Error interno");
    }
});

const esRangoValido = (valorMin, valorMax, min, max) => {
    if (valorMin > valorMax) return false;
    if (valorMin < min) return false;
    if (valorMax > max) return false;
    return true;
}
// búsqueda manual traspasos
clubRouter.get('/traspasos/buscar/:partidaId', requireLogin, async (req, res) => {
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
            path: 'listaObjetivos',
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
        if (filtros.posicion) mongoQuery.posicionPrincipal = filtros.posicion;
        if (filtros.estado) mongoQuery.estadoMercado = filtros.estado;
        
        
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
                return res.render('traspasos', {
                    partida,
                    clubUsuario,
                    ojeadores: ojeadores,
                    ligas: ligas,  
                    clubes: clubes,
                    listaObjetivos: clubUsuario.listaObjetivos,
                    errorFiltros: 'El valor introducido esta fuera del rango'
                });   
             }
        }

        if (filtros.valorMin || filtros.valorMax) {
            mongoQuery.valorMercado = {};
            const valorMin = filtros.valorMin ? parseInt(filtros.valorMin) : 0;
            const valorMax = filtros.valorMax ? parseInt(filtros.valorMax) : 1000000000;
            const esValido = esRangoValido(valorMin, valorMax, 0, 1000000000)
            if (esValido) {
                if (filtros.valorMin) mongoQuery.valorMercado.$gte = valorMin;
                if (filtros.valorMax) mongoQuery.valorMercado.$lte = valorMax;
            }
            else{
                return res.render('traspasos', {
                    partida,
                    clubUsuario,
                    ojeadores: ojeadores,
                    ligas: ligas,  
                    clubes: clubes,
                    listaObjetivos: clubUsuario.listaObjetivos,
                    errorFiltros: 'El valor introducido esta fuera del rango'
                });   
             }
        }

        const mapaAtributos = [
            // Habilidad
            ['reg', 'atributos.habilidad.regate'],
            ['contBal', 'atributos.habilidad.controlBalon'],
            ['des', 'atributos.habilidad.desmarques'],
            // Tiro
            ['def', 'atributos.tiro.definicion'],
            ['potTir', 'atributos.tiro.potenciaTiro'],
            ['tirLej', 'atributos.tiro.tiroLejano'],
            ['fal', 'atributos.tiro.lanzamientoFaltas'],
            ['pen', 'atributos.tiro.lanzamientoPenaltis'],
            ['remCa', 'atributos.tiro.remateCabeza'],
            // Pase
            ['pasCor', 'atributos.pase.paseCorto'],
            ['pasLar', 'atributos.pase.paseLargo'],
            ['vis', 'atributos.pase.vision'],
            ['cen', 'atributos.pase.centros'],
            // Defensa
            ['mar', 'atributos.defensa.marcaje'],
            ['ent', 'atributos.defensa.entradas'],
            ['int', 'atributos.defensa.intercepciones'],
            ['desp', 'atributos.defensa.despejes'],
            ['dueAr', 'atributos.defensa.duelosAereos'],
            ['col', 'atributos.defensa.colocacion'],
            // Fisico
            ['vel', 'atributos.fisico.velocidad'],
            ['ace', 'atributos.fisico.aceleracion'],
            ['agi', 'atributos.fisico.agilidad'],
            ['fue', 'atributos.fisico.fuerza'],
            ['res', 'atributos.fisico.resistencia'],
            ['equi', 'atributos.fisico.equilibrio'],
            ['salt', 'atributos.fisico.salto'],
            // Mental
            ['conc', 'atributos.mental.concentracion'],
            ['lid', 'atributos.mental.liderazgo'],
            ['agre', 'atributos.mental.agresividad'],
            ['mot', 'atributos.mental.motivacion'],
            ['compBaPre', 'atributos.mental.composturaBajoPresion'],
            // Portero
            ['ref', 'atributos.portero.reflejos'],
            ['para', 'atributos.portero.paradas'],
            ['est', 'atributos.portero.estirada'],
            ['jueAr', 'atributos.portero.juegoAereo'],
            ['unoVSuno', 'atributos.portero.unoContraUno'],
            ['bloc', 'atributos.portero.blocaje'],
            ['saq', 'atributos.portero.saque'],
            ['comu', 'atributos.portero.comunicacion'],
            ['penal', 'atributos.portero.penales']
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
                    return res.render('traspasos', {
                        partida,
                        clubUsuario,
                        ojeadores: ojeadores,
                        ligas: ligas,  
                        clubes: clubes,
                        listaObjetivos: clubUsuario.listaObjetivos,
                        errorFiltros: 'El valor introducido esta fuera del rango'
                    });   
                }
            }
        }

        const jugadoresEncontrados = await Jugador.find(mongoQuery)
            .populate('clubActual');

        res.render('resultados-busqueda', {
            jugadores: jugadoresEncontrados,
            partida,
            clubUsuario: await Club.findById(partida.clubSeleccionado)
        });

    } catch (err) {
        res.status(500).send("Error en la búsqueda");
    }
});
clubRouter.post('/listaObjetivos/aniadir/:tipo/:id', async (req, res) => {
    try {
        const esEmpleado = (req.params.tipo === 'empleado') ? Empleado : Jugador;
        const esListaEmpleados = (req.params.tipo === 'empleado') ? 'listaObjetivosEmpleados' : 'listaObjetivos';
        
        const entidad = await esEmpleado.findById(req.params.id);
        const partida = await partidasDAO.obtenerPartidaPorId(entidad.partidaId);
        const clubSeleccionado = await clubesDAO.buscarClubPorId(partida.clubSeleccionado);
        
        await clubesDAO.actualizarClub(clubSeleccionado, {
            $addToSet: { [esListaEmpleados]: entidad._id }
        });

        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});
clubRouter.post('/listaObjetivos/quitar/:tipo/:id', async (req, res) => {
    try {
        const esEmpleado = (req.params.tipo === 'empleado') ? Empleado : Jugador;
        const esListaEmpleados = (req.params.tipo === 'empleado') ? 'listaObjetivosEmpleados' : 'listaObjetivos';
        
        const entidad = await esEmpleado.findById(req.params.id);
        const partida = await partidasDAO.obtenerPartidaPorId(entidad.partidaId);
        const clubSeleccionado = await clubesDAO.buscarClubPorId(partida.clubSeleccionado);
        
        await clubesDAO.actualizarClub(clubSeleccionado, {
            $pull: { [esListaEmpleados]: entidad._id }
        });

        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

clubRouter.get('/objetivo/detalleTraspaso/:id', requireLogin, async (req, res) => {
    try {
        const { id } = req.params;

        let objetivo = await Jugador.findById(id).populate('clubActual').lean();
        let tipo = 'jugador';

        if (!objetivo) {
            objetivo = await Empleado.findById(id).populate('clubActual').lean();
            tipo = 'empleado';
        }

        if (!objetivo) {
            return res.status(404).json({ success: false, message: "No se encontró el perfil" });
        }

        const partida = await Partida.findById(objetivo.partidaId)
                                           .populate('clubSeleccionado')
                                           .lean();
        const miClubId = partida.clubSeleccionado._id;
        const negActiva = await Negociacion.findOne({ 
            objetivoId: id, 
            clubEmisor: miClubId, 
            finalizada: false 
        }).lean();
        const precioAceptado = negActiva && negActiva.basicoAceptado === true;
        const precioContratoAceptado = negActiva && negActiva.basicoContratoAceptado === true;
        res.json({
            success: true,
            tipo: tipo,
            objetivo: objetivo,
            clubObjetivo: objetivo.clubActual || null,
            miClub: partida.clubSeleccionado,
            fechaActual: partida.fechaActual,
            basicoAceptado: precioAceptado, 
            basicoContratoAceptado: precioContratoAceptado, 
            ofertaPrevia: negActiva
        });

    } catch (error) {
        console.error("Error en detalleTraspaso:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

clubRouter.get('/objetivo/detalleOfertaRecibida/:negociacionId', requireLogin, async (req, res) => {
    try {
        const { negociacionId } = req.params;

        const neg = await Negociacion.findById(negociacionId)
            .populate('objetivoId')
            .populate('clubEmisor')
            .lean();

        if (!neg) {
            return res.status(404).json({ success: false, message: "No se encontró la negociación" });
        }

        const partida = await Partida.findById(neg.partidaId)
            .populate('clubSeleccionado')
            .lean();

        res.json({
            success: true,
            negociacion: neg, 
            objetivo: neg.objetivoId, 
            clubEmisor: neg.clubEmisor,
            miClub: partida.clubSeleccionado,
            fechaActual: partida.fechaActual
        });

    } catch (error) {
        console.error("Error en detalleOfertaRecibida:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});


module.exports = clubRouter;