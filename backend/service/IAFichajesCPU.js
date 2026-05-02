const Jugador = require('../models/jugador');
const Negociacion = require('../models/negociacion');
const Club = require('../models/club');
const Partida = require('../models/partida');

class IAFichajesCPU {
    
    static generarCondicionesTraspaso(jugador) {
        const variacion = 0.8 + Math.random() * 0.4;
        return {
            precio: Math.floor(jugador.valorMercado * variacion),
            futuraVenta: Math.random() > 0.5 ? Math.floor(Math.random() * 15) + 5 : 0,
            precioRecompra: Math.random() > 0.75 ? Math.floor(jugador.valorMercado * 1.8) : 0
        };
    }

    static generarCondicionesCesion(jugador) {
        return {
            porcentajeSueldo: [50, 60, 70, 80, 100][Math.floor(Math.random() * 5)],
            clausulaCompra: Math.random() > 0.6 ? Math.floor(jugador.valorMercado * 1.2) : 0
        };
    }

    static async procesarRetornoCedidos(partidaId) {
        // Buscamos todos los jugadores que están en estado 'cedido'
        const cedidos = await Jugador.find({ partidaId, estadoClub: 'cedido' });

        for (let jugador of cedidos) {
            const ultimaCesion = await Negociacion.findOne({
                partidaId,
                objetivoId: jugador._id,
                tipoOferta: 'cesion',
                finalizada: true
            }).sort({ ultimaModificacion: -1 });

            if (ultimaCesion) {
                const clubOrigenId = ultimaCesion.clubReceptor;
                const fechaVuelta = jugador.fechaFinContratoOriginal || new Date();
                // Devolver al jugador a su club de origen
                await Jugador.findByIdAndUpdate(jugador._id, {
                    clubActual: clubOrigenId,
                    estadoClub: 'primerEquipo', 
                    rolEquipo: 'suplente',
                    finContrato: fechaVuelta,   
                    fechaFinContratoOriginal: null
                });

                await Club.findByIdAndUpdate(ultimaCesion.clubEmisor, { $pull: { plantilla: jugador._id } });
                await Club.findByIdAndUpdate(clubOrigenId, { $push: { plantilla: jugador._id } });
            }
        }
    }

    static async procesarAccionesCPU(partidaId, fechaActual, clubUsuarioId) {
        if (!clubUsuarioId) return;

        const dia = fechaActual.getDate();
        const mes = fechaActual.getMonth();
        const esMercado = [0, 6, 7].includes(mes);

        // LOGICA DE CAMBIO DE TEMPORADA (30 DE JUNIO)
        if (dia === 30 && mes === 5) {
            console.log("--- FINAL DE TEMPORADA: Procesando retornos y limpieza ---");
            await this.procesarRetornoCedidos(partidaId);
            await Negociacion.deleteMany({ partidaId });
        }
        // LOGICA DE CIERRE DE MERCADO (1 SEPT / 1 FEB) 
        if (dia === 1 && (mes === 8 || mes === 1)) {
            await Negociacion.deleteMany({ partidaId, finalizada: false });
        }

        // Renovaciones
        await this.revisarRenovacionesCPU(partidaId, fechaActual, clubUsuarioId);

        // Resolver negociaciones CPU-CPU
        await this.resolverNegociacionesPendientes(partidaId, clubUsuarioId, fechaActual);

        // Resolver contratos CPU-usuario
        await this.procesarDecisionesJugadores(partidaId, fechaActual);

        if (esMercado) {
            // Movimientos entre CPU
            const numIntentos = Math.floor(Math.random() * 6) + 3;
            for (let i = 0; i < numIntentos; i++) {
                await this.simularMovimientosEntreCPU(partidaId, clubUsuarioId, fechaActual);
            }

            // Intentar fichar al usuario
            const numOfertasAlUsuario = Math.floor(Math.random() * 5); 
            for (let i = 0; i < numOfertasAlUsuario; i++) {
                await this.intentarFicharAlUsuario(partidaId, clubUsuarioId, fechaActual);
            }
        }
    }

    static async intentarFicharAlUsuario(partidaId, clubUsuarioId, fechaActual) {
        if (!clubUsuarioId || !partidaId) return;

        const idUsuario = clubUsuarioId._id || clubUsuarioId;
        const idPartida = partidaId._id || partidaId;

        // Selección del Jugador (Priorizando transferibles)
        let candidatos = await Jugador.find({
            partidaId: idPartida,
            clubActual: idUsuario,
            $or: [{ "mercado.transferible": true }, { "mercado.cedible": true }]
        }).lean();

        let objetivo;
        let esDeLista = false;

        if (candidatos.length > 0 && Math.random() > 0.3) {
            objetivo = candidatos[Math.floor(Math.random() * candidatos.length)];
            esDeLista = true;
        } else {
            const todos = await Jugador.find({ partidaId: idPartida, clubActual: idUsuario }).lean();
            if (todos.length === 0) return;
            objetivo = todos[Math.floor(Math.random() * todos.length)];
        }

        // Probabilidad de éxito de la oferta (para no saturar)
        const probabilidad = esDeLista ? 0.8 : 0.15;
        if (Math.random() > probabilidad) return;

        // Selección aleatoria del Club Comprador
        const conteoClubes = await Club.countDocuments({ 
            partidaId: idPartida, 
            _id: { $ne: idUsuario },
            esFilial: false
        });
        if (conteoClubes === 0) return;

        const randomIndex = Math.floor(Math.random() * conteoClubes);
        const clubComprador = await Club.findOne({ 
            partidaId: idPartida, 
            _id: { $ne: idUsuario },
            esFilial: false
        }).skip(randomIndex);

        if (!clubComprador) return;

        const existe = await Negociacion.findOne({
            objetivoId: objetivo._id,
            clubEmisor: clubComprador._id,
            finalizada: false
        });
        if (existe) return;

        let esTraspaso = Math.random() > 0.3;
        if (objetivo.mercado?.transferible) esTraspaso = true;
        else if (objetivo.mercado?.cedible) esTraspaso = false;
        else if (objetivo.edad < 21 && Math.random() > 0.3) esTraspaso = false;

        const condiciones = esTraspaso ? 
            this.generarCondicionesTraspaso(objetivo) : 
            this.generarCondicionesCesion(objetivo);

        await Negociacion.create({
            partidaId: idPartida,
            objetivoId: objetivo._id,
            tipoObjetivo: 'Jugador',
            clubEmisor: clubComprador._id,
            clubReceptor: idUsuario,
            tipoOferta: esTraspaso ? 'traspaso' : 'cesion',
            ofertaTraspaso: esTraspaso ? condiciones.precio : condiciones.porcentajeSueldo,
            porcentajeVenta: condiciones.futuraVenta || 0,
            precioRecompra: condiciones.precioRecompra || 0,
            clausulaCompra: condiciones.clausulaCompra ? Math.floor(objetivo.valorMercado * 1.5) : 0,
            estadoTraspaso: 'negociando', 
            finalizada: false,
            leidaPorUsuario: false,
            ultimaModificacion: new Date(fechaActual)
        });

        console.log(`[IA -> USUARIO] ${clubComprador.nombre} oferta por ${objetivo.nombre}`);
    }

    static async simularMovimientosEntreCPU(partidaId, clubUsuarioId, fechaActual) {
        const idUsuario = clubUsuarioId._id || clubUsuarioId;
        const idPartida = partidaId._id || partidaId;

        const compradores = await Club.find({ 
            partidaId: idPartida, 
            _id: { $ne: idUsuario },
            esFilial: false 
        });
        const vendedores = await Club.find({ 
            partidaId: idPartida, 
            _id: { $ne: idUsuario } 
        });

        if (compradores.length < 1 || vendedores.length < 1) return;

        const comprador = compradores[Math.floor(Math.random() * compradores.length)];
        const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
        
        if (comprador._id.equals(vendedor._id)) return;

        const rep = comprador.reputacion || 45;
        const mediaObjetivoBase = 58 + ((rep - 45) * 0.55);
        
        const randomPerfil = Math.random();
        let requisitos = { 
            partidaId: idPartida, 
            clubActual: vendedor._id, 
            valorMercado: { $gt: 0 } 
        };

        if (randomPerfil > 0.3) {
            const rangoBajo = rep > 80 ? 13 : 9; 
            const rangoAlto = rep > 80 ? 13 : 11;
            requisitos.valoracion = { 
                $gte: Math.floor(mediaObjetivoBase - rangoBajo), 
                $lte: Math.floor(mediaObjetivoBase + rangoAlto)
            };
        } else {
            requisitos.edad = { $lte: 21 };
            requisitos.potencial = { $gte: mediaObjetivoBase - 2 }; 
        }

        const candidatos = await Jugador.find(requisitos);

        if (!candidatos || candidatos.length === 0) return;

        if (vendedor.esFilial && Math.random() > 0.25) return;

        const objetivo = candidatos[Math.floor(Math.random() * candidatos.length)];

        const existe = await Negociacion.findOne({
            objetivoId: objetivo._id,
            clubEmisor: comprador._id,
            finalizada: false
        });
        if (existe) return;
        
        const esTraspaso = Math.random() > 0.4;
        const condiciones = esTraspaso ? 
            this.generarCondicionesTraspaso(objetivo) : 
            this.generarCondicionesCesion(objetivo);

        await Negociacion.create({
            partidaId: idPartida,
            objetivoId: objetivo._id,
            tipoObjetivo: 'Jugador',
            clubEmisor: comprador._id,
            clubReceptor: vendedor._id,
            tipoOferta: esTraspaso ? 'traspaso' : 'cesion',
            ofertaTraspaso: esTraspaso ? condiciones.precio : condiciones.porcentajeSueldo,
            porcentajeVenta: condiciones.futuraVenta || 0,
            precioRecompra: condiciones.precioRecompra || 0,
            clausulaCompra: condiciones.clausulaCompra || 0,
            estadoTraspaso: 'negociando',
            finalizada: false,
            ultimaModificacion: new Date(fechaActual)
        });

        console.log(`[IA-IA] ${comprador.nombre} negocia por ${objetivo.nombre} (${randomPerfil > 0.3 ? 'Primer Equipo' : 'Promesa'})`);
    }

    static async resolverNegociacionesPendientes(partidaId, clubUsuarioId, fechaActual) {
        const idUsuario = clubUsuarioId._id || clubUsuarioId;

        const pendientes = await Negociacion.find({
            partidaId,
            finalizada: false,
            clubReceptor: { $ne: idUsuario }
        });

        for (let neg of pendientes) {
            if (Math.random() < 0.2) { 
                const objetivo = await Jugador.findById(neg.objetivoId);
                if (!objetivo) continue;

                const vendedor = await Club.findById(neg.clubReceptor);
                const valorReal = objetivo.valorMercado;
                const oferta = neg.ofertaTraspaso;
                let aceptada = false;

                if (neg.tipoOferta === 'traspaso') {
                    let umbralAceptacion = 0.85;

                    if (objetivo.rolEquipo === 'clave') umbralAceptacion += 0.20; 
                    if (objetivo.rolEquipo === 'importante') umbralAceptacion += 0.10;

                    if (vendedor && vendedor.reputacion > 80) {
                        umbralAceptacion += 0.15; 
                    }

                    const ratioAceptacion = oferta / valorReal;
                    if (ratioAceptacion >= umbralAceptacion) aceptada = true;
                    else if (ratioAceptacion < (umbralAceptacion - 0.30)) aceptada = false; 
                    else  aceptada = Math.random() > 0.85; 
                } else {
                    if (oferta >= 60) aceptada = true;
                    else if (oferta >= 40) aceptada = Math.random() > 0.7;
                    else aceptada = false;
                }

                if (aceptada) {
                    await this.ejecutarTraspasoEfectivo(neg, fechaActual);
                } else {
                    await Negociacion.findByIdAndUpdate(neg._id, { 
                        estadoTraspaso: 'rechazado', 
                        finalizada: true,
                        ultimaModificacion: new Date(fechaActual)
                    });
                    console.log(`[IA-RECHAZADO] ${objetivo.nombre}`);
                }
            }
        }
    }

    static async ejecutarTraspasoEfectivo(neg, fechaActual) {
        const objetivo = await Jugador.findById(neg.objetivoId);
        if (!objetivo) return;

        const esTraspaso = neg.tipoOferta === 'traspaso';
        const clubEmisor = await Club.findById(neg.clubEmisor); 
        const clubReceptor = await Club.findById(neg.clubReceptor);

        if (esTraspaso) {
            await Club.findByIdAndUpdate(neg.clubEmisor, { $inc: { "presupuestoTraspasos": -neg.ofertaTraspaso } });
            await Club.findByIdAndUpdate(neg.clubReceptor, { $inc: { "presupuestoTraspasos": neg.ofertaTraspaso } });
        }

        const plantillaComprador = await Jugador.find({ clubActual: neg.clubEmisor }).select('valoracion');
        const mediaPlantilla = plantillaComprador.reduce((acc, jug) => acc + jug.valoracion, 0) / (plantillaComprador.length || 1);

        let nuevoEstado = esTraspaso ? 'primerEquipo' : 'cedido';
        let nuevoRol = 'suplente';
        let clausula = 0;

        if (esTraspaso) {
            //rol
            const diferencia = objetivo.valoracion - mediaPlantilla;

            if (diferencia > 10) nuevoRol = 'clave';         
            else if (diferencia > 3) nuevoRol = 'importante'; 
            else if (diferencia > -5) nuevoRol = 'suplente'; 
            else if (objetivo.edad < 22) nuevoRol = 'promesa';
            else nuevoRol = 'reserva';        

            // Cláusula de rescisión
            if (Math.random() < 0.7) {
                clausula = Math.floor(objetivo.valorMercado * (1.5 + Math.random() * 1.5));
            }
        }
        let años = 4;
        if (objetivo.edad > 33) años = 1;
        else if (objetivo.edad > 30) años = 2;
        else if (objetivo.edad < 22) años = 5;

        const nuevaFechaFin = new Date(fechaActual);
        nuevaFechaFin.setFullYear(nuevaFechaFin.getFullYear() + (esTraspaso ? años : 1));
        const finContratoAntesCesion = objetivo.finContrato;

        await Jugador.findByIdAndUpdate(objetivo._id, {
            clubActual: neg.clubEmisor,
            finContrato: nuevaFechaFin,
            fechaFinContratoOriginal: !esTraspaso ? finContratoAntesCesion : 0,
            estadoClub: nuevoEstado,
            rolEquipo: nuevoRol,
            dorsal: null, 
            salario: esTraspaso ? Math.floor(objetivo.salario * 1.15) : objetivo.salario,
            "mercado.clausulaRescision": clausula,
            "mercado.transferible": false,
            "mercado.cedible": false,
            "estado.satisfaccion": 100,
            "estado.moral": 100
        });

        await Club.findByIdAndUpdate(neg.clubReceptor, { $pull: { plantilla: objetivo._id } });
        await Club.findByIdAndUpdate(neg.clubEmisor, { $push: { plantilla: objetivo._id } });

        await Negociacion.findByIdAndUpdate(neg._id, { 
            estadoTraspaso: 'aceptado', 
            finalizada: true,
            ultimaModificacion: new Date(fechaActual)
        });
        console.log(`[IA-PROCESADO] ${objetivo.nombre} fichado como ${nuevoEstado} por ${clubEmisor.nombre}`);
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
            if (Math.random() > 0.3) {
                const nuevaFecha = new Date(jugador.finContrato);
                nuevaFecha.setFullYear(nuevaFecha.getFullYear() + 3);

                let nuevoRol = jugador.rolEquipo;
                if (jugador.valoracion > 80) nuevoRol = 'clave';

                await Jugador.findByIdAndUpdate(jugador._id, {
                    finContrato: nuevaFecha,
                    salario: Math.floor((jugador.salario || 50000) * 1.2),
                    rolEquipo: nuevoRol,
                    "mercado.clausulaRescision": Math.floor(jugador.valorMercado * (2 + Math.random())),
                    "estado.satisfaccion": 100 
                });
            } else {
                await Jugador.findByIdAndUpdate(jugador._id, { "mercado.transferible": true });
            }
        }
    }

    static async procesarDecisionesJugadores(partidaId, fechaActual) {
        const negociaciones = await Negociacion.find({
            partidaId: partidaId,
            estadoTraspaso: 'esperando_jugador',
            fechaDecisionJugador: { $lte: fechaActual },
            finalizada: false
        }).populate('objetivoId clubEmisor clubReceptor');

        for (const neg of negociaciones) {
            const jugador = neg.objetivoId;
            
            let probabilidad = 0.7;

            const acepta = Math.random() < probabilidad;

            if (acepta) {
                await this.ejecutarTraspasoEfectivo(neg, fechaActual);
                
                neg.estadoContrato = 'aceptado';
                console.log("fichaje CPU-usuario aceptado");
            } else {
                neg.estadoContrato = 'rechazado';
                console.log("fichaje CPU-usuario rechazado");
            }
            
            neg.finalizada = true;
            neg.ultimaModificacion = fechaActual;
            await neg.save();
        }
    }
}

module.exports = IAFichajesCPU;