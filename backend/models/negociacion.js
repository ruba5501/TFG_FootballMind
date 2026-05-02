const mongoose = require('mongoose');

const negociacionSchema = new mongoose.Schema({
    partidaId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Partida', 
        required: true, 
        index: true 
    },
    
    tipoObjetivo: { 
        type: String, 
        enum: ['Jugador', 'Empleado'], 
        required: true 
    },

    tipoOferta: { 
        type: String, 
        enum: ['traspaso', 'cesion', 'renovacion'], 
        required: true 
    },

    objetivoId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        refPath: 'tipoObjetivo' 
    },

    clubEmisor: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    clubReceptor: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: false },

    estadoTraspaso: { 
        type: String, 
        enum: ['no_iniciado', 'negociando', 'aceptado', 'rechazado', 'esperando_jugador'], 
        default: 'negociando' 
    },

    rondas: { 
        type: Number, 
        default: 0 
    },
    rondasContrato: { 
        type: Number, 
        default: 0 
    },
    fechaDecisionJugador: { type: Date, default: null },
    ofertaTraspaso: { type: Number, default: null },
    contraofertaTraspaso: { type: Number, default: null },
    contraofertaSueldo: { type: Number, default: null },
    contraofertaAños: { type: Number, default: null },
    contraofertaRol: { type: String, default: '' },
    contraofertaPrima: { type: Number, default: null },
    tuContraofertaFuturaVenta: { type: Number, default: null },
    tuContraofertaRecompra: { type: Number, default: null },
    tuContraofertaClausulaCompra: { type: Number, default: null },
    


    porcentajeFuturaVenta: { type: Number, default: null }, 
    precioRecompra: { type: Number, default: null },        
    clausulaCompra: { type: Number, default: null },

    estadoContrato: { 
        type: String, 
        enum: ['no_iniciado', 'negociando', 'aceptado', 'rechazado'], 
        default: 'no_iniciado' 
    },
    ofertaSueldo: { type: Number, default: null },
    ofertaAnios: { type: Number, default: null },
    
    clausulaRescision: { type: Number, default: null },
    PrimaContrato: { type: Number, default: null },
    rolPrometido: { type: String, default: '' },

    fechaCreacion: { type: Date, default: Date.now },
    ultimaModificacion: { type: Date, default: Date.now },
    finalizada: { type: Boolean, default: false },
    basicoAceptado: { type: Boolean, default: false },
    basicoContratoAceptado: { type: Boolean, default: false }

}, { 
    collection: 'negociaciones' 
});

// Índice compuesto para evitar que un club haga 2 ofertas activas por el mismo jugador
negociacionSchema.index({ objetivoId: 1, clubEmisor: 1, finalizada: 1 }, { unique: true, partialFilterExpression: { finalizada: false } });

const Negociacion = mongoose.model('Negociacion', negociacionSchema);

(async () => {
    try {
        await Negociacion.collection.dropIndex("objetivoId_1_clubEmisor_1_finalizada_1");
    } catch (e) {
    }
})();

module.exports = Negociacion;