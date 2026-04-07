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
const Negociocion = require('../models/negociacion');

function calcularPrecioMinimo(jugador, clubVendedor, ofertaDetalles) {
    let factor = 1.0;

    // 1. Rol en el equipo
    if (jugador.rolEquipo === 'clave') factor += 0.4;
    if (jugador.rolEquipo === 'titular') factor += 0.2;
    if (jugador.rolEquipo === 'reserva') factor -= 0.1;
    if (jugador.rolEquipo === 'descarte') factor -= 0.25;

    // 2. Tiempo de contrato (Urgencia de venta)
    // Usamos mesesRestantes (asumiendo que tienes esa lógica o años)
    if (jugador.añosContrato < 1) factor -= 0.3;
    else if (jugador.añosContrato < 2) factor -= 0.1;

    // 3. Estatus del club vendedor
    // Clubes ricos (Reputación > 85) piden un "impuesto de lujo"
    if (clubVendedor.reputacion > 85) factor += 0.2;

    let precioBaseIA = jugador.valorMercado * factor;

    // 4. PESO DE LAS CLÁUSULAS (Esto hace que acepten menos dinero fijo)
    // Cada 1% de futura venta baja el precio exigido en un 0.5%
    if (ofertaDetalles.futuraVenta > 0) {
        precioBaseIA -= (precioBaseIA * (ofertaDetalles.futuraVenta * 0.005));
    }
    // Si incluyes recompra barata, el club vendedor se siente seguro y pide menos
    if (ofertaDetalles.precioRecompra > 0 && ofertaDetalles.precioRecompra < jugador.valorMercado * 1.5) {
        precioBaseIA *= 0.9; 
    }

    return precioBaseIA;
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
        const { oferta } = req.body; // Viene el objeto completo del frontend
        const jugador = await Jugador.findById(req.params.jugadorId).populate('club');
        
        if (oferta.tipo === 'traspaso') {
            const precioMinimo = calcularPrecioMinimo(jugador, jugador.club, oferta);
            const dineroOfrecido = oferta.precio;

            if (dineroOfrecido >= precioMinimo) {
                return res.json({ success: true, estado: 'aceptado', mensaje: "El club acepta las condiciones. Tienes permiso para hablar con el jugador." });
            } else if (dineroOfrecido >= precioMinimo * 0.8) {
                return res.json({ success: false, estado: 'negociando', mensaje: "La oferta es insuficiente, pero nos interesa el trato.", contraoferta: Math.ceil(precioMinimo) });
            } else {
                return res.json({ success: false, estado: 'rechazado', mensaje: "No estamos interesados en vender al jugador por esa cantidad." });
            }
        } 
        
        if (oferta.tipo === 'cesion') {
            // Lógica de cesión: el club acepta si pagas mucho sueldo o el jugador es un descarte
            let aceptado = false;
            if (jugador.rolEquipo === 'descarte' && oferta.porcentajeSueldo >= 50) aceptado = true;
            if (oferta.porcentajeSueldo >= 80) aceptado = true;

            if (aceptado) {
                return res.json({ success: true, estado: 'aceptado', mensaje: "Cesión aceptada. El jugador está viajando para negociar su contrato." });
            } else {
                return res.json({ success: false, estado: 'rechazado', mensaje: "Solo aceptamos la cesión si os hacéis cargo de una mayor parte de la ficha." });
            }
        }

    } catch (error) {
        res.status(500).json({ success: false, mensaje: "Error en el servidor" });
    }
});

// negociacionRouter.js

negociacionRouter.post('/objetivo/confirmarContrato/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { sueldo, anios, rol, clausula, tipo, esRenovacion } = req.body;

        // 1. Buscar al sujeto
        const Model = (tipo === 'jugador') ? Jugador : Empleado;
        const sujeto = await Model.findById(id).populate('clubActual');

        // 2. LÓGICA DE IA (Pretensiones)
        // El sujeto pide un aumento basado en su valoración y situación
        let sueldoMinimoAceptable = sujeto.salario * 1.1; // Por defecto pide 10% más
        
        if (sujeto.valoracion > 80) sueldoMinimoAceptable *= 1.2; // Los cracks piden más
        if (sujeto.añosContrato < 1) sueldoMinimoAceptable *= 0.9; // Si acaba contrato, es más flexible

        // 3. TOMA DE DECISIÓN
        if (parseInt(sueldo) >= sueldoMinimoAceptable) {
            
            // SI ACEPTA: Actualizamos en la DB
            // En un simulador real, aquí actualizarías su contrato
            sujeto.salario = parseInt(sueldo);
            sujeto.añosContrato = parseInt(anios);
            if (tipo === 'jugador') sujeto.rolEquipo = rol;
            else sujeto.puesto = rol;
            
            // Si es FICHAJE (no renovación), habría que cambiar el clubActual al club del usuario
            // sujeto.clubActual = req.session.miClubId; 

            await sujeto.save();

            return res.json({ 
                success: true, 
                mensaje: esRenovacion === "true" 
                    ? "¡Renovación completada con éxito!" 
                    : "¡Fichaje cerrado! El jugador se une a tu plantilla." 
            });
        } else {
            return res.json({ 
                success: false, 
                mensaje: "El sueldo ofrecido no cumple las expectativas del representante." 
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, mensaje: "Error al procesar el contrato" });
    }
});

module.exports = negociacionRouter;