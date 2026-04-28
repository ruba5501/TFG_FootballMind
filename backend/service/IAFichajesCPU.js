const Jugador = require('../models/jugador');
const Negociacion = require('../models/negociacion');
const Club = require('../models/club');
const Partida = require('../models/partida');

class IAFichajesCPU {
    
    static generarCondicionesTraspaso(jugador) {
        const variacion = 0.8 + Math.random() * 0.4;
        return {
            precio: Math.floor(jugador.valorMercado * variacion),
            futuraVenta: Math.random() > 0.7 ? Math.floor(Math.random() * 20) : 0,
            precioRecompra: Math.random() > 0.9 ? Math.floor(jugador.valorMercado * 2) : 0
        };
    }

    static generarCondicionesCesion() {
        return {
            porcentajeSueldo: [50, 60, 70, 80, 100][Math.floor(Math.random() * 5)],
            clausulaCompra: Math.random() > 0.8 ? true : false 
        };
    }

    static async procesarAccionesCPU(partidaId, fechaActual, clubUsuarioId) {
        if (!clubUsuarioId) {
            console.error("Error: clubUsuarioId es undefined en procesarAccionesCPU");
            return;
        }

        const mes = fechaActual.getMonth();
        const esMercado = [0, 6, 7].includes(mes);

        // 1. Renovaciones (Pasamos el ID directamente)
        await this.revisarRenovacionesCPU(partidaId, fechaActual, clubUsuarioId);

        // 2. Resolver negociaciones CPU-CPU
        await this.resolverNegociacionesPendientes(partidaId, clubUsuarioId);

        if (esMercado) {
            // 3. Movimientos entre CPUs
            const numIntentos = Math.floor(Math.random() * 6) + 3;
            for (let i = 0; i < numIntentos; i++) {
                await this.simularMovimientosEntreCPU(partidaId, clubUsuarioId);
            }

            // 4. Intentar fichar al usuario
            await this.intentarFicharAlUsuario(partidaId, clubUsuarioId);
        }
    }

    static async intentarFicharAlUsuario(partidaId, clubUsuarioId) {
        // SOLUCIÓN AL ERROR: Validar existencia
        if (!clubUsuarioId) return;
        const idUsuario = clubUsuarioId._id || clubUsuarioId;

        // Buscamos un jugador aleatorio del usuario
        const misJugadores = await Jugador.aggregate([
            { $match: { clubActual: idUsuario, partidaId: partidaId } },
            { $sample: { size: 1 } }
        ]);

        const miJugador = misJugadores[0];
        if (!miJugador) return;

        const clubComprador = await Club.findOne({ _id: { $ne: idUsuario }, partidaId });
        if (!clubComprador) return;

        const esTraspaso = Math.random() > 0.4;
        const condiciones = esTraspaso ? 
            this.generarCondicionesTraspaso(miJugador) : 
            this.generarCondicionesCesion();

        await Negociacion.create({
            partidaId,
            objetivoId: miJugador._id,
            tipoObjetivo: 'Jugador',
            clubEmisor: clubComprador._id,
            clubReceptor: idUsuario,
            tipoOferta: esTraspaso ? 'traspaso' : 'cesion',
            ofertaTraspaso: esTraspaso ? condiciones.precio : condiciones.porcentajeSueldo,
            porcentajeVenta: condiciones.futuraVenta || 0,
            precioRecompra: condiciones.precioRecompra || 0,
            clausulaCompra: condiciones.clausulaCompra ? Math.floor(miJugador.valorMercado * 1.5) : 0,
            estadoTraspaso: 'negociando', 
            finalizada: false,
            leidaPorUsuario: false,
            ultimaModificacion: new Date()
        });
        
        console.log(`[IA -> USUARIO] Oferta creada por ${miJugador.nombre}`);
    }

    static async simularMovimientosEntreCPU(partidaId, clubUsuarioId) {
        const idUsuario = clubUsuarioId._id || clubUsuarioId;
        
        // Clubes que no son del usuario
        const clubes = await Club.find({ partidaId, _id: { $ne: idUsuario } });
        if (clubes.length < 2) return;

        const comprador = clubes[Math.floor(Math.random() * clubes.length)];
        const vendedor = clubes[Math.floor(Math.random() * clubes.length)];
        
        if (comprador._id.equals(vendedor._id)) return;

        const objetivo = await Jugador.findOne({
            partidaId,
            clubActual: vendedor._id,
            valorMercado: { $gt: 0 }
        });

        if (!objetivo) return;

        const esTraspaso = Math.random() > 0.4;
        const condiciones = esTraspaso ? 
            this.generarCondicionesTraspaso(objetivo) : 
            this.generarCondicionesCesion();

        await Negociacion.create({
            partidaId,
            objetivoId: objetivo._id,
            tipoObjetivo: 'Jugador',
            clubEmisor: comprador._id,
            clubReceptor: vendedor._id,
            tipoOferta: esTraspaso ? 'traspaso' : 'cesion',
            ofertaTraspaso: esTraspaso ? condiciones.precio : condiciones.porcentajeSueldo,
            porcentajeVenta: condiciones.futuraVenta || 0,
            precioRecompra: condiciones.precioRecompra || 0,
            clausulaCompra: condiciones.clausulaCompra ? Math.floor(objetivo.valorMercado * 1.2) : 0,
            estadoTraspaso: 'negociando',
            finalizada: false,
            ultimaModificacion: new Date()
        });
        console.log(`[IA-IA] Oferta de ${comprador.nombre} a ${vendedor.nombre} por ${objetivo.nombre}`);
    }

    static async resolverNegociacionesPendientes(partidaId, clubUsuarioId) {
        const idUsuario = clubUsuarioId._id || clubUsuarioId;

        // Solo resolvemos donde el RECEPTOR (vendedor) sea una CPU
        const pendientes = await Negociacion.find({
            partidaId,
            finalizada: false,
            clubReceptor: { $ne: idUsuario }
        });

        for (let neg of pendientes) {
            if (Math.random() > 0.6) { 
                const aceptada = Math.random() > 0.3; 
                if (aceptada) {
                    await this.ejecutarTraspasoEfectivo(neg);
                } else {
                    await Negociacion.findByIdAndUpdate(neg._id, { 
                        estadoTraspaso: 'rechazado', 
                        finalizada: true 
                    });
                }
            }
        }
    }

    static async ejecutarTraspasoEfectivo(neg) {
        const objetivo = await Jugador.findById(neg.objetivoId);
        if (!objetivo) return;

        const esTraspaso = neg.tipoOferta === 'traspaso';

        if (esTraspaso) {
            await Club.findByIdAndUpdate(neg.clubEmisor, { $inc: { presupuestoTraspasos: -neg.ofertaTraspaso } });
            await Club.findByIdAndUpdate(neg.clubReceptor, { $inc: { presupuestoTraspasos: neg.ofertaTraspaso } });
        }

        const nuevaFechaFin = new Date();
        nuevaFechaFin.setFullYear(nuevaFechaFin.getFullYear() + (esTraspaso ? 3 : 1));

        await Jugador.findByIdAndUpdate(objetivo._id, {
            clubActual: neg.clubEmisor,
            finContrato: nuevaFechaFin,
            estadoClub: esTraspaso ? 'primerEquipo' : 'cedido',
            salario: esTraspaso ? Math.floor(objetivo.salario * 1.1) : objetivo.salario
        });

        await Negociacion.findByIdAndUpdate(neg._id, { 
            estadoTraspaso: 'aceptado', 
            finalizada: true 
        });
        console.log(`[IA-COMPLETADO] ${objetivo.nombre} se une al ${neg.clubEmisor}`);
    }

    static async revisarRenovacionesCPU(partidaId, fechaActual, clubUsuarioId) {
        const idUsuario = clubUsuarioId._id || clubUsuarioId;

        const seisMesesDespues = new Date(fechaActual);
        seisMesesDespues.setMonth(seisMesesDespues.getMonth() + 6);

        const jugadoresAExpirar = await Jugador.find({
            partidaId,
            clubActual: { $ne: idUsuario },
            finContrato: { $lte: seisMesesDespues }
        });

        for (let jugador of jugadoresAExpirar) {
            if (Math.random() > 0.5) {
                const nuevaFecha = new Date(jugador.finContrato);
                nuevaFecha.setFullYear(nuevaFecha.getFullYear() + 2);
                
                await Jugador.findByIdAndUpdate(jugador._id, {
                    finContrato: nuevaFecha,
                    salario: Math.floor((jugador.salario || 50000) * 1.1)
                });
            }
        }
    }
}

module.exports = IAFichajesCPU;