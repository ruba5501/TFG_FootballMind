const FORMACIONES = {
    '4-3-3': {
        def: 4, med: 3, del: 3,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'LI', 'MC', 'MC', 'MC', 'ED', 'DC', 'EI'],
        coordenadas: [
            {t:85, l:50}, // POR
            {t:70, l:15}, {t:75, l:38}, {t:75, l:62}, {t:70, l:85}, // Defensas
            {t:45, l:50}, {t:40, l:25}, {t:40, l:75}, // Medios
            {t:15, l:50}, {t:20, l:15}, {t:20, l:85}  // Delanteros
        ]
    },
    '4-3-3 (defensivo)': {
        def: 4, med: 3, del: 3,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'LI', 'MCD', 'MC', 'MC', 'ED', 'DC', 'EI'],
        coordenadas: [
            {t:85, l:50},
            {t:70, l:15}, {t:75, l:38}, {t:75, l:62}, {t:70, l:85}, 
            {t:55, l:50}, {t:40, l:25}, {t:40, l:75}, 
            {t:15, l:50}, {t:20, l:15}, {t:20, l:85} 
        ]
    },
    '4-3-3 (falso 9)': {
        def: 4, med: 3, del: 3,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'LI', 'MC', 'MC', 'MC', 'ED', 'SD', 'EI'],
        coordenadas: [
            {t:85, l:50},
            {t:70, l:15}, {t:75, l:38}, {t:75, l:62}, {t:70, l:85}, 
            {t:45, l:50}, {t:40, l:25}, {t:40, l:75},
            {t:20, l:50}, {t:20, l:15}, {t:20, l:85} 
        ]
    },
    '4-4-2': {
        def: 4, med: 4, del: 2,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'LI', 'MD', 'MC', 'MC', 'MI', 'DC', 'DC'],
        coordenadas: [
            {t:85, l:50}, 
            {t:70, l:15}, {t:75, l:38}, {t:75, l:62}, {t:70, l:85},
            {t:45, l:15}, {t:45, l:38}, {t:45, l:62}, {t:45, l:85},
            {t:20, l:35}, {t:20, l:65}
        ]
    },
    '4-2-3-1': {
        def: 4, med: 5, del: 1,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'LI', 'MC', 'MC', 'ED', 'MCO', 'EI', 'DC'],
        coordenadas: [
            {t:85, l:50},
            {t:72, l:15}, {t:75, l:38}, {t:75, l:62}, {t:72, l:85},
            {t:45, l:30}, {t:45, l:70}, 
            {t:20, l:15}, {t:30, l:50}, {t:20, l:85}, 
            {t:15, l:50} 
        ]
    },
    '4-2-3-1 (defensivo)': {
        def: 4, med: 5, del: 1,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'LI', 'MCD', 'MCD', 'MD', 'MCO', 'MI', 'DC'],
        coordenadas: [
            {t:85, l:50},
            {t:72, l:15}, {t:75, l:38}, {t:75, l:62}, {t:72, l:85},
            {t:55, l:30}, {t:55, l:70}, 
            {t:35, l:15}, {t:30, l:50}, {t:35, l:85}, 
            {t:15, l:50} 
        ]
    },
    '4-1-2-1-2': {
        def: 4, med: 5, del: 1,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'LI', 'MCD', 'MC', 'MC', 'MCO', 'DC', 'DC'],
        coordenadas: [
            {t:85, l:50},
            {t:72, l:15}, {t:75, l:38}, {t:75, l:62}, {t:72, l:85},
            {t:55, l:50},
            {t:40, l:20}, {t:40, l:80}, 
            {t:30, l:50},
            {t:20, l:35}, {t:20, l:65}
        ]
    },
    '5-2-1-2': {
        def: 4, med: 5, del: 1,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'DFC', 'LI', 'MC', 'MC', 'MCO', 'DC', 'DC'],
        coordenadas: [
            {t:85, l:50},
            {t:50, l:15}, {t:75, l:24}, {t:75, l:50}, {t:75, l:76}, {t:50, l:85},
            {t:40, l:25}, {t:40, l:75},
            {t:30, l:50},
            {t:20, l:35}, {t:20, l:65}
        ]
    },
    '5-3-2': {
        def: 4, med: 5, del: 1,
        posiciones: ['POR', 'LD', 'DFC', 'DFC', 'DFC', 'LI', 'MC', 'MC', 'MC', 'DC', 'DC'],
        coordenadas: [
            {t:85, l:50},
            {t:50, l:15}, {t:75, l:24}, {t:75, l:50}, {t:75, l:76}, {t:50, l:85},
            {t:45, l:50}, {t:40, l:25}, {t:40, l:75},
            {t:20, l:35}, {t:20, l:65}
        ]
    },
    '3-5-2': {
        def: 4, med: 5, del: 1,
        posiciones: ['POR', 'DFC', 'DFC', 'DFC', 'MD', 'MI', 'MC', 'MC', 'MC', 'DC', 'DC'],
        coordenadas: [
            {t:85, l:50},
            {t:75, l:24}, {t:75, l:50}, {t:75, l:76},
            {t:35, l:15}, {t:45, l:50}, {t:40, l:25}, {t:40, l:75}, {t:35, l:85},
            {t:20, l:35}, {t:20, l:65}
        ]
    },
    '3-2-2-3': {
        def: 4, med: 5, del: 1,
        posiciones: ['POR', 'DFC', 'DFC', 'DFC', 'MC', 'MC', 'EI', 'ED', 'SD', 'SD', 'DC'],
        coordenadas: [
            {t:85, l:50},
            {t:75, l:24}, {t:75, l:50}, {t:75, l:76},
            {t:45, l:30}, {t:45, l:70},
            {t:25, l:15}, {t:25, l:85},
            {t:15, l:50}, {t:20, l:35}, {t:20, l:65}
        ]
    }
};

module.exports = { FORMACIONES };