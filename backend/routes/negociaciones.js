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
const { requireLogin } = require('../middleware/autenticacion');

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

function calcularPretensiones(objetivo, esEmpleado, interesJugador, miClub, ofertaPrima, ofertaClausula) {
    let factorSueldo = 1.0;
    let aniosEsperados = esEmpleado ? 2 : 3;
    let rolEsperado = '';
    //segun la reputacion del club le piden mas o menos sueldo
    const factorReputacionClub = Math.max(0, (miClub.reputacion - 50) / 250); 
    factorSueldo += factorReputacionClub;

    if (!esEmpleado) {
        const nivelCorteClub = (miClub.reputacion * 0.85); 
        const diferenciaCalidad = objetivo.valoracion - nivelCorteClub;

        // Determinación del Rol en comparacion a la reputacion del club
        if(objetivo.edad <= 23 && diferenciaCalidad < -6) rolEsperado = 'promesa';
        else if (diferenciaCalidad >= 7) rolEsperado = 'clave';
        else if (diferenciaCalidad >= 2) rolEsperado = 'importante';
        else if (diferenciaCalidad >= -6) rolEsperado = 'suplente';
        else rolEsperado = 'reserva';
        
        //Cuanto mas cerca de retirarse menos años pedira de contrato
        if (objetivo.edad > 34) {
            aniosEsperados = 1;
        } else if (objetivo.edad > 30) {
            aniosEsperados = Math.min(2, aniosEsperados);
        } else {
        //si el jugador es muy bueno para tu club pedira menos años
            if (diferenciaCalidad >= 21) aniosEsperados = 2; 
            else if (diferenciaCalidad >= 12) aniosEsperados = 4;
            else aniosEsperados = 5;
        }

        //si el jugador es estrella pedira mas dinero
        if (objetivo.valoracion > 80) factorSueldo += 0.15;
        if (objetivo.valoracion > 88) factorSueldo += 0.15;

        //Si el jugador esta muy interesado en unirse pedira menos dinero sino pedira mas
        if (interesJugador < 20) factorSueldo += 0.25;
        else if (interesJugador < 40) factorSueldo += 0.15;
        else if (interesJugador > 90) factorSueldo -= 0.15;
        else if (interesJugador > 75) factorSueldo -= 0.05;

        //si se añade clausula de rescisión se pedira menos sueldo
        if (ofertaClausula > 0) {
            factorSueldo -= 0.05;
        }
    }
    else{
        rolEsperado = objetivo.tipo; 

        const calidadEmpleado = (objetivo.reputacion + objetivo.experiencia) / 2;

        if (calidadEmpleado > 85) factorSueldo += 0.30;
        else if (calidadEmpleado > 75) factorSueldo += 0.20;
        else if (calidadEmpleado > 60) factorSueldo += 0.10;

        aniosEsperados = calidadEmpleado > 80 ? 3 : 5;
    }
    //si se incluye prima se pedira menos sueldo
    if (ofertaPrima > 0) {
        factorSueldo -= 0.1;
    }

    factorSueldo = Math.min(factorSueldo, 2.0);
    return {
        sueldoMinimoEsperado: Math.round(objetivo.salario * factorSueldo),
        aniosMaximosEsperados: aniosEsperados,
        rolMinimoEsperado: rolEsperado 
    };
}

negociacionRouter.post('/fichajes/ofertaTraspaso/:jugadorId', requireLogin, async (req, res) => {
    try {
        const oferta = {
            tipo: req.body.oferta.tipo,
            precio: Number(req.body.oferta.precio) || 0,
            porcentajeSueldo: Number(req.body.oferta.porcentajeSueldo) || 0,
            precioRecompra: Number(req.body.oferta.precioRecompra) || 0,
            clausulaCompra: Number(req.body.oferta.clausulaCompra) || 0,
            futuraVenta: Number(req.body.oferta.futuraVenta) || 0
        };
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
                isBasicoAceptado = true;
                if (negPrevia && negPrevia.ofertaTraspaso < precioMinimoVenta) {
                    rondas = 1; 
                }

                if (oferta.precioRecompra && oferta.precioRecompra > 0) {
                    const recompraMinimaAceptable = jugador.valorMercado * 1.2; 
                    if (oferta.precioRecompra >= recompraMinimaAceptable) {
                        estado = 'aceptado';
                        mensaje = "El club acepta las condiciones de venta y la cláusula de recompra fijada.";
                    } 
                    else if (rondas > limiteNegociaciones) {
                        estado = 'rechazado';
                        isFinalizada = true;
                        mensaje = "Rechazamos la oferta porque no se ha conseguido llegar a un acuerdo con la clausula de recompra";
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
                        isFinalizada = true;
                        mensaje = "No estamos dispuestos a pagar tanto sueldo por un jugador que no estará aquí.";
                    } else {
                        estado = 'negociando';
                        contraOferta = porcentajeMinimo;
                        mensaje = `Aceptaríamos la cesión si cubrís al menos el ${porcentajeMinimo}% de su ficha.`;
                    }
                } 
                else {
                    isBasicoAceptado = true;
                    if (negPrevia && negPrevia.ofertaTraspaso < porcentajeMinimo) {
                        rondas = 1; 
                    }
                    if (oferta.clausulaCompra && oferta.clausulaCompra > 0) {
                        const valorVenta = calcularPrecioMinimo(jugador, jugador.clubActual, oferta, partida.fechaActual);
                        const clausulaAceptable = valorVenta * 1.1;

                        if (oferta.clausulaCompra >= clausulaAceptable) {
                            estado = 'aceptado';
                            isFinalizada = true;
                            mensaje = "Aceptamos la cesión y el precio fijado para la opción de compra.";
                        } 
                        else if (rondas >= limiteNegociaciones) {
                            estado = 'aceptado';
                            oferta.clausulaCompra = 0; 
                            isFinalizada = true;
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
                ofertaTraspaso: oferta.tipo === 'traspaso' ? oferta.precio : oferta.porcentajeSueldo,
                contraofertaTraspaso: contraOferta > 0 ? contraOferta : (negPrevia ? negPrevia.contraofertaTraspaso : 0),
                porcentajeFuturaVenta: oferta.futuraVenta || null,
                precioRecompra: oferta.precioRecompra || null,
                clausulaCompra: oferta.clausulaCompra || null,
                basicoAceptado: isBasicoAceptado,
                finalizada: isFinalizada,
                ultimaModificacion: new Date(partida.fechaActual)
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

negociacionRouter.post('/objetivo/confirmarContrato/:id', requireLogin, async (req, res) => {
    try {
        const sueldo = Number(req.body.sueldo);
        const anios = Number(req.body.anios);
        const prima = Number(req.body.prima) || 0;
        const clausula = Number(req.body.clausula) || 0;
        const { rol, tipo, esRenovacion, interesJugador } = req.body;
        const id = req.params.id;

        const Model = (tipo === 'jugador') ? Jugador : Empleado;
        const objetivo = await Model.findById(id).populate('clubActual');
        const partida = await partidasDAO.obtenerPartidaPorId(objetivo.partidaId);
        const miClubId = partida.clubSeleccionado._id;
        const miClub = await clubesDAO.buscarClubPorId(miClubId);
        let negPrevia = await Negociacion.findOne({ 
            objetivoId: objetivo._id, 
            clubEmisor: miClubId, 
            finalizada: false 
        });

        let rondas = negPrevia ? (negPrevia.rondasContrato || 0) + 1 : 1;
        const limiteRondas = 5;

        let estado = 'negociando';
        let mensaje = "";
        let contraOfertaS = null;
        let contraOfertaA = null;
        let contraOfertaR = '';
        let contraOfertaP = null;
        let isFinalizada = false;
        let isBasicoAceptado = false;
        if (negPrevia){
            if (negPrevia.basicoContratoAceptado){
                isBasicoAceptado = true;
            }
        }
        let sueldoAceptable = false;
        let aniosAceptables = false;
        let rolAceptable = false;
        let primaMal = false;

        const { sueldoMinimoEsperado, aniosMaximosEsperados, rolMinimoEsperado } = calcularPretensiones(objetivo, tipo !== 'jugador', interesJugador, miClub);
        const jerarquiaRoles = { 'clave': 5, 'importante': 4, 'suplente': 3, 'reserva': 2, 'promesa': 1 };
       
        if (!isBasicoAceptado) {
            sueldoAceptable = sueldo >= (sueldoMinimoEsperado * 0.8);
            aniosAceptables = anios <= aniosMaximosEsperados;
            rolAceptable = false;

            if (tipo === 'jugador') {
                rolAceptable = jerarquiaRoles[rol] >= jerarquiaRoles[rolMinimoEsperado];
            } else {
                rolAceptable = (rol === objetivo.tipo); 
            }
            if (sueldoAceptable && aniosAceptables && rolAceptable) {
                isBasicoAceptado = true;
                rondas = 1; 
            } else {
                if (rondas >= limiteRondas || sueldo < sueldoMinimoEsperado * 0.3) {
                    estado = 'rechazado';
                    isFinalizada = true;
                    mensaje = sueldo < sueldoMinimoEsperado * 0.3 
                        ? "Las condiciones propuestas estan muy lejos de nuestras pretensiones." 
                        : "Hemos perdido el interés tras tantas vueltas. No habrá acuerdo.";
                } else {
                    estado = 'negociando';
                    const factorAleatorio = 1.05 - (rondas * 0.02);
                    let pretensionNuevas = 0;
                    if (!sueldoAceptable){ 
                        pretensionNuevas = sueldoMinimoEsperado * factorAleatorio;
                        contraOfertaS = Math.floor(pretensionNuevas);
                        mensaje = "El sueldo ofrecido es insuficiente. ";
                    }
                    if (!aniosAceptables) {
                        contraOfertaA = aniosMaximosEsperados;
                        mensaje += `Espero un contrato de al menos ${aniosMaximosEsperados} años. `;
                    }
                    if (!rolAceptable) {
                        contraOfertaR = rolMinimoEsperado;
                        if (tipo === 'jugador') {
                            mensaje += `Mi importancia en el equipo debe ser mayor (${rolMinimoEsperado}).`;
                        }else {
                            mensaje += `No estoy interesado en ese puesto. Yo soy ${objetivo.tipo}.`;
                        }
                    }
                }
            }
        }
        if (isBasicoAceptado && !isFinalizada) {
            const primaMinimaSiExiste = sueldo * 0.05;
            const hayPrima = prima > 0;
            primaMal = hayPrima && prima < primaMinimaSiExiste;
            if (!primaMal) {
                estado = 'aceptado';
                isFinalizada = true;
                mensaje = "¡Trato hecho! Las condiciones son satisfactorias.";
                
                const anioActualSimulador = new Date(partida.fechaActual).getFullYear();

                let anioBase;

                if (esRenovacion === 'true' && objetivo.finContrato) {
                    // Si es renovación, sumamos sobre el año en que ya terminaba
                    anioBase = new Date(objetivo.finContrato).getFullYear();
                } else {
                    // Si es fichaje, sumamos sobre el año actual del simulador
                    anioBase = anioActualSimulador;
                }
                const fechaFin = new Date(Date.UTC(anioBase + anios, 5, 30, 12, 0, 0));

                const costeTraspaso = negPrevia?.ofertaTraspaso || 0;
                const primaFichaje = prima || 0;
                const nuevoSueldo = sueldo;
                const sueldoAnterior = objetivo.salario || 0;

                // Actualizamos el Jugador/Empleado
                await Model.findByIdAndUpdate(id, {
                    clubActual: miClubId,
                    salario: nuevoSueldo,
                    finContrato: fechaFin,
                    rolEquipo: tipo === 'jugador' ? rol : undefined,
                    tipo: tipo !== 'jugador' ? rol : undefined,
                    "mercado.clausulaRescision": clausula
                });
                // Si no es renovación, hay que actualizar las plantillas de los clubes
                if (esRenovacion === 'false') {
                    // Quitar del club antiguo 
                    if (objetivo.clubActual) {
                        await Club.findByIdAndUpdate(objetivo.clubActual._id, {
                            $pull: { 
                                [tipo === 'jugador' ? 'plantilla' : 'empleados']: id,
                                "tactica.titulares": id,
                                "tactica.suplentes": id,
                                "tactica.reservas": id
                            },
                            $inc: { 
                                presupuestoTraspasos: costeTraspaso,
                                presupuestoSalarios: sueldoAnterior 
                            }
                        });
                    }
                    // Añadir al club nuevo
                    const updateClubNuevo = {
                        $push: { 
                            [tipo === 'jugador' ? 'plantilla' : 'empleados']: id 
                        },
                        $inc: { 
                            presupuestoTraspasos: -(costeTraspaso + primaFichaje),
                            presupuestoSalarios: -nuevoSueldo
                        }
                    };

                    // Si es jugador, lo metemos directamente en 'reservas' para que aparezca en la gestión táctica
                    if (tipo === 'jugador') {
                        updateClubNuevo.$push["tactica.reservas"] = id;
                    }

                    await Club.findByIdAndUpdate(miClubId, updateClubNuevo);
                }
                else {                    
                    // Solo actualizamos el diferencial del presupuesto y la prima
                    await Club.findByIdAndUpdate(miClubId, {
                        $inc: { 
                            presupuestoTraspasos: -primaFichaje,
                            presupuestoSalarios: -(nuevoSueldo - sueldoAnterior)
                        }
                    });
                }
            } else {
                if (rondas >= limiteRondas) {
                    estado = 'rechazado';
                    isFinalizada = true;
                    mensaje = "Rechazamos el contrato por no llegar a un acuerdo con la prima";                
                }
                else {
                    estado = 'negociando';
                    contraOfertaP = primaMinimaSiExiste;
                    mensaje = "La prima de fichaje ofrecida no es suficiente para que la consideremos.";
                }
            }
        }

        await Negociacion.findOneAndUpdate(
            { objetivoId: objetivo._id, clubEmisor: miClubId, finalizada: false },
            {
                partidaId: partida._id,
                tipoObjetivo: tipo === 'jugador' ? 'Jugador' : 'Empleado',
                objetivoId: objetivo._id,
                clubEmisor: miClubId,
                clubReceptor: objetivo.clubActual?._id,
                estadoContrato: estado,
                estadoTraspaso: 'aceptado',
                rondasContrato: rondas,
                ofertaSueldo: sueldo,
                ofertaAnios: anios,
                rolPrometido: rol,
                PrimaContrato: prima,
                clausulaRescision: clausula,
                contraofertaSueldo: sueldoAceptable ? null : (contraOfertaS || (negPrevia ? negPrevia.contraofertaSueldo : null)),
                contraofertaAños: aniosAceptables ? null : (contraOfertaA || (negPrevia ? negPrevia.contraofertaAños : null)),
                contraofertaRol: rolAceptable ? null : (contraOfertaR || (negPrevia ? negPrevia.contraofertaRol : '')),
                contraofertaPrima: !primaMal ? null : (contraOfertaP || (negPrevia ? negPrevia.contraofertaPrima : null)),
                basicoContratoAceptado: isBasicoAceptado,
                finalizada:isFinalizada,
                ultimaModificacion: new Date(partida.fechaActual),
                tipoOferta: esRenovacion === 'true' ? 'renovacion' : 'traspaso'
            },
            { upsert: true }
        );

        return res.json({ 
            success: true, 
            estado, 
            mensaje, 
            contraofertaS: contraOfertaS > 0 ? contraOfertaS : null,
            contraofertaA: contraOfertaA > 0 ? contraOfertaA : null,
            contraofertaR: (typeof contraOfertaR === 'string' && contraOfertaR.length > 0) ? contraOfertaR : '',
            contraofertaP: contraOfertaP > 0 ? contraOfertaP : null,
            redirect: `/negociaciones/${partida._id}` 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, mensaje: "Error al procesar el contrato" });
    }
});

negociacionRouter.post('/fichajes/responderOfertaRecibida/:negociacionId', requireLogin, async (req, res) => {
    try {
        const { negociacionId } = req.params;
        const { accion, oferta: datosOferta } = req.body; 

        const negPrevia = await Negociacion.findById(negociacionId).populate('objetivoId');
        const jugador = negPrevia.objetivoId;
        const partida = await partidasDAO.obtenerPartidaPorId(negPrevia.partidaId);
        
        const limiteNegociaciones = 5;
        //let rondas = negPrevia ? (negPrevia.rondas || 0) + 1 : 1;
        let rondas = 0; //luego quitar (solo para hacer pruebas)
        let estado = 'negociando';
        let mensaje = "";
        let contraOferta = 0;
        let isFinalizada = false;
        let isBasicoAceptado = negPrevia.basicoAceptado || false;
        
        if (datosOferta.tipo === 'traspaso') {
            const precioJusto = calcularPrecioMinimo(jugador, jugador.clubActual, datosOferta, partida.fechaActual);
            const pedidoUsuario = Number(datosOferta.contraofertaTraspaso);
            if (!isBasicoAceptado) {
                if (pedidoUsuario <= precioJusto * 1.1) {
                    isBasicoAceptado = true;
                    rondas = 1; 
                } else {
                    if (rondas > limiteNegociaciones) {
                        estado = 'rechazado';
                        isFinalizada = true;
                        mensaje = "El club comprador se retira: no pueden permitirse el traspaso.";
                    } else {
                        estado = 'negociando';
                        const subida = (pedidoUsuario - negPrevia.ofertaTraspaso) * 0.35;
                        contraOferta = Math.floor(Math.min(negPrevia.ofertaTraspaso + subida, precioJusto * 1.1));
                        mensaje = "El club comprador mejora su oferta, pero no llegará a lo que pides.";
                    }
                }
            }

            if (isBasicoAceptado && !isFinalizada) {
                const recompraUsuario = Number(datosOferta.tuContraofertaRecompra) || 0;
                
                if (recompraUsuario > 0) {
                    const limiteRecompraCPU = jugador.valorMercado * 1.5;
                    if (recompraUsuario >= limiteRecompraCPU) {
                        estado = 'aceptado';
                        isFinalizada = true;
                        mensaje = "¡Acuerdo total! El club acepta el precio y la opción de recompra.";
                    } else if (rondas > limiteNegociaciones) {
                        estado = 'rechazado';
                        isFinalizada = true;
                        mensaje = "La cláusula de recompra es inasumible para el comprador.";
                    } else {
                        estado = 'negociando';
                        const sugerenciaCPU = Math.floor(recompraUsuario * 1.20);
                        contraOferta = Math.min(sugerenciaCPU, limiteRecompraCPU);
                        mensaje = "Aceptamos el precio base, pero la cláusula de recompra debe ser más alta.";
                    }
                } else {
                    estado = 'aceptado';
                    isFinalizada = true;
                    mensaje = "El club comprador acepta las condiciones del traspaso.";
                }
            }
        } 
        else if (datosOferta.tipo === 'cesion') {
            const sueldoUsuario = Number(datosOferta.contraofertaTraspaso);
            
            if (!isBasicoAceptado) {
                if (sueldoUsuario <= negPrevia.ofertaTraspaso + 10) { 
                    isBasicoAceptado = true;
                    rondas = 1;
                } else if (rondas > limiteNegociaciones) {
                    estado = 'rechazado';
                    isFinalizada = true;
                    mensaje = "El club no puede cubrir tal porcentaje de ficha.";
                } else {
                    estado = 'negociando';
                    contraOferta = Math.floor((sueldoUsuario + negPrevia.ofertaTraspaso) / 2);
                    mensaje = "El club comprador ofrece cubrir un porcentaje intermedio de la ficha.";
                }
            }

            if (isBasicoAceptado && !isFinalizada) {
                const clausulaUsuario = Number(datosOferta.tuContraofertaClausulaCompra) || 0;
                if (clausulaUsuario > 0) {
                    const precioJusto = calcularPrecioMinimo(jugador, jugador.clubActual, datosOferta, partida.fechaActual);
                    if (clausulaUsuario >= precioJusto * 1.1) {
                        estado = 'aceptado';
                        isFinalizada = true;
                        mensaje = "Acuerdo de cesión con opción de compra alcanzado.";
                    } else if (rondas > limiteNegociaciones) {
                        estado = 'aceptado';
                        isFinalizada = true;
                        datosOferta.clausulaCompra = 0;
                        mensaje = "Aceptamos la cesión, pero renunciamos a la opción de compra por el precio.";
                    } else {
                        estado = 'negociando';
                        const subida = (clausulaUsuario - negPrevia.tuContraofertaClausulaCompra) * 0.35;
                        contraOferta = Math.floor(Math.min(negPrevia.tuContraofertaClausulaCompra + subida, precioJusto * 1.1));
                        mensaje = "El sueldo es correcto, pero la opción de compra debe ser más baja.";
                    }
                } else {
                    estado = 'aceptado';
                    isFinalizada = true;
                    mensaje = "Cesión aceptada por el club comprador.";
                }
            }
        }
        
        await Negociacion.findByIdAndUpdate(negociacionId, {
            estadoTraspaso: estado,
            rondas: rondas,
            ofertaTraspaso: !isBasicoAceptado ? contraOferta > 0 ? contraOferta : (accion === 'contraofertar' ? datosOferta.contraofertaTraspaso : negPrevia.ofertaTraspaso) : datosOferta.contraofertaTraspaso,
            contraofertaTraspaso: accion === 'contraofertar' ? datosOferta.contraofertaTraspaso : negPrevia.contraofertaTraspaso,
            precioRecompra: negPrevia.tipoOferta === 'traspaso' ? (isBasicoAceptado ? (contraOferta > 0 && estado === 'negociando' ? contraOferta : (datosOferta.precioRecompra || negPrevia.precioRecompra)) : 0) : 0,
            tuContraofertaRecompra: datosOferta.tuContraofertaRecompra || negPrevia.tuContraofertaRecompra,
            clausulaCompra: negPrevia.tipoOferta === 'cesion' ? (isBasicoAceptado ? (contraOferta > 0 && estado === 'negociando' ? contraOferta : (datosOferta.clausulaCompra || negPrevia.clausulaCompra)) : 0) : 0,
            tuContraofertaClausulaCompra: datosOferta.tuContraofertaClausulaCompra || negPrevia.tuContraofertaClausulaCompra,
            porcentajeFuturaVenta: datosOferta.porcentajeFuturaVenta || negPrevia.porcentajeFuturaVenta,
            basicoAceptado: isBasicoAceptado,
            finalizada: isFinalizada,
            ultimaModificacion: new Date(partida.fechaActual)
        });

        res.json({ 
            success: true, 
            estado: estado, 
            mensaje: mensaje, 
            redirect: `/negociaciones/${partida._id}` 
        });

    } catch (error) {
        console.error("Error en responderOfertaRecibida:", error);
        res.status(500).json({ success: false, mensaje: "Error interno del servidor" });
    }
});

negociacionRouter.get('/historialFichajes/:id', requireLogin, async (req, res) => {
    try {
        const partidaId = req.params.id;
        const partida = await Partida.findById(partidaId).populate('clubSeleccionado');

        const negociacionesEnCurso = await Negociacion.find({
            partidaId,
            finalizada: false,
        }).populate('objetivoId clubEmisor clubReceptor').sort({ ultimaModificacion: -1 });

        const negociacionesCerradas = await Negociacion.find({
            partidaId,
            finalizada: true,
        }).populate('objetivoId clubEmisor clubReceptor').sort({ ultimaModificacion: -1 });

        res.render('fichajes', {
            partida,
            user: req.user,
            enCurso: negociacionesEnCurso,
            historial: negociacionesCerradas
        });
    } catch (error) {
        console.error(error);
        res.redirect('/inicioJuego/' + req.params.id);
    }
});

negociacionRouter.get('/negociaciones/borrar/:id', requireLogin, async (req, res) => {
    try {
        await Negociacion.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error("ERROR EN CANCELAR:", error);
        res.status(500).json({ success: false });
    }
});

negociacionRouter.get('/negociaciones/finalizar/:id', requireLogin, async (req, res) => {
    try {
        const negociacion = await Negociacion.findById(req.params.id);
        await Negociacion.findByIdAndUpdate(req.params.id, { 
            finalizada: true,         
            estadoTraspaso: negociacion.estadoTraspaso === 'aceptado'? 'aceptado' : 'rechazado',
            estadoContrato: 'rechazado'
        });
        res.json({ success: true });
    } catch (error) {
        console.error("ERROR EN CANCELAR:", error);
        res.status(500).json({ success: false });
    }
});

module.exports = negociacionRouter;