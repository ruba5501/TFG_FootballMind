const fs = require('fs');

// 1. CARGA DE DATOS
const clubesOriginales = JSON.parse(fs.readFileSync('./clubes_sin_datos.json', 'utf-8'));

// 2. DEFINICIÓN DE GRUPOS POR LIGAS Y TIERS

// --- ESPAÑA ---
const ESP_ELITE = ["Real Madrid", "FC Barcelona", "Atlético de Madrid"];
const ESP_MUY_ALTO = ["Athletic Club", "Villarreal CF", "Real Betis", "Real Sociedad"];
const ESP_ALTO = ["Rayo Vallecano", "Celta de Vigo", "Sevilla FC", "Valencia CF"];
const ESP_MEDIO_ALTO = ["CA Osasuna", "Girona FC", "RCD Mallorca", "Getafe CF", "RCD Espanyol"];
const ESP_MEDIO = ["Elche CF", "Levante UD", "Real Oviedo", "Deportivo Alavés", "UD Almería", "UD Las Palmas", "Real Valladolid CF", "CD Leganés"];
const ESP_MEDIO_BAJO = ["RC Deportivo de La Coruña", "Real Racing Club", "Real Sporting de Gijón", "Real Zaragoza", "Granada CF", "Cádiz CF", "SD Eibar", "Burgos CF", "Málaga CF"];
const ESP_BAJO = ["CD Mirandés", "CD Castellón", "Córdoba CF", "Albacete Balompié", "SD Huesca", "FC Andorra", "Cultural Leonesa", "AD Ceuta FC"];
// Nota: Real Sociedad B se maneja en la lógica de filiales

// --- INGLATERRA ---
const ENG_ELITE = ["Manchester City", "Liverpool FC", "Arsenal FC"];
const ENG_MUY_ALTO = ["Chelsea FC", "Manchester United", "Tottenham Hotspur", "Newcastle United", "Aston Villa"];
const ENG_ALTO = ["Brighton & Hove Albion", "West Ham United", "Everton FC", "Fulham FC", "AFC Bournemouth"];
const ENG_MEDIO_ALTO = ["Brentford FC", "Wolverhampton Wanderers", "Crystal Palace"];
const ENG_MEDIO = ["Nottingham Forest", "Sunderland AFC", "Leeds United", "Burnley FC", "Leicester City", "Southampton FC", "Ipswich Town"];
const ENG_MEDIO_BAJO = ["Sheffield United", "Middlesbrough FC", "Norwich City", "West Bromwich Albion", "Watford FC", "Hull City", "Coventry City", "Stoke City", "Swansea City"];
const ENG_BAJO = ["Birmingham City", "Bristol City", "Millwall FC", "Wrexham AFC", "Derby County", "Queens Park Rangers", "Preston North End", "Portsmouth FC", "Blackburn Rovers", "Oxford United", "Charlton Athletic", "Sheffield Wednesday"];

// --- ITALIA ---
const ITA_ELITE = ["Inter de Milán"];
const ITA_MUY_ALTO = ["Juventus de Turín", "SSC Nápoles", "AC Milan"];
const ITA_ALTO = ["Atalanta de Bérgamo", "AS Roma", "SS Lazio", "Como 1907"];
const ITA_MEDIO_ALTO = ["Fiorentina", "Bolonia", "Torino FC", "Genoa", "Parma", "Udinese", "US Sassuolo", "Cagliari"];
const ITA_MEDIO = ["Hellas Verona", "US Lecce", "Pisa Sporting Club", "US Cremonese", "AC Monza", "Empoli FC", "Venezia FC"];
const ITA_MEDIO_BAJO = ["Palermo FC", "Spezia", "UC Sampdoria", "Frosinone Calcio", "US Catanzaro", "Cesena FC", "Modena FC"];
const ITA_BAJO = ["SS Juve Stabia", "AC Reggiana 1919", "SSC Bari", "Carrarese Calcio 1908", "Delfino Pescara 1936", "US Avellino 1912", "Mantova 1911", "FC Südtirol", "Calcio Padova", "Virtus Entella"];

// --- ALEMANIA ---
const GER_ELITE = ["Bayern Múnich"];
const GER_ALTO = ["Borussia Dortmund", "Bayer 04 Leverkusen", "RB Leipzig"];
const GER_MEDIO_ALTO = ["Eintracht Fráncfort", "VfB Stuttgart", "SV Werder Bremen", "TSG 1899 Hoffenheim", "SC Friburgo", "Borussia Mönchengladbach"];
const GER_MEDIO = ["VfL Wolfsburgo", "1.FSV Mainz 05", "FC Augsburgo", "1.FC Unión Berlín"];
const GER_MEDIO_BAJO = ["FC St. Pauli","1.FC Heidenheim 1846","Hamburgo SV", "FC Colonia", "Holstein Kiel", "VfL Bochum"];
const GER_BAJO = ["Hertha Berlín", "1. FC Núremberg", "Hannover 96", "Fortuna Düsseldorf", "FC Schalke 04", "SC Paderborn 07", "1.FC Magdeburg", "1.FC Kaiserslautern", "SV Darmstadt 98", "Karlsruher SC", "SV 07 Elversberg"];
const GER_MUY_BAJO = ["Eintracht Braunschweig", "Preußen Münster", "SpVgg Greuther Fürth", "Arminia Bielefeld", "SG Dynamo Dresden"];

// --- FRANCIA ---
const FRA_ELITE = ["Paris Saint-Germain FC"];
const FRA_ALTO = ["Olympique de Marsella", "AS Mónaco", "LOSC Lille", "Olympique de Lyon"];
const FRA_MEDIO_ALTO = ["OGC Niza", "Stade Rennais FC", "RC Lens", "Stade Brestois 29"];
const FRA_MEDIO = ["Racing Club de Estrasburgo", "Toulouse FC", "FC Nantes", "FC Metz"];
const FRA_MEDIO_BAJO = ["AJ Auxerre", "Angers SCO", "Le Havre AC", "FC Lorient", "Paris FC", "AS Saint-Étienne", "Stade de Reims", "Montpellier HSC", "USL Dunkerque"];
const FRA_BAJO = ["ESTAC Troyes", "Amiens SC", "EA Guingamp", "Clermont Foot 63", "FC Annecy", "Grenoble Foot 38", "Pau FC", "Le Mans FC"];
const FRA_MUY_BAJO = ["Red Star FC", "SC Bastia", "Rodez AF", "AS Nancy-Lorraine", "Stade Lavallois", "US Boulogne"];

// --- HOLANDA ---
const NED_ALTO = ["PSV Eindhoven", "Feyenoord", "Ajax de Ámsterdam"];
const NED_MEDIO_ALTO = ["AZ Alkmaar", "FC Utrecht", "FC Twente Enschede"];
const NED_MEDIO = ["SC Heerenveen", "NEC Nijmegen", "FC Groningen", "Go Ahead Eagles Deventer", "Sparta Rotterdam"];
const NED_MEDIO_BAJO = ["PEC Zwolle", "Fortuna Sittard", "Excelsior Rotterdam", "NAC Breda", "Heracles Almelo", "FC Volendam", "SC Telstar"];
const NED_BAJO = [ "Willem II Tilburg", "Almere City FC", "RKC Waalwijk", "SC Cambuur Leeuwarden", "ADO Den Haag", "FC Emmen", "De Graafschap Doetinchem"];
const NED_MUY_BAJO = ["Vitesse Arnhem", "Roda JC Kerkrade","FC Dordrecht", "FC Den Bosch", "Helmond Sport", "MVV Maastricht", "TOP Oss", "VVV-Venlo", "FC Eindhoven"];
// Nota: Ajax U21, PSV U21, Utrecht U21, AZ U21 son filiales.

// --- PORTUGAL ---
const POR_ALTO = ["Sporting de Lisboa", "FC Oporto", "SL Benfica"];
const POR_MEDIO_ALTO = ["SC Braga", "Vitória Guimarães SC"];
const POR_MEDIO = ["FC Famalicão", "Rio Ave FC", "CD Santa Clara", "Gil Vicente FC", "Moreirense FC", "FC Arouca"];
const POR_MEDIO_BAJO = ["GD Estoril Praia", "Casa Pia AC", "CD Nacional", "Avs Futebol", "CF Estrela Amadora", "SC Farense", "CD Tondela"];
const POR_BAJO = ["FC Alverca", "UD Leiria", "CS Marítimo", "Académico Viseu FC", "FC Vizela", "SC União Torreense", "GD Chaves", "CD Feirense"];
const POR_MUY_BAJO = ["FC Penafiel", "Portimonense SAD", "FC Felgueiras 1932", "Leixões SC", "FC Paços de Ferreira", "UD Oliveirense", "Lusitânia FC Lourosa"];
// Nota: Benfica II, Oporto II, Sporting de Lisboa II son filiales.

// --- SUDAMÉRICA ---
const SUD_ALTO = ["CA River Plate", "CA Boca Juniors", "SE Palmeiras", "CR Flamengo"];
const SUD_MEDIO = ["Racing Club", "CA Independiente", "CA Vélez Sarsfield", "Club Estudiantes de La Plata", "CA Talleres", "Cruzeiro Esporte Clube", "Botafogo de Futebol e Regatas", "Clube de Regatas Vasco da Gama", "SC Corinthians", "Esporte Clube Bahia", "Fluminense Football Club", "Red Bull Bragantino", "Clube Atlético Mineiro", "Santos FC", "Grêmio Foot-Ball Porto Alegre", "São Paulo FC", "Sport Club Internacional", "Fortaleza Esporte Clube"];
const SUD_BAJO = ["CA Rosario Central", "AA Argentinos Juniors", "CA San Lorenzo de Almagro", "CA Lanús", "CA Belgrano", "CD Godoy Cruz Antonio Tomba", "CA Huracán", "CA Tigre", "CSD Defensa y Justicia", "CA Platense", "Instituto ACC", "CA Unión (Santa Fe)", "CS Independiente Rivadavia", "CA Barracas Central", "CA Newell's Old Boys", "CA Central Córdoba (SdE)", "CA Banfield", "Club de Gimnasia y Esgrima La Plata", "Club Atlético Tucumán", "CA Sarmiento (Junín)", "CA Aldosivi", "CA San Martín (San Juan)", "Club Deportivo Riestra", "Sport Club do Recife", "Ceará Sporting Club", "Esporte Clube Vitória", "Mirassol Futebol Clube (SP)", "Esporte Clube Juventude"];

// Agrupación de Tiers Globales
const CLUBES_ELITE = [...ESP_ELITE, ...ENG_ELITE, ...ITA_ELITE, ...GER_ELITE, ...FRA_ELITE];
const CLUBES_MUY_ALTO = [...ESP_MUY_ALTO, ...ENG_MUY_ALTO, ...ITA_MUY_ALTO];
const CLUBES_ALTO = [...ESP_ALTO, ...ENG_ALTO, ...ITA_ALTO, ...GER_ALTO, ...FRA_ALTO, ...NED_ALTO, ...POR_ALTO, ...SUD_ALTO];
const CLUBES_MEDIO_ALTO = [...ESP_MEDIO_ALTO, ...ENG_MEDIO_ALTO, ...ITA_MEDIO_ALTO, ...GER_MEDIO_ALTO, ...FRA_MEDIO_ALTO, ...NED_MEDIO_ALTO, ...POR_MEDIO_ALTO];
const CLUBES_MEDIO = [...ESP_MEDIO, ...ENG_MEDIO, ...ITA_MEDIO, ...GER_MEDIO, ...FRA_MEDIO, ...NED_MEDIO, ...POR_MEDIO, ...SUD_MEDIO];
const CLUBES_MEDIO_BAJO = [...ESP_MEDIO_BAJO, ...ENG_MEDIO_BAJO, ...ITA_MEDIO_BAJO, ...GER_MEDIO_BAJO, ...FRA_MEDIO_BAJO, ...NED_MEDIO_BAJO, ...POR_MEDIO_BAJO];
const CLUBES_BAJO = [...ESP_BAJO, ...ENG_BAJO, ...ITA_BAJO, ...GER_BAJO, ...FRA_BAJO, ...NED_BAJO, ...POR_BAJO, ...SUD_BAJO];
const CLUBES_MUY_BAJO = [...GER_MUY_BAJO, ...FRA_MUY_BAJO, ...NED_MUY_BAJO, ...POR_MUY_BAJO];

const redondearPresupuesto = (num) => {
    if (num >= 10000000) return Math.round(num / 1000000) * 1000000; 
    if (num >= 1000000) return Math.round(num / 500000) * 500000;   
    if (num >= 500000) return Math.round(num / 100000) * 100000;   
    return Math.round(num / 50000) * 50000;                         
};

const generarDatosUniversales = (clubes) => {
    const base = clubes.map(club => {
        const n = club.nombre;
        const esSudamericano = (club.pais === "Argentina" || club.pais === "Brasil");
        const compiteEnLiga = club.competiciones && club.competiciones.length > 0;
        
        let rango = { rep: [35, 45], pop: [30, 45], ppto: [400000, 900000] }; 

        if (CLUBES_ELITE.includes(n)) rango = { rep: [90, 92], pop: [91, 94], ppto: [75000000, 100000000] };
        else if (CLUBES_MUY_ALTO.includes(n)) rango = { rep: [86, 89], pop: [78, 88], ppto: [35000000, 55000000] };
        else if (CLUBES_ALTO.includes(n)) rango = { rep: [80, 85], pop: [78, 88], ppto: [20000000, 35000000] };
        else if (CLUBES_MEDIO_ALTO.includes(n)) rango = { rep: [74, 79], pop: [70, 83], ppto: [5000000, 12000000] };
        else if (CLUBES_MEDIO.includes(n)) rango = { rep: [68, 73], pop: [70, 83], ppto: [4000000, 8000000] };
        else if (CLUBES_MEDIO_BAJO.includes(n)) rango = { rep: [63, 67], pop: [65, 80], ppto: [2500000, 4000000] };
        else if (CLUBES_BAJO.includes(n)) rango = { rep: [58, 62], pop: [53, 71], ppto: [700000, 2000000] };
        else if (CLUBES_MUY_BAJO.includes(n)) rango = { rep: [52, 57], pop: [40, 60], ppto: [200000, 600000] };

        if (club.esFilial && compiteEnLiga) {
            rango = { rep: [52, 62], pop: [50, 60], ppto: [0, 0] }; 
        }

        if (esSudamericano) {
            rango.ppto = [rango.ppto[0] * 0.35, rango.ppto[1] * 0.45];
            rango.pop = [rango.pop[0] + 5, Math.min(rango.pop[1] + 10, 98)];
        }

        const rep = Math.floor(Math.random() * (rango.rep[1] - rango.rep[0] + 1)) + rango.rep[0];
        const pop = Math.floor(Math.random() * (rango.pop[1] - rango.pop[0] + 1)) + rango.pop[0];
        const pptoRaw = Math.floor(Math.random() * (rango.ppto[1] - rango.ppto[0] + 1)) + rango.ppto[0];
        
        const pptoFinal = redondearPresupuesto(pptoRaw);
        const nivelInfra = rep > 87 ? 5 : (rep > 76 ? 4 : (rep > 62 ? 3 : (rep > 48 ? 2 : 1)));
        let nivelCantera;
        const azarCantera = Math.random();
        if (rep >= 90) {
            if (azarCantera > 0.10) nivelCantera = 5;
            else nivelCantera = 4;
        }
        else if (rep > 85) {
            if (azarCantera > 0.80) nivelCantera = 5;
            else if (azarCantera > 0.60) nivelCantera = 4;
            else if (azarCantera > 0.10) nivelCantera = 3;
            else nivelCantera = 2;
        } else if (rep > 70) { 
            if (azarCantera > 0.90) nivelCantera = 5;
            else if (azarCantera > 0.75) nivelCantera = 4;
            else if (azarCantera > 0.35) nivelCantera = 3;
            else if (azarCantera > 0.05) nivelCantera = 2;
            else nivelCantera = 1;
        } else {
            if (azarCantera > 0.95) nivelCantera = 5;
            else if (azarCantera > 0.85) nivelCantera = 4;
            else if (azarCantera > 0.65) nivelCantera = 3;
            else if (azarCantera > 0.25) nivelCantera = 2;
            else nivelCantera = 1;
        }
        nivelCantera = Math.max(1, nivelCantera || 1);

        return {
            ...club,
            presupuestoTraspasos: pptoFinal,
            presupuestoSalarios: redondearPresupuesto(pptoFinal * 1.5),
            infraestructuras: { entrenamiento: nivelInfra, cantera: nivelCantera },
            popularidad: pop,
            reputacion: rep,
            statsTemporada: [],
            listaObjetivos: [],
            listaObjetivosEmpleados: []
        };
    });

    let nuevosFiliales = [];
    base.forEach(club => {
        if (!club.esFilial) {
           const yaTieneFilial = base.some(c => c.clubMatriz === club.nombre && c.esFilial);

            if (!yaTieneFilial) {
                const tablaRep = { 1: 48, 2: 52, 3: 57, 4: 62, 5: 67 };
                let repFilial = tablaRep[club.infraestructuras.cantera] + (Math.floor(Math.random() * 5) - 2);
                repFilial = Math.max(48, Math.min(70, repFilial));
                
                nuevosFiliales.push({
                    nombre: club.nombre + " B",
                    ciudad: club.ciudad,
                    pais: club.pais,
                    estadio: "",
                    competiciones: [], 
                    esFilial: true,
                    clubMatriz: club.nombre,
                    presupuestoTraspasos: 0,
                    presupuestoSalarios: 0,
                    ingresos: { entradas: 0, television: 0, merchandising: 0 },
                    plantilla: [],
                    empleados: [],
                    infraestructuras: { ...club.infraestructuras }, 
                    escudo: club.escudo,
                    popularidad: Math.floor(club.popularidad * 0.7),
                    reputacion: repFilial,
                    historialTitulos: [],
                    statsTemporada: [],
                });
            }
        }
    });

    return [...base, ...nuevosFiliales];
};

const resultado = generarDatosUniversales(clubesOriginales);

let jsonString = JSON.stringify(resultado, null, 2);
jsonString = jsonString.replace(/"competiciones": \[\s+([\s\S]*?)\s+\]/g, (match, p1) => {
    const items = p1.trim().replace(/\n\s+/g, ' ');
    return `"competiciones": [ ${items} ]`;
});

fs.writeFileSync('./clubes.json', jsonString);
console.log(`¡Proceso finalizado! Total: ${resultado.length} equipos.`);