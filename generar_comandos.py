import re
import os

def normalizar(nombre):
    """Limpia y normaliza el nombre para facilitar la coincidencia."""
    nombre = nombre.lower().replace('.png', '').replace('-', '_').replace('.', '')
    nombre = re.sub(r'[\(\)\&\+\',]', '', nombre) # Quitar paréntesis, &, +, comas y comillas simples
    nombre = nombre.strip().replace(' ', '_')
    return nombre

def generar_script_renombrado_windows():
    # --- LISTAS OBTENIDAS DE LA AUDITORÍA ANTERIOR ---
    # Los nombres esperados por el JSON (DESTINO)
    faltantes = [
        'FC_Barcelona.png', 'Sevilla_FC.png', 'Villarreal_CF.png', 'Valencia_CF.png', 'CA_Osasuna.png', 
        'RCD_Espanyol.png', 'Elche_CF.png', 'Getafe_CF.png', 'RCD_Mallorca.png', 'Levante_UD.png', 
        'Girona_FC.png', 'Deportivo.png', 'Racing_Santander.png', 'Valladolid.png', 'Sporting_Gijon.png', 
        'Zaragoza.png', 'Granada_CF.png', 'Cadiz_CF.png', 'Burgos_CF.png', 'Eibar.png', 'Malaga_CF.png', 
        'Cordoba_CF.png', 'Albacete.png', 'FC_Andorra.png', 'Ceuta.png', 'Arsenal_FC.png', 'Chelsea_FC.png', 
        'Liverpool_FC.png', 'Brighton_&_Hove_Albion.png', 'AFC_Bournemouth.png', 'Brentford_FC.png', 
        'Everton_FC.png', 'Sunderland_AFC.png', 'Fulham_FC.png', 'Wolverhampton_Wanderers.png', 
        'Leeds_United.png', 'Burnley_FC.png', 'Southampton_FC.png', 'Middlesbrough_FC.png', 
        'Watford_FC.png', 'Millwall_FC.png', 'Wrexham_AFC.png', 'Portsmouth_FC.png', 'Juventus_de_Turin.png', 
        'SSC_Napoles.png', 'AC_Milan.png', 'Atalanta_de_Bergamo.png', 'AS_Roma.png', 'Como_1907.png', 
        'SS_Lazio.png', 'Torino_FC.png', 'US_Sassuolo.png', 'Pisa_Sporting_Club.png', 'US_Cremonese.png', 
        'US_Lecce.png', 'Venezia_FC.png', 'AC_Monza.png', 'Empoli_FC.png', 'Palermo_FC.png', 
        'US_Catanzaro.png', 'Cesena_FC.png', 'Modena_FC.png', 'UC_Sampdoria.png', 'SS_Juve_Stabia.png', 
        'Bayer_04_Leverkusen.png', 'Eintracht_Frankfurt.png', 'RB_Leipzig.png', 'VfB_Stuttgart.png', 
        'VfL_Wolfsburgo.png', 'SV_Werder_Bremen.png', 'TSG_1899_Hoffenheim.png', 'SC_Friburgo.png', 
        'FSV_Mainz_05.png', 'FC_Augsburgo.png', 'Hamburgo_SV.png', 'FC_Colonia.png', 'FC_St_Pauli.png', 
        'FC_Heidenheim_1846.png', 'FC_Nuremberg.png', 'SV_Elversberg.png', 'Greuther_Furth.png', 
        'Preussen_Munster.png', 'Dynamo_Dresden.png', 'Paris_Saint_Germain_FC.png', 'AS_Monaco.png', 
        'RC_Estrasburgo.png', 'LOSC_Lille.png', 'OGC_Niza.png', 'Stade_Rennais_FC.png', 'Paris_FC.png', 
        'Toulouse_FC.png', 'Stade_Brestois_29.png', 'RC_Lens.png', 'FC_Nantes.png', 'AJ_Auxerre.png', 
        'FC_Lorient.png', 'FC_Metz.png', 'Le_Havre_AC.png', 'Angers_SCO.png', 'Le_Mans_FC.png', 
        'Ajax_de_Amsterdam.png', 'FC_Utrecht.png', 'FC_Twente_Enschede.png', 'SC_Heerenveen.png', 
        'FC_Groningen.png', 'FC_Volendam.png', 'SC_Telstar.png', 'VVV-Venlo.png', 'FC_Oporto.png', 
        'SL_Benfica.png', 'SC_Braga.png', 'FC_Famalicao.png', 'Rio_Ave_FC.png', 'CD_Santa_Clara.png', 
        'GD_Estoril_Praia.png', 'FC_Alverca.png', 'Gil_Vicente_FC.png', 'Casa_Pia_AC.png', 'Moreirense_FC.png', 
        'Vitoria_Guimaraes_SC.png', 'FC_Arouca.png', 'CD_Tondela.png', 'CF_Estrela_Amadora.png', 
        'Academico_Viseu_FC.png', 'CA_River_Plate.png', 'CA_Boca_Juniors.png', 'CA_Independiente.png', 
        'CA_Vélez_Sarsfield.png', 'Club_Estudiantes_de_La_Plata.png', 'CA_Talleres.png', 
        'CA_Rosario_Central.png', 'AA_Argentinos_Juniors.png', 'CA_San_Lorenzo_de_Almagro.png', 
        'CA_Lanús.png', 'CA_Belgrano.png', 'CD_Godoy_Cruz_Antonio_Tomba.png', 'CA_Huracán.png', 
        'CA_Tigre.png', 'CSD_Defensa_y_Justicia.png', 'CA_Platense.png', 'CA_Unión_Santa_Fe.png', 
        'CS_Independiente_Rivadavia.png', 'CA_Barracas_Central.png', 'CA_Newells_Old_Boys.png', 
        'CA_Central_Cordoba_SdE.png', 'CA_Banfield.png', 'Club_Atlético_Tucumán.png', 
        'CA_Sarmiento_Junín.png', 'CA_Aldosivi.png', 'CA_San_Martín_San_Juan.png', 'SE_Palmeiras.png', 
        'CR_Flamengo.png', 'Cruzeiro_Esporte_Clube.png', 'SC_Corinthians.png', 'EC_Bahia.png', 
        'Atletico_Mineiro.png', 'Internacional.png', 'Sport_Recife.png', 'Ceara.png', 'EC_Vitoria.png', 
        'Juventude.png', 'Athletic_Club.png' # Athletic Club ha sido añadido de nuevo
    ]

    # Los archivos físicos sobrantes (ORIGEN)
    sobrantes = [
        'Academico_Viseu.png', 'AD_Ceuta .png', 'Ajax.png', 'Albacete_Balompié.png', 'Aldosivi.png', 
        'Alverca.png', 'Andorra.png', 'Angers.png', 'Argentinos_Juniors.png', 'Arouca.png', 'Arsenal.png', 
        'Atalanta.png', 'Augsburgo.png', 'Auxerre.png', 'Banfield.png', 'Barcelona.png', 'Barracas_Central.png', 
        'Bayer_Leverkusen.png', 'Belgrano.png', 'Benfica.png', 'Boca_Juniors.png', 'Bournemouth.png', 
        'Braga.png', 'Brentford.png', 'Brighton.png', 'Burgos.png', 'Burnley.png', 'Cadiz.png', 
        'Casa_Pia.png', 'Catanzaro.png', 'CA_Unión.png', 'Ceara_Sporting_Club.png', 'Central_Cordoba.png', 
        'Cesena.png', 'Chelsea.png', 'Clube_Atlético_Mineiro.png', 'Club_Atletico_Tucuman.png', 
        'Colonia.png', 'Como.png', 'Cordoba.png', 'Corinthians.png', 'Cremonese.png', 'Cruzeiro.png', 
        'Defensa_y_Justicia.png', 'Deportivo_de_La_Coruña.png', 'Eintracht_Francfort​​.png', 'Elche.png', 
        'Empoli.png', 'Espanyol.png', 'Esporte_Clube_Bahia.png', 'Esporte_Clube_Juventude.png', 
        'Esporte_Clube_Vitoria.png', 'Estoril_Praia.png', 'Estrela_Amadora.png', 'Estudiantes_de_La_Plata.png', 
        'Everton.png', 'Famalicao.png', 'FC_Núremberg​.png', 'Flamengo.png', 'Friburgo.png', 'Fulham.png', 
        'Getafe.png', 'Gil_Vicente.png', 'Girona.png', 'Godoy_Cruz_Antonio_Tomba.png', 'Granada.png', 
        'Groningen.png', 'Hamburgo.png', 'Heerenveen.png', 'Heidenheim.png', 'Hoffenheim.png', 'Huracan.png', 
        'Independiente.png', 'Independiente_Rivadavia.png', 'Juventus.png', 'Juve_Stabia.png', 'Lanus.png', 
        'Lazio.png', 'Lecce.png', 'Leeds.png', 'Leipzig.png', 'Lens.png', 'Levante.png', 'Le_Havre.png', 
        'Le_Mans.png', 'Lille.png', 'Liverpool.png', 'Lorient.png', 'Mainz_05.png', 'Malaga.png', 'Mallorca.png', 
        'Metz.png', 'Middlesbrough.png', 'Milan.png', 'Millwall.png', 'Modena.png', 'Monaco.png', 'Monza.png', 
        'Moreirense.png', 'Nantes.png', 'Napoles.png', 'Newells_Old_Boys.png', 'Niza.png', 'Oporto.png', 
        'Osasuna.png', 'Palermo.png', 'Palmeiras.png', 'Paris.png', 'Paris_Saint_Germain.png', 'Pisa.png', 
        'Platense.png', 'Portsmouth.png', 'Preußen_Munster.png', 'Racing_Club_de_Estrasburgo.png', 
        'Real_Racing_Club.png', 'Real_Sporting_de_Gijon.png', 'Real_Valladolid.png', 'Real_Zaragoza.png', 
        'Rio_Ave.png', 'River_Plate.png', 'Roma.png', 'Rosario_Central.png', 'Sampdoria.png', 'San Martín.png', 
        'Santa_Clara.png', 'San_Lorenzo_de_Almagro.png', 'Sarmiento.png', 'Sassuolo.png', 'SD_Eibar.png', 
        'Sevilla.png', 'SG_Dynamo_Dresden.png', 'Southampton.png', 'Sport_Club_do_Recife.png', 
        'Sport_Club_Internacional.png', 'SpVgg_Greuther_Furth.png', 'Stade_Brestois.png', 'Stade_Rennais.png', 
        'Stuttgart.png', 'St_Pauli.png', 'Sunderland.png', 'SV_07_Elversberg.png', 'Talleres.png', 'Telstar.png', 
        'Tigre.png', 'Tondela.png', 'Torino.png', 'Toulouse.png', 'Twente_Enschede.png', 'Utrecht.png', 
        'Valencia.png', 'Velez_Sarsfield.png', 'Venezia.png', 'Villarreal.png', 'Vitoria_Guimaraes.png', 
        'Volendam.png', 'VVV_Venlo.png', 'Watford.png', 'Werder_Bremen.png', 'Wolfsburgo.png', 
        'Wolverhampton.png', 'Wrexham.png', 'Athletic_Club.png' # Athletic Club, también como sobrante
    ]
    
    # 1. Creamos un mapa de coincidencias normalizadas (Origen -> Destino)
    # Usaremos el nombre normalizado del SOBRANTE para buscar la mejor coincidencia del FALTANTE
    
    mapa_faltantes_norm = {normalizar(f): f for f in faltantes}
    mapa_sobrantes_norm = {normalizar(s): s for s in sobrantes}
    
    comandos = ["@echo off", "CHCP 65001 > nul", "REM Script de Renombrado Automático para Windows (CMD)"]
    
    # Intentamos emparejar cada FALTANTE (Destino) con un SOBRANTE (Origen)
    faltantes_procesados = set()
    sobrantes_procesados = set()
    
    # Estrategia de búsqueda 1: Coincidencia exacta de la parte clave
    for destino_norm, destino_real in mapa_faltantes_norm.items():
        if destino_real in faltantes_procesados:
            continue

        # Intentar coincidir el destino con el origen
        mejor_origen_real = None
        
        # 1. Coincidencia exacta (si el nombre corto está contenido en el nombre largo)
        for origen_norm, origen_real in mapa_sobrantes_norm.items():
            if origen_real in sobrantes_procesados:
                continue
            
            # Comprobación de que el origen está contenido en el destino o son muy parecidos
            if origen_norm in destino_norm or destino_norm in origen_norm:
                # Evitar que 'Club' o 'FC' cause un conflicto
                if abs(len(destino_norm) - len(origen_norm)) < 10: # Si son nombres razonablemente similares en longitud
                    mejor_origen_real = origen_real
                    break # Encontrado
        
        # Caso especial para nombres con prefijos de clubes (FC_, CA_, CD_)
        if not mejor_origen_real:
            # Buscamos si el destino sin prefijo es igual al origen
            destino_sin_prefijo = re.sub(r'^(fc|cf|ac|ca|cd|ud|rc|ss|us|se|cr|gd)_', '', destino_norm)
            for origen_norm, origen_real in mapa_sobrantes_norm.items():
                if origen_real in sobrantes_procesados:
                    continue
                if origen_norm == destino_sin_prefijo:
                    mejor_origen_real = origen_real
                    break
        
        # Caso especial para nombres que terminan en sigla (ej: Arsenal_FC.png vs Arsenal.png)
        if not mejor_origen_real:
             destino_sin_sigla_final = re.sub(r'(_fc|_cf|_ac|_ud|_cd|_sc|_ss|_us|_se|_cr|_gd)$', '', destino_norm)
             for origen_norm, origen_real in mapa_sobrantes_norm.items():
                if origen_real in sobrantes_procesados:
                    continue
                if origen_norm == destino_sin_sigla_final:
                    mejor_origen_real = origen_real
                    break


        # Generar el comando si encontramos una coincidencia
        if mejor_origen_real:
            comandos.append(f'ren "{mejor_origen_real}" "{destino_real}"')
            faltantes_procesados.add(destino_real)
            sobrantes_procesados.add(mejor_origen_real)
            
    # --- 2. Reporte de Fallos (Archivos que quedaron sin emparejar) ---
    faltantes_pendientes = [f for f in faltantes if f not in faltantes_procesados]
    sobrantes_pendientes = [s for s in sobrantes if s not in sobrantes_procesados]

    comandos.append("\nREM --- RESUMEN ---")
    comandos.append(f"echo. Renombrado {len(faltantes_procesados)} de {len(faltantes)} archivos.")

    if faltantes_pendientes:
        comandos.append("echo. --- ATENCIÓN: CLUBES FALTANTES PENDIENTES ---")
        for f in faltantes_pendientes:
            comandos.append(f'echo. ❌ FALTANTE: "{f}"')
        
    if sobrantes_pendientes:
        comandos.append("echo. --- ATENCIÓN: ARCHIVOS SOBRANTES PENDIENTES ---")
        for s in sobrantes_pendientes:
            comandos.append(f'echo. 🗑️ SOBRANTE: "{s}" (Puede ser basura o un error de emparejamiento)')

    # --- 3. Guardar el archivo .bat ---
    ruta_script = 'ejecutar_renombrado.bat'
    try:
        with open(ruta_script, 'w', encoding='utf-8') as f:
            f.write('\n'.join(comandos))
        
        print("\n" + "="*50)
        print(f"✅ ÉXITO: Archivo de comandos '{ruta_script}' generado.")
        print(f"   Se generaron {len(faltantes_procesados)} comandos de renombrado.")
        print("   Comprueba el archivo antes de ejecutarlo.")
        print(f"   Quedaron {len(faltantes_pendientes)} archivos sin emparejar. Revisa la sección de ATENCIÓN.")
        print("="*50)

    except IOError:
        print(f"ERROR: No se pudo escribir en el archivo {ruta_script}.")


# --- EJECUTAR ---
generar_script_renombrado_windows()