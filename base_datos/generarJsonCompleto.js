const fs = require('fs');

// 1. CARGA DE DATOS
const clubesOriginales = JSON.parse(fs.readFileSync('./clubes_sin_datos.json', 'utf-8'));

// 2. DEFINICIÓN DE GRUPOS POR LIGAS Y TIERS

// --- ESPAÑA ---
const ESP_ELITE = ["Real Madrid", "FC Barcelona", "Atlético de Madrid"];
const ESP_ALTO = ["Real Sociedad", "Athletic Club", "Villarreal CF", "Real Betis"];
const ESP_MEDIO_ALTO = ["Sevilla FC", "Valencia CF", "CA Osasuna", "Celta de Vigo", "Girona FC", "RCD Mallorca", "Getafe CF", "Rayo Vallecano", "RCD Espanyol"];
const ESP_MEDIO_BAJO = ["Deportivo Alavés", "Elche CF", "Levante UD", "Real Oviedo", "UD Almería", "UD Las Palmas", "Real Valladolid CF", "CD Leganés"];
const ESP_BAJO = ["RC Deportivo de La Coruña", "Real Racing Club", "Real Sporting de Gijón", "Real Zaragoza", "Granada CF", "Cádiz CF", "SD Eibar", "Málaga CF"];
const ESP_MUY_BAJO = ["CD Mirandés", "Burgos CF", "CD Castellón", "Córdoba CF", "Albacete Balompié", "SD Huesca", "FC Andorra", "Cultural Leonesa", "AD Ceuta FC"];
// Nota: Real Sociedad B se maneja en la lógica de filiales

// --- INGLATERRA ---
const ENG_ELITE = ["Manchester City", "Liverpool FC", "Arsenal FC"];
const ENG_ALTO = ["Chelsea FC", "Manchester United", "Tottenham Hotspur", "Newcastle United", "Aston Villa"];
const ENG_MEDIO_ALTO = ["Brighton & Hove Albion", "West Ham United", "Everton FC", "Fulham FC", "Wolverhampton Wanderers", "Crystal Palace", "AFC Bournemouth"];
const ENG_MEDIO_BAJO = ["Nottingham Forest", "Brentford FC", "Sunderland AFC", "Leeds United", "Burnley FC", "Leicester City", "Southampton FC", "Ipswich Town"];
const ENG_BAJO = ["Sheffield United", "Middlesbrough FC", "Norwich City", "West Bromwich Albion", "Watford FC", "Hull City", "Coventry City", "Stoke City", "Swansea City"];
const ENG_MUY_BAJO = ["Birmingham City", "Bristol City", "Millwall FC", "Wrexham AFC", "Derby County", "Queens Park Rangers", "Preston North End", "Portsmouth FC", "Blackburn Rovers", "Oxford United", "Charlton Athletic", "Sheffield Wednesday"];

// --- ITALIA ---
const ITA_ELITE = ["Inter de Milán"];
const ITA_ALTO = [ "Juventus de Turín", "SSC Nápoles", "AC Milan", "Atalanta de Bérgamo", "AS Roma", "SS Lazio"];
const ITA_MEDIO_ALTO = ["Fiorentina", "Bolonia", "Torino FC", "Genoa", "Como 1907"];
const ITA_MEDIO_BAJO = ["Parma", "Udinese", "US Sassuolo", "Cagliari", "Hellas Verona", "AC Monza", "Empoli FC"];
const ITA_BAJO = ["Pisa Sporting Club", "US Cremonese", "US Lecce", "Venezia FC", "Palermo FC", "Spezia", "UC Sampdoria", "Frosinone Calcio"];
const ITA_MUY_BAJO = ["US Catanzaro", "Cesena FC", "Modena FC", "SS Juve Stabia", "AC Reggiana 1919", "SSC Bari", "Carrarese Calcio 1908", "Delfino Pescara 1936", "US Avellino 1912", "Mantova 1911", "FC Südtirol", "Calcio Padova", "Virtus Entella"];

// --- ALEMANIA ---
const GER_ELITE = ["Bayern Múnich"];
const GER_ALTO = ["Borussia Dortmund", "Bayer 04 Leverkusen", "RB Leipzig", "VfB Stuttgart"];
const GER_MEDIO_ALTO = ["Eintracht Fráncfort", "VfL Wolfsburgo", "SV Werder Bremen", "TSG 1899 Hoffenheim", "SC Friburgo", "Borussia Mönchengladbach"];
const GER_MEDIO_BAJO = ["1.FSV Mainz 05", "FC Augsburgo", "1.FC Unión Berlín", "1.FC Heidenheim 1846", "Hamburgo SV", "FC Colonia", "FC St. Pauli"];
const GER_BAJO = ["Hertha Berlín", "Holstein Kiel", "VfL Bochum", "1. FC Núremberg", "Hannover 96", "Fortuna Düsseldorf", "FC Schalke 04"];
const GER_MUY_BAJO = ["SC Paderborn 07", "1.FC Magdeburg", "1.FC Kaiserslautern", "SV Darmstadt 98", "Karlsruher SC", "SV 07 Elversberg", "SpVgg Greuther Fürth", "Eintracht Braunschweig", "Preußen Münster", "Arminia Bielefeld", "SG Dynamo Dresden"];

// --- FRANCIA ---
const FRA_ELITE = ["Paris Saint-Germain FC"];
const FRA_ALTO = ["Olympique de Marsella", "AS Mónaco", "LOSC Lille", "Olympique de Lyon"];
const FRA_MEDIO_ALTO = ["OGC Niza", "Stade Rennais FC", "RC Lens", "Stade Brestois 29"];
const FRA_MEDIO_BAJO = ["Racing Club de Estrasburgo", "Toulouse FC", "FC Nantes", "AJ Auxerre", "FC Lorient", "FC Metz", "Stade de Reims", "Montpellier HSC"];
const FRA_BAJO = ["Paris FC", "Le Havre AC", "Angers SCO", "AS Saint-Étienne", "ESTAC Troyes", "Amiens SC", "EA Guingamp", "Clermont Foot 63"];
const FRA_MUY_BAJO = ["USL Dunkerque", "Red Star FC", "Pau FC", "Grenoble Foot 38", "SC Bastia", "Rodez AF", "AS Nancy-Lorraine", "FC Annecy", "Stade Lavallois", "Le Mans FC", "US Boulogne"];

// --- HOLANDA ---
const NED_ALTO = ["PSV Eindhoven", "Feyenoord", "Ajax de Ámsterdam"];
const NED_MEDIO_ALTO = ["AZ Alkmaar", "FC Utrecht", "FC Twente Enschede"];
const NED_MEDIO_BAJO = ["SC Heerenveen", "NEC Nijmegen", "FC Groningen", "Go Ahead Eagles Deventer", "Sparta Rotterdam", "Willem II Tilburg"];
const NED_BAJO = ["PEC Zwolle", "Fortuna Sittard", "Excelsior Rotterdam", "NAC Breda", "Heracles Almelo", "FC Volendam", "Vitesse Arnhem", "Almere City FC", "RKC Waalwijk", "SC Cambuur Leeuwarden", "ADO Den Haag", "Roda JC Kerkrade", "FC Emmen", "De Graafschap Doetinchem"];
const NED_MUY_BAJO = ["SC Telstar", "FC Dordrecht", "FC Den Bosch", "Helmond Sport", "MVV Maastricht", "TOP Oss", "VVV-Venlo", "FC Eindhoven"];
// Nota: Ajax U21, PSV U21, Utrecht U21, AZ U21 son filiales.

// --- PORTUGAL ---
const POR_ALTO = ["Sporting de Lisboa", "FC Oporto", "SL Benfica"];
const POR_MEDIO_ALTO = ["SC Braga", "Vitória Guimarães SC"];
const POR_MEDIO_BAJO = ["FC Famalicão", "Rio Ave FC", "CD Santa Clara", "Gil Vicente FC", "Moreirense FC", "FC Arouca", "Vitória Guimarães SC"];
const POR_BAJO = ["GD Estoril Praia", "FC Alverca", "Casa Pia AC", "CD Tondela", "CD Nacional", "Avs Futebol", "CF Estrela Amadora", "UD Leiria", "CS Marítimo", "Académico Viseu FC"];
const POR_MUY_BAJO = ["GD Chaves", "SC União Torreense", "SC Farense", "FC Penafiel", "FC Vizela", "Portimonense SAD", "FC Felgueiras 1932", "Leixões SC", "FC Paços de Ferreira", "CD Feirense", "UD Oliveirense", "Lusitânia FC Lourosa"];

// --- SUDAMÉRICA ---
const SUD_ALTO = ["CA River Plate", "CA Boca Juniors", "SE Palmeiras", "CR Flamengo"];
const SUD_MEDIO = ["Racing Club", "CA Independiente", "CA Vélez Sarsfield", "Club Estudiantes de La Plata", "CA Talleres", "Cruzeiro Esporte Clube", "Botafogo de Futebol e Regatas", "Clube de Regatas Vasco da Gama", "SC Corinthians", "Esporte Clube Bahia", "Fluminense Football Club", "Red Bull Bragantino", "Clube Atlético Mineiro", "Santos FC", "Grêmio Foot-Ball Porto Alegre", "São Paulo FC", "Sport Club Internacional", "Fortaleza Esporte Clube"];
const SUD_BAJO = ["CA Rosario Central", "AA Argentinos Juniors", "CA San Lorenzo de Almagro", "CA Lanús", "CA Belgrano", "CD Godoy Cruz Antonio Tomba", "CA Huracán", "CA Tigre", "CSD Defensa y Justicia", "CA Platense", "Instituto ACC", "CA Unión (Santa Fe)", "CS Independiente Rivadavia", "CA Barracas Central", "CA Newell's Old Boys", "CA Central Córdoba (SdE)", "CA Banfield", "Club de Gimnasia y Esgrima La Plata", "Club Atlético Tucumán", "CA Sarmiento (Junín)", "CA Aldosivi", "CA San Martín (San Juan)", "Club Deportivo Riestra", "Sport Club do Recife", "Ceará Sporting Club", "Esporte Clube Vitória", "Mirassol Futebol Clube (SP)", "Esporte Clube Juventude"];

// Agrupación de Tiers Globales
const CLUBES_ELITE = [...ESP_ELITE, ...ENG_ELITE, ...ITA_ELITE, ...GER_ELITE, ...FRA_ELITE];
const CLUBES_ALTO = [...ESP_ALTO, ...ENG_ALTO, ...ITA_ALTO, ...GER_ALTO, ...FRA_ALTO, ...NED_ALTO, ...POR_ALTO, ...SUD_ALTO];
const CLUBES_MEDIO_ALTO = [...ESP_MEDIO_ALTO, ...ENG_MEDIO_ALTO, ...ITA_MEDIO_ALTO, ...GER_MEDIO_ALTO, ...FRA_MEDIO_ALTO, ...NED_MEDIO_ALTO, ...POR_MEDIO_ALTO, ...SUD_MEDIO];
const CLUBES_MEDIO_BAJO = [...ESP_MEDIO_BAJO, ...ENG_MEDIO_BAJO, ...ITA_MEDIO_BAJO, ...GER_MEDIO_BAJO, ...FRA_MEDIO_BAJO, ...NED_MEDIO_BAJO, ...POR_MEDIO_BAJO];
const CLUBES_BAJO = [...ESP_BAJO, ...ENG_BAJO, ...ITA_BAJO, ...GER_BAJO, ...FRA_BAJO, ...NED_BAJO, ...POR_BAJO, ...SUD_BAJO];
const CLUBES_MUY_BAJO = [...ESP_MUY_BAJO, ...ENG_MUY_BAJO, ...ITA_MUY_BAJO, ...GER_MUY_BAJO, ...FRA_MUY_BAJO, ...NED_MUY_BAJO, ...POR_MUY_BAJO];

const redondearPresupuesto = (num) => {
    if (num >= 10000000) return Math.round(num / 1000000) * 1000000;
    if (num >= 1000000) return Math.round(num / 500000) * 500000;
    return Math.round(num / 100000) * 100000;
};

const generarDatosUniversales = (clubes) => {
    const base = clubes.map(club => {
        const n = club.nombre;
        const esSudamericano = (club.pais === "Argentina" || club.pais === "Brasil");
        const compiteEnLiga = club.competiciones && club.competiciones.length > 0;
        
        let rango = { rep: [35, 45], pop: [30, 45], ppto: [400000, 900000] }; 

        if (CLUBES_ELITE.includes(n)) rango = { rep: [88, 92], pop: [90, 95], ppto: [85000000, 160000000] };
        else if (CLUBES_ALTO.includes(n)) rango = { rep: [80, 87], pop: [78, 88], ppto: [30000000, 65000000] };
        else if (CLUBES_MEDIO_ALTO.includes(n)) rango = { rep: [72, 79], pop: [70, 83], ppto: [12000000, 26000000] };
        else if (CLUBES_MEDIO_BAJO.includes(n)) rango = { rep: [64, 71], pop: [65, 80], ppto: [5000000, 11500000] };
        else if (CLUBES_BAJO.includes(n)) rango = { rep: [52, 63], pop: [53, 71], ppto: [1800000, 4800000] };
        else if (CLUBES_MUY_BAJO.includes(n)) rango = { rep: [42, 51], pop: [40, 60], ppto: [600000, 1600000] };

        if (club.esFilial && compiteEnLiga) {
            rango = { rep: [52, 60], pop: [45, 55], ppto: [0, 0] }; 
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

        return {
            ...club,
            presupuestoTraspasos: pptoFinal,
            presupuestoSalarios: redondearPresupuesto(pptoFinal * 1.5),
            infraestructuras: { entrenamiento: nivelInfra, cantera: nivelInfra },
            popularidad: pop,
            reputacion: rep
        };
    });

    let nuevosFiliales = [];
    base.forEach(club => {
        if (!club.esFilial) {
           const yaTieneFilial = base.some(c => c.clubMatriz === club.nombre && c.esFilial);

            if (!yaTieneFilial) {
                let repFilial = Math.floor(club.reputacion * 0.6); 
                repFilial = Math.max(35, Math.min(65, repFilial));
                
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
                    popularidad: Math.floor(club.popularidad * 0.4),
                    reputacion: repFilial,
                    historialTitulos: []
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