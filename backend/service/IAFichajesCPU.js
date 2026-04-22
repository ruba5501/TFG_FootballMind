const Jugador = require('../models/jugador');
const Negociacion = require('../models/negociacion');
const Club = require('../models/club');

class IAFichajesCPU {
    static async procesarAccionesCPU(partidaId, fechaActual) {
        const mes = fechaActual.getMonth();
    const esMercado = (mes === 0 || mes === 6 || mes === 7);

    // mira si el club tiene que renovar a algun jugador
    await revisarRenovacionesCPU(partidaId);

    // mira para intentar hacer fichajes en mercado de fichajes
    if (esMercado) {
        if (Math.random() > 0.7) { 
            await simularTraspasosEntreCPU(partidaId);
        }
    }
    }

    static async intentarFicharAlUsuario(partidaId, clubUsuarioId) {
        const miJugador = await Jugador.findOne({ clubActual: clubUsuarioId, partidaId }).sort({ valor: -1 });
    
        if (miJugador && Math.random() > 0.9) { // Baja probabilidad para no agobiar
            const clubComprador = await Club.findOne({ _id: { $ne: clubUsuarioId }, partidaId });

            await Negociacion.create({
                partidaId,
                objetivoId: miJugador._id,
                tipoObjetivo: 'Jugador',
                clubEmisor: clubComprador._id,
                clubReceptor: clubUsuarioId, 
                ofertaTraspaso: miJugador.valor * 1.1,
                estadoTraspaso: 'pendiente', 
                finalizada: false
            });
        }
    }

    static async revisarRenovacionesCPU(partidaId, fechaActual) {
        // Buscamos jugadores de la CPU que terminan contrato en menos de 6 meses
        const seisMesesDespues = new Date(fechaActual);
        seisMesesDespues.setMonth(seisMesesDespues.getMonth() + 6);

        const jugadoresAExpirar = await Jugador.find({
            partidaId,
            clubActual: { $ne: null }, // Que tengan club
            finContrato: { $lte: seisMesesDespues }
        });

        for (let jugador of jugadoresAExpirar) {
            // No renovamos a los del usuario aquí, solo CPU (esto es simple, se puede pulir)
            // Si el jugador es importante (ej: valor alto), la CPU le sube el sueldo y suma 2 años
            if (Math.random() > 0.5) { 
                const nuevoAnio = jugador.finContrato.getFullYear() + 2;
                const nuevaFecha = new Date(jugador.finContrato);
                nuevaFecha.setFullYear(nuevoAnio);
                
                await Jugador.findByIdAndUpdate(jugador._id, {
                    finContrato: nuevaFecha,
                    salario: Math.floor(jugador.salario * 1.1) // 10% aumento
                });
            }
        }
    }

    static async simularTraspasosEntreCPU(partidaId) {
        // 1. Elegir un club comprador al azar
        const clubes = await Club.find({ partidaId });
        const comprador = clubes[Math.floor(Math.random() * clubes.length)];

        // 2. Elegir un jugador de otro club (que no sea el comprador ni el usuario)
        // Para simplificar, buscamos un jugador transferible o al azar
        const objetivo = await Jugador.findOne({
            partidaId,
            clubActual: { $exists: true, $ne: comprador._id }
        }).sort({ valor: 1 });

        if (objetivo && comprador.presupuestoTraspasos >= objetivo.valor) {
            // 3. Ejecutar traspaso directo (CPU a CPU no necesita negociar visualmente)
            const vendedorId = objetivo.clubActual;

            // Actualizar presupuestos
            await Club.findByIdAndUpdate(comprador._id, { $inc: { presupuestoTraspasos: -objetivo.valor } });
            await Club.findByIdAndUpdate(vendedorId, { $inc: { presupuestoTraspasos: objetivo.valor } });

            // Mover jugador
            await Jugador.findByIdAndUpdate(objetivo._id, { 
                clubActual: comprador._id,
                finContrato: new Date(new Date().setFullYear(new Date().getFullYear() + 3)) // 3 años contrato
            });
        }
    }
}

module.exports = IAFichajesCPU;