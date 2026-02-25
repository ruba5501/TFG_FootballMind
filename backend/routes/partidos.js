const express = require('express');
const calendarioRouter = express.Router();
const Partida = require('../models/partida');
const Partido = require('../models/partido');
const { requireLogin } = require('../middleware/autenticacion');

calendarioRouter.get('/calendario/:id', requireLogin, async (req, res) => {
    try {
        const partida = await Partida.findById(req.params.id).populate('clubSeleccionado');

        const fechaReferencia = partida.fechaActual || new Date(2025, 6, 1);
        let mes = req.query.mes !== undefined ? parseInt(req.query.mes) : fechaReferencia.getMonth();
        let anio = req.query.anio !== undefined ? parseInt(req.query.anio) : fechaReferencia.getFullYear();
        const primerDiaFecha = new Date(anio, mes, 1);
        const primerDiaSemana = primerDiaFecha.getDay();

        const offset = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;
        const diasEnMes = new Date(anio, mes + 1, 0).getDate();

        const inicioMes = new Date(anio, mes, 1);
        const finMes = new Date(anio, mes, diasEnMes, 23, 59, 59);

        const partidosMes = await Partido.find({
            partidaId: partida._id,
            fecha: { $gte: inicioMes, $lte: finMes },
            $or: [
                { equipoLocal: partida.clubSeleccionado._id },
                { equipoVisitante: partida.clubSeleccionado._id }
            ]
        }).populate('equipoLocal equipoVisitante competicionId');

        const proximoPartido = await Partido.findOne({
            partidaId: partida._id,
            jugado: false, 
            fecha: { $gte: partida.fechaActual },
            $or: [
                { equipoLocal: partida.clubSeleccionado._id },
                { equipoVisitante: partida.clubSeleccionado._id }
            ]
        })
        .sort({ fecha: 1 })
        .populate('equipoLocal equipoVisitante competicionId');

        res.render('calendario', {
            partida,
            clubUsuario: partida.clubSeleccionado,
            partidos: partidosMes,
            proximoPartido: proximoPartido,
            calendario: {
                mes,
                anio,
                offset,
                diasEnMes,
                nombreMes: inicioMes.toLocaleString('es-ES', { month: 'long' })
            }
        });
    } catch (err) {
        res.status(500).send("Error al cargar el calendario");
    }
});

module.exports = calendarioRouter;