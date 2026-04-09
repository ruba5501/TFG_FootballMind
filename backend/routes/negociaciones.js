const express = require('express');
const negociacionRouter = express.Router();
const partidasDAO = require('../daos/partidasDAO');
const clubesDAO = require('../daos/clubesDAO');
const competicionesDAO = require('../daos/competicionesDAO');
const Partida = require('../models/partida');
const Club = require('../models/club');
const Jugador = require('../models/jugador');
const Empleado = require('../models/empleado');
const Competicion = require('../models/competicion');
const Negociacion = require('../models/negociacion');

function calcularPrecioMinimo(jugador, clubVendedor, ofertaDetalles, fechaActualPartida) {
    let factor = 1.0;
    //rol del jugador en el equipos
    if (jugador.rolEquipo === 'clave') factor += 0.4;
    if (jugador.rolEquipo === 'titular') factor += 0.2;
    if (jugador.rolEquipo === 'reserva') factor -= 0.1;
    if (jugador.rolEquipo === 'reserva') factor -= 0.25;
    if (jugador.rolEquipo === 'promesa') factor += 0.1;

    // tiempo de contrato
    const hoy = new Date(fechaActualPartida);
    const fin = new Date(jugador.finContrato);
    const mesesRestantes = (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth());

    if (mesesRestantes <= 6) factor -= 0.4;      
    else if (mesesRestantes <= 12) factor -= 0.25; 
    else if (mesesRestantes <= 24) factor -= 0.15; 
    else if (mesesRestantes > 36) factor += 0.15;

    // reputacion del club vendedor
    if (clubVendedor.reputacion > 85) factor += 0.2;

    //si el jugador esta interesado en salir reduciria el precio de venta
    if (ofertaDetalles.interesJugador > 80) {
        const presion = (ofertaDetalles.interesJugador - 80) * 0.01;
        factor -= presion;
    }

    let precioMinimo = jugador.valorMercado * factor;

    // si se añaden clausulas a la oferta
    // clausula futura venta, cada 1% baja el precio en un 0.5%
    if (ofertaDetalles.futuraVenta > 0) {
        precioMinimo -= (precioMinimo * (ofertaDetalles.futuraVenta * 0.005));
    }
    // clausula recompra barata, el club vendedor pide menos
    if (ofertaDetalles.precioRecompra > 0 && ofertaDetalles.precioRecompra < jugador.valorMercado * 1.5) {
        precioMinimo *= 0.9; 
    }

    return Math.max(precioMinimo, jugador.valorMercado * 0.8);
}

function calcularPretensiones(sujeto, esEmpleado) {
    let multiplicadorSueldo = 1.1; // Por defecto pide un 10% más de lo que vale

    // Si es un jugador top o empleado con mucha media, pide más
    if (sujeto.valoracion > 85) multiplicadorSueldo += 0.3;
    
    // Si acaba contrato pronto, tiene menos fuerza para negociar (pide menos)
    if (sujeto.añosContrato < 1) multiplicadorSueldo -= 0.1;

    const sueldoEsperado = (sujeto.salario || 50000) * multiplicadorSueldo;
    const aniosEsperados = sujeto.edad > 32 ? 1 : 3; // Veteranos piden menos años

    return { sueldoEsperado, aniosEsperados };
}

negociacionRouter.post('/fichajes/ofertaTraspaso/:jugadorId', async (req, res) => {
    try {
        const { oferta } = req.body; 
        const jugador = await Jugador.findById(req.params.jugadorId).populate('clubActual');
        const partida = await partidasDAO.obtenerPartidaPorId(jugador.partidaId);
        const miClubId = partida.clubSeleccionado._id;

        const negPrevia = await Negociacion.findOne({ 
            objetivoId: jugador._id, 
            clubEmisor: miClubId, 
            finalizada: false 
        });

        let rondas = negPrevia ? (negPrevia.rondas || 0) + 1 : 1;
        const limiteNegociaciones = 5;

        let estado = 'pendiente';
        let mensaje = "";
        let contraOferta = 0;

        if (rondas > limiteNegociaciones) {
            estado = 'rechazado';
            mensaje = "Se nos ha agotado la paciencia. Habéis enviado demasiadas ofertas insuficientes y nos retiramos de la negociación.";
        }
        else if (oferta.tipo === 'traspaso') {
            const precioMinimo = calcularPrecioMinimo(jugador, jugador.clubActual, oferta, partida.fechaActual);
            const dineroOfrecido = oferta.precio;

            if (dineroOfrecido >= precioMinimo) {
                estado = 'aceptado';
                mensaje = "El club acepta las condiciones. Tienes permiso para hablar con el jugador.";
            } else if (dineroOfrecido >= precioMinimo * 0.5) {
                estado = 'negociando';
                const factorAleatorio = 1.08 + (Math.random() * 0.06);
                const negPrevia = await Negociacion.findOne({ objetivoId: jugador._id, clubEmisor: miClubId, finalizada: false });
                
                let pretensionNuevas = precioMinimo * factorAleatorio;

                if (negPrevia && negPrevia.estadoTraspaso === 'negociando') {
                    pretensionNuevas = Math.max(precioMinimo, negPrevia.ofertaTraspaso * 0.95);
                    mensaje = "Hemos reconsiderado nuestra postura, pero aún esperamos una oferta mejor.";
                } else {
                    mensaje = "Vuestra oferta no es suficiente, pero estamos dispuestos a escuchar otra propuesta.";
                }

                contraOferta = Math.floor(pretensionNuevas);
            } else {
                estado = 'rechazado';
                mensaje = "No estamos interesados en vender al jugador por esa cantidad.";
            }
        } 
        if (oferta.tipo === 'cesion') {
            const porcentajeOfrecido = oferta.precio; 
            const porcentajeMinimo = 0;
            if (jugador.rolEquipo === 'suplente')porcentajeMinimo = 50;
            else if (jugador.rolEquipo === 'reserva')porcentajeMinimo = 40;
            else if (jugador.rolEquipo === 'promesa')porcentajeMinimo = 30;

            if (jugador.rolEquipo != 'clave' && jugador.rolEquipo != 'importante'){
                if (porcentajeOfrecido >= porcentajeMinimo) {
                    estado = 'aceptado';
                    mensaje = "Cesión aceptada.";
                } else if (porcentajeOfrecido >= porcentajeMinimo - 20) {
                    estado = 'negociando';
                    contraOferta = porcentajeMinimo;
                    mensaje = "El club pide que cubráis más porcentaje del sueldo.";
                } else {
                    estado = 'rechazado';
                    mensaje = "No nos interesa ceder al jugador en esas condiciones.";
                }
            }
            else{
                estado = 'rechazado';
                mensaje = "No nos interesa ceder a este jugador.";
            }
            
        }

        await Negociacion.findOneAndUpdate(
            { objetivoId: jugador._id, clubEmisor: miClubId, finalizada: false },
            {
                partidaId: partida._id,
                tipoObjetivo: 'Jugador',
                objetivoId: jugador._id,
                clubEmisor: miClubId,
                clubReceptor: jugador.clubActual._id,
                estadoTraspaso: estado,
                tipoOferta: oferta.tipo,
                rondas: rondas,
                ofertaTraspaso: contraOferta > 0 ? contraOferta : (oferta.precio || 0),
                porcentajeFuturaVenta: oferta.futuraVenta || 0,
                precioRecompra: oferta.precioRecompra || 0,
                clausulaCompra: oferta.clausulaCompra || 0,
                ultimaModificacion: Date.now()
            },
            { upsert: true }
        );
        res.json({ 
            success: true, 
            estado: estado, 
            mensaje: mensaje, 
            contraoferta: contraOferta > 0 ? contraOferta : null,
            redirect: `/negociaciones/${partida._id}` 
        });

    } catch (error) {
        res.status(500).json({ success: false, mensaje: "Error en el servidor" });
    }
});

negociacionRouter.post('/objetivo/confirmarContrato/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { sueldo, anios, rol, clausula, tipo, esRenovacion } = req.body;

        const Model = (tipo === 'jugador') ? Jugador : Empleado;
        const sujeto = await Model.findById(id).populate('clubActual');

        const { sueldoEsperado, aniosEsperados } = calcularPretensiones(sujeto, tipo !== 'jugador');

        if (parseInt(sueldo) >= sueldoEsperado) {
            sujeto.salario = parseInt(sueldo);
            sujeto.añosContrato = parseInt(anios);
            if (tipo === 'jugador') sujeto.rolEquipo = rol;
            else sujeto.puesto = rol;

            const neg = await Negociacion.findOne({ objetivoId: id, finalizada: false });
            if (neg) {
                if (esRenovacion !== "true") {
                    sujeto.clubActual = neg.clubEmisor; 
                }
                neg.estadoContrato = 'aceptado';
                neg.finalizada = true;
                await neg.save();
            }

            await sujeto.save();
            return res.json({ success: true, mensaje: "¡Acuerdo cerrado! El contrato ha sido firmado." });
        } else {
            return res.json({ 
                success: false, 
                mensaje: `El representante rechaza la oferta. Pide al menos ${Math.round(sueldoEsperado).toLocaleString()} €.` 
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, mensaje: "Error al procesar el contrato" });
    }
});

negociacionRouter.delete('/negociaciones/cancelar/:id', async (req, res) => {
    try {
        await Negociacion.findByIdAndUpdate(req.params.id, { 
            finalizada: true, 
            estadoTraspaso: 'rechazado' 
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

module.exports = negociacionRouter;