const Jugador = require('../models/jugador');
const Negociacion = require('../models/negociacion');
const Club = require('../models/club');
const Partida = require('../models/partida');

class IAFichajesCPU {
    static async procesarAccionesCPU(partidaId, fechaActual) {
        const mes = fechaActual.getMonth();
        const esMercado = (mes === 0 || mes === 6 || mes === 7);

        // Revisar renovaciones internas de la CPU
        await IAFichajesCPU.revisarRenovacionesCPU(partidaId, fechaActual);

        // Simular movimientos automáticos entre clubes de la CPU
        if (esMercado) {
            // Un 30% de probabilidad de que ocurra un movimiento entre CPUs cada día que avanzas
            if (Math.random() > 0.7) { 
                await IAFichajesCPU.simularMovimientosEntreCPU(partidaId);
            }
        }
    }

    static async intentarFicharAlUsuario(partidaId, clubUsuarioId) {
        // Cuántos jugadores hay en tu club
        const conteo = await Jugador.countDocuments({ 
            clubActual: clubUsuarioId, 
            partidaId 
        });

        if (conteo === 0) return;

        //Generar un índice aleatorio
        const randomIndex = Math.floor(Math.random() * conteo);

        //Obtener el jugador
        const miJugador = await Jugador.findOne({ 
            clubActual: clubUsuarioId, 
            partidaId 
        }).skip(randomIndex);

        if (miJugador /*&& Math.random() > 0.9*/) { 
            const clubComprador = await Club.findOne({ _id: { $ne: clubUsuarioId }, partidaId });
            if (!clubComprador) return;

            const esTraspaso = Math.random() > 0.4;
            const tipo = esTraspaso ? 'traspaso' : 'cesion';

            await Negociacion.create({
                partidaId,
                objetivoId: miJugador._id,
                tipoObjetivo: 'Jugador',
                clubEmisor: clubComprador._id,
                clubReceptor: clubUsuarioId,
                tipoOferta: tipo,
                ofertaTraspaso: esTraspaso ? Math.floor(miJugador.valorMercado * (0.9 + Math.random() * 0.2)) : 0,
                estadoTraspaso: 'negociando', 
                finalizada: false,
                ultimaModificacion: new Date()
            });
            
            console.log(`[IA] Oferta recibida: ${clubComprador.nombre} quiere a ${miJugador.nombre} (${tipo})`);
        }
    }

    static async simularMovimientosEntreCPU(partidaId) {
        const partida = await Partida.findById(partidaId).lean();
        const miClubId = partida.clubSeleccionado;

        // Elegir un comprador (que no sea el usuario)
        const clubes = await Club.find({ partidaId, _id: { $ne: miClubId } });
        if (clubes.length === 0) return;
        const comprador = clubes[Math.floor(Math.random() * clubes.length)];

        // Elegir un objetivo (que no sea del comprador ni del usuario)
        const objetivo = await Jugador.findOne({
            partidaId,
            clubActual: { $exists: true, $ne: comprador._id, $nin: [miClubId] },
            valorMercado: { $gt: 0 }
        }).sort({ valorMercado: 1 }); // Empezamos por jugadores asequibles

        if (!objetivo) return;

        const esTraspaso = comprador.presupuestoTraspasos >= (objetivo.valorMercado || 0) && Math.random() > 0.3;
        const vendedorId = objetivo.clubActual;

        // Crear el registro de Negociación
        await Negociacion.create({
            partidaId,
            objetivoId: objetivo._id,
            tipoObjetivo: 'Jugador',
            clubEmisor: comprador._id,
            clubReceptor: vendedorId,
            tipoOferta: esTraspaso ? 'traspaso' : 'cesion',
            ofertaTraspaso: esTraspaso ? objetivo.valorMercado : 0,
            estadoTraspaso: 'aceptado', 
            finalizada: true,
            ultimaModificacion: new Date()
        });

        if (esTraspaso) {
            // Actualizar presupuestos
            await Club.findByIdAndUpdate(comprador._id, { $inc: { presupuestoTraspasos: -objetivo.valorMercado } });
            await Club.findByIdAndUpdate(vendedorId, { $inc: { presupuestoTraspasos: objetivo.valorMercado } });
            
            // Cambiar club y renovar contrato 3 años
            const nuevaFecha = new Date();
            nuevaFecha.setFullYear(nuevaFecha.getFullYear() + 3);

            await Jugador.findByIdAndUpdate(objetivo._id, { 
                clubActual: comprador._id,
                finContrato: nuevaFecha,
                estadoClub: 'primerEquipo'
            });
        } else {
            // Caso de cesión
            await Jugador.findByIdAndUpdate(objetivo._id, { 
                clubActual: comprador._id,
                estadoClub: 'cedido' 
            });
        }

        console.log(`[IA - AUTO] Movimiento entre CPUs: ${objetivo.nombre} al ${comprador.nombre} (${esTraspaso ? 'Traspaso' : 'Cesión'})`);
    }

    static async revisarRenovacionesCPU(partidaId, fechaActual) {
        const partida = await Partida.findById(partidaId).lean();
        const miClubId = partida.clubSeleccionado;

        const seisMesesDespues = new Date(fechaActual);
        seisMesesDespues.setMonth(seisMesesDespues.getMonth() + 6);

        // Jugadores que terminan contrato pronto y no son del usuario
        const jugadoresAExpirar = await Jugador.find({
            partidaId,
            clubActual: { $ne: miClubId },
            finContrato: { $lte: seisMesesDespues }
        });

        for (let jugador of jugadoresAExpirar) {
            if (Math.random() > 0.5) { // 50% de probabilidad de que el club quiera renovarle
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