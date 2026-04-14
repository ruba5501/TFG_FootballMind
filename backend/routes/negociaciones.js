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

function calcularPretensiones(sujeto, esEmpleado, interesJugador) {
    let factor = 1.1;
    
    // Si el jugador tiene poco interés, pedirá más dinero para compensar
    if (interesJugador < 40) factor += 0.3;
    if (interesJugador > 80) factor -= 0.15;

    // Ajuste por valoración (calidad)
    if (!esEmpleado && sujeto.valoracion > 80) factor += 0.2;

    return {
        sueldoEsperado: sujeto.salario * factor,
        aniosEsperados: esEmpleado ? 2 : 3
    };
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
        let isFinalizada = false;
        let isBasicoAceptado = false;
        if (negPrevia){
            if (negPrevia.basicoAceptado){
                isBasicoAceptado = true;
            }
        }

        if (oferta.tipo === 'traspaso') {
            const precioMinimoVenta = calcularPrecioMinimo(jugador, jugador.clubActual, oferta, partida.fechaActual);
            const dineroOfrecido = oferta.precio;
            if (dineroOfrecido < precioMinimoVenta) {
                if (rondas > limiteNegociaciones || dineroOfrecido < precioMinimoVenta * 0.5) {
                    estado = 'rechazado';
                    isFinalizada = true;
                    mensaje = dineroOfrecido < precioMinimoVenta * 0.5 
                        ? "No estamos interesados en vender al jugador por esa cantidad tan baja." 
                        : "Se nos ha agotado la paciencia con vuestras ofertas por el traspaso.";
                } else {
                    estado = 'negociando';
                    const factorAleatorio = 1.08 + (Math.random() * 0.06);
                    let pretensionNuevas = precioMinimoVenta * factorAleatorio;

                    if (negPrevia && negPrevia.estadoTraspaso === 'negociando') {
                        pretensionNuevas = Math.max(precioMinimoVenta, negPrevia.ofertaTraspaso * 0.95);
                        mensaje = "Hemos reconsiderado nuestra postura, pero aún esperamos una oferta mejor por el precio del traspaso.";
                    } else {
                        mensaje = "Vuestra oferta por el traspaso no es suficiente, pero estamos dispuestos a escuchar otra propuesta.";
                    }
                    contraOferta = Math.floor(pretensionNuevas);
                }
            } 
            else {
                if (negPrevia && negPrevia.ofertaTraspaso < precioMinimoVenta) {
                    rondas = 1; 
                    isBasicoAceptado = true;
                }

                if (oferta.precioRecompra && oferta.precioRecompra > 0) {
                    const recompraMinimaAceptable = jugador.valorMercado * 1.2; 
                    if (oferta.precioRecompra >= recompraMinimaAceptable) {
                        estado = 'aceptado';
                        mensaje = "El club acepta las condiciones de venta y la cláusula de recompra fijada.";
                    } 
                    else if (rondas > limiteNegociaciones) {
                        estado = 'aceptado';
                        oferta.precioRecompra = 0;
                        mensaje = "Aceptamos el precio de venta, pero hemos rechazado incluir la cláusula de recompra tras no llegar a un acuerdo.";
                    }
                    else {
                        estado = 'negociando';
                        let pretensionRecompra = recompraMinimaAceptable * 1.1;

                        if (negPrevia && negPrevia.precioRecompra > 0) {
                            pretensionRecompra = Math.max(recompraMinimaAceptable, negPrevia.precioRecompra * 0.95);
                            mensaje = "El precio de venta es correcto, pero estamos negociando la cifra de la recompra.";
                        } else {
                            mensaje = "Aceptamos el precio de venta. Sin embargo, para incluir una opción de recompra, la cifra debe ser mayor.";
                        }
                        contraOferta = Math.floor(pretensionRecompra);
                    }
                } else {
                    estado = 'aceptado';
                    mensaje = "El club acepta las condiciones. Tienes permiso para hablar con el jugador.";
                }
            }
        }
        else if (oferta.tipo === 'cesion') {
            const porcentajeOfrecido = oferta.porcentajeSueldo; 
            let porcentajeMinimo = 0;
            let puedeCederse = false;

            if (jugador.rolEquipo === 'suplente') {
                porcentajeMinimo = 55; 
                puedeCederse = true;
            } else if (jugador.rolEquipo === 'reserva') {
                porcentajeMinimo = 40;
                puedeCederse = true;
            } else if (jugador.rolEquipo === 'promesa') {
                porcentajeMinimo = 20; 
                puedeCederse = true;
            }

            if (!puedeCederse) {
                estado = 'rechazado';
                isFinalizada = true;
                mensaje = "Este jugador es fundamental en nuestros esquemas y no contemplamos su cesión bajo ningún concepto.";
            } else {
                if (porcentajeOfrecido < porcentajeMinimo) {
                    if (rondas > limiteNegociaciones || porcentajeOfrecido < porcentajeMinimo - 20) {
                        estado = 'rechazado';
                        mensaje = "No estamos dispuestos a pagar tanto sueldo por un jugador que no estará aquí.";
                    } else {
                        estado = 'negociando';
                        contraOferta = porcentajeMinimo;
                        mensaje = `Aceptaríamos la cesión si cubrís al menos el ${porcentajeMinimo}% de su ficha.`;
                    }
                } 
                else {
                    if (negPrevia && negPrevia.ofertaTraspaso < porcentajeMinimo) {
                        rondas = 1; 
                        isBasicoAceptado = true;
                    }
                    if (oferta.clausulaCompra && oferta.clausulaCompra > 0) {
                        const valorVenta = calcularPrecioMinimo(jugador, jugador.clubActual, oferta, partida.fechaActual);
                        const clausulaAceptable = valorVenta * 1.1;

                        if (oferta.clausulaCompra >= clausulaAceptable) {
                            estado = 'aceptado';
                            mensaje = "Aceptamos la cesión y el precio fijado para la opción de compra.";
                        } 
                        else if (rondas >= limiteNegociaciones) {
                            estado = 'aceptado';
                            oferta.clausulaCompra = 0; 
                            mensaje = "Aceptamos la cesión, pero hemos rechazado la opción de compra al no llegar a un acuerdo económico.";
                        }
                        else {
                            estado = 'negociando';
                            let pretensionClausula = clausulaAceptable * 1.08;
                            
                            if (negPrevia && negPrevia.clausulaCompra > 0) {
                                pretensionClausula = Math.max(clausulaAceptable, negPrevia.ofertaTraspaso * 0.95);
                                mensaje = "Estamos dispuestos a bajar el precio de la opción de compra, pero aún es insuficiente.";
                            } else {
                                mensaje = "El porcentaje de sueldo es correcto, pero queremos fijar un precio de compra más alto.";
                            }
                            contraOferta = Math.floor(pretensionClausula);
                        }
                    } else {
                        estado = 'aceptado';
                        mensaje = "La propuesta de cesión nos parece justa para ambas partes.";
                    }
                }
            }
            
        }
        await Negociacion.findOneAndUpdate(
            { objetivoId: jugador._id, clubEmisor: miClubId, finalizada: isFinalizada },
            {
                partidaId: partida._id,
                tipoObjetivo: 'Jugador',
                objetivoId: jugador._id,
                clubEmisor: miClubId,
                clubReceptor: jugador.clubActual._id,
                estadoTraspaso: estado,
                tipoOferta: oferta.tipo,
                rondas: rondas,
                ofertaTraspaso: oferta.tipo === 'traspaso' ? oferta.precio : oferta.porcentajeSueldo,
                contraofertaTraspaso: contraOferta > 0 ? contraOferta : (negPrevia ? negPrevia.contraofertaTraspaso : 0),
                porcentajeFuturaVenta: oferta.futuraVenta || 0,
                precioRecompra: oferta.precioRecompra || 0,
                clausulaCompra: oferta.clausulaCompra || 0,
                basicoAceptado: isBasicoAceptado,
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
        const { sueldo, anios, rol, clausula, tipo, esRenovacion, interesJugador } = req.body;
        const id = req.params.id;
        const sOfrecido = parseInt(sueldo);
        const aOfrecidos = parseInt(anios);
        const clausulaOfrecida = parseInt(clausula) || 0;

        const Model = (tipo === 'jugador') ? Jugador : Empleado;
        const sujeto = await Model.findById(id).populate('clubActual');
        
        if (!sujeto) return res.status(404).json({ success: false, mensaje: "Sujeto no encontrado." });

        const partida = await partidasDAO.obtenerPartidaPorId(sujeto.partidaId);

        let neg = await Negociacion.findOne({ objetivoId: id, finalizada: false });

        let rondas = (neg.rondasContrato || 0) + 1;
        const limiteRondas = 5;

        const { sueldoEsperado, aniosEsperados } = calcularPretensiones(sujeto, tipo !== 'jugador', interesJugador);
        const sueloNegociable = sueldoEsperado * 0.80; 

        let estado = 'negociando';
        let mensaje = "";
        let contraSueldo = 0;
        let finalizada = false;
        let isBasicoAceptado = neg.basicoContratoAceptado || false;

        if (!isBasicoAceptado) {
            if (sOfrecido < sueloNegociable) {
                if (rondas >= limiteRondas || sOfrecido < sueldoEsperado * 0.6) {
                    estado = 'rechazado';
                    finalizada = true;
                    mensaje = sOfrecido < sueldoEsperado * 0.6 
                        ? "La oferta salarial es un insulto para alguien de mi prestigio." 
                        : "He perdido el interés tras tantas vueltas. No habrá acuerdo.";
                } else {
                    estado = 'negociando';
                    const factorPaciencia = 1.05 - (rondas * 0.02);
                    contraSueldo = Math.floor(sueldoEsperado * factorPaciencia);
                    mensaje = "El sueldo está lejos de lo que pedimos, pero estamos dispuestos a escuchar una mejora.";
                }
            } else {
                isBasicoAceptado = true;
                if (sOfrecido < sueldoEsperado) rondas = 1; 
                
                if (!clausulaOfrecida) {
                    estado = 'aceptado';
                    finalizada = true;
                    mensaje = "Estamos de acuerdo con las condiciones. ¡Cerrado!";
                } else {
                    mensaje = "El sueldo y el rol me parecen correctos. Hablemos de la cláusula.";
                }
            }
        } 
        
        if (isBasicoAceptado && !finalizada && clausulaOfrecida > 0) {
            const clausulaMinimaAceptable = sOfrecido * 50; 

            if (clausulaOfrecida >= clausulaMinimaAceptable) {
                estado = 'aceptado';
                finalizada = true;
                mensaje = "¡Acuerdo cerrado! Tanto el sueldo como la cláusula son satisfactorios.";
            } else if (rondas >= limiteRondas) {
                estado = 'aceptado';
                finalizada = true;
                neg.clausulaRescision = 0;
                mensaje = "Aceptamos el contrato, pero no incluiremos esa cláusula de rescisión tan baja.";
            } else {
                estado = 'negociando';
                contraSueldo = Math.floor(clausulaMinimaAceptable); // En este caso devolvemos la cláusula que pide
                mensaje = "El sueldo está bien, pero para aceptar esa cláusula de rescisión, la cifra debe ser mayor.";
            }
        }

        if (estado === 'aceptado' && finalizada) {
            sujeto.salario = sOfrecido;
            sujeto.añosContrato = aOfrecidos;
            if (tipo === 'jugador') {
                sujeto.rolEquipo = rol;
                if (esRenovacion !== "true") {
                    sujeto.clubActual = neg.clubEmisor;
                }
            } else {
                sujeto.puesto = rol;
            }
            await sujeto.save();
        }

        neg.estadoContrato = estado;
        neg.rondasContrato = rondas;
        neg.ofertaSueldo = sOfrecido;
        neg.ofertaAnios = aOfrecidos;
        neg.rolPrometido = rol;
        neg.clausulaRescision = (estado === 'aceptado') ? clausulaOfrecida : (neg.clausulaRescision || 0);
        neg.contraofertaSueldo = contraSueldo;
        neg.basicoContratoAceptado = isBasicoAceptado;
        neg.finalizada = finalizada;
        neg.ultimaModificacion = Date.now();

        await neg.save();

        return res.json({ 
            success: true, 
            estado, 
            mensaje, 
            contraoferta: contraSueldo > 0 ? contraSueldo : null,
            redirect: `/negociaciones/${partida._id}` 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, mensaje: "Error al procesar el contrato" });
    }
});

negociacionRouter.get('/negociaciones/borrar/:id', async (req, res) => {
    try {
        await Negociacion.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error("ERROR EN CANCELAR:", error);
        res.status(500).json({ success: false });
    }
});

negociacionRouter.get('/negociaciones/finalizar/:id', async (req, res) => {
    try {
        await Negociacion.findByIdAndUpdate(req.params.id, { 
            finalizada: true,         
            estadoTraspaso: 'rechazado'
        });
        res.json({ success: true });
    } catch (error) {
        console.error("ERROR EN CANCELAR:", error);
        res.status(500).json({ success: false });
    }
});

module.exports = negociacionRouter;