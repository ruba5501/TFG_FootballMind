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
        enum: ['traspaso', 'cesion'], 
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
        enum: ['no_iniciado', 'pendiente', 'aceptado', 'rechazado'], 
        default: 'pendiente' 
    },

    rondas: { 
        type: Number, 
        default: 0 
    },
    
    ofertaTraspaso: { type: Number, default: 0 },

    porcentajeFuturaVenta: { type: Number, default: 0 }, 
    precioRecompra: { type: Number, default: 0 },        
    clausulaCompra: { type: Number, default: 0 },

    estadoContrato: { 
        type: String, 
        enum: ['no_iniciado', 'negociando', 'aceptado', 'rechazado'], 
        default: 'no_iniciado' 
    },
    ofertaSueldo: { type: Number, default: 0 },
    ofertaAnios: { type: Number, default: 1 },
    
    clausulaRescision: { type: Number, default: 0 },
    rolPrometido: { type: String, default: 'Rotación' }, // Ej: Clave, Titular...

    fechaCreacion: { type: Date, default: Date.now },
    ultimaModificacion: { type: Date, default: Date.now },
    finalizada: { type: Boolean, default: false }

}, { 
    collection: 'negociaciones' 
});

// Índice compuesto para evitar que un club haga 2 ofertas activas por el mismo jugador
negociacionSchema.index({ objetivoId: 1, clubEmisor: 1, finalizada: 1 }, { unique: true });

module.exports = mongoose.model('Negociacion', negociacionSchema);