import json
import os
import re

# --- CONFIGURACIÓN ---
RUTA_JSON = 'base_datos/clubes.json'
RUTA_CARPETA_ESCUDOS = 'public/img/escudos/' 

def auditar_sincronizacion(ruta_json, ruta_escudos):
    # Cargar datos del JSON
    try:
        with open(ruta_json, 'r', encoding='utf-8') as f:
            datos_clubes = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: Archivo JSON no encontrado en {ruta_json}")
        return

    # Mapear los archivos PNG que existen en la carpeta
    try:
        # Usamos lower() para estandarizar temporalmente los nombres de archivo para la búsqueda
        archivos_png_encontrados = {f.lower(): f for f in os.listdir(ruta_escudos) if f.endswith('.png')}
    except FileNotFoundError:
        print(f"ERROR: No se encontró la carpeta de escudos en {ruta_escudos}")
        return

    archivos_esperados_json = set()
    clubes_sin_escudo = []
    
    # --- 1. IDENTIFICAR CLUBES CON ESCUDOS FALTANTES O INCORRECTOS ---
    print("## ❌ Escudos FALTANTES o MAL NOMBRADOS (REQUIERE TU ACCIÓN)")
    print("--------------------------------------------------")
    print("Si el escudo ya existe, re-nómbralo exactamente al nombre 'Esperado'.")
    print("Si no existe, descárgalo con el nombre 'Esperado'.")
    print("--------------------------------------------------")
    
    for club in datos_clubes:
        nombre_club = club['nombre']
        escudo_esperado_json = club.get('escudo')

        if not escudo_esperado_json or not isinstance(escudo_esperado_json, str):
            clubes_sin_escudo.append(f"⚠️ DATO FALTANTE: El club '{nombre_club}' tiene el campo 'escudo' vacío o incorrecto.")
            continue
        
        archivos_esperados_json.add(escudo_esperado_json.lower())

        # Comprobar existencia
        if escudo_esperado_json.lower() not in archivos_png_encontrados:
            print(f"❌ FALTA: '{escudo_esperado_json}' para {nombre_club}.")

    if clubes_sin_escudo:
        print("\n## ⚠️ Errores de Estructura JSON (Campo 'escudo' vacío):")
        for error in clubes_sin_escudo:
            print(error)

    # --- 2. IDENTIFICAR ARCHIVOS SOBRANTES (Potenciales Errores/Archivos No Usados) ---
    archivos_sobrantes = []
    archivos_usados = archivos_esperados_json
    
    print("\n--------------------------------------------------")
    print("## 🗑️ Archivos PNG SOBRANTES en la carpeta 'escudos/'")
    print("(Estos archivos DEBEN renombrarse a uno de los nombres FALTA de arriba)")
    print("--------------------------------------------------")
    
    for nombre_archivo_lower, nombre_archivo_real in archivos_png_encontrados.items():
        if nombre_archivo_lower not in archivos_usados:
            
            # Pista para filiales
            pista = ""
            if "_u21" in nombre_archivo_lower or "_b" in nombre_archivo_lower or "_ii" in nombre_archivo_lower:
                pista = " (Pista: POSIBLE FILIAL)"
            
            archivos_sobrantes.append(f"🗑️ SOBRANTE: {nombre_archivo_real}{pista}")

    
    if archivos_sobrantes:
        for archivo in archivos_sobrantes:
            print(archivo)
        print(f"\n✅ Escudos encontrados con el nombre correcto: {len(archivos_usados) - len(archivos_sobrantes)}")
        print(f"Total de archivos sobrantes/mal nombrados: {len(archivos_sobrantes)}")
        print(f"Total de archivos esperados por JSON: {len(archivos_usados)}")
    else:
        print("✅ ¡No hay archivos sobrantes! Todos los archivos en uso tienen el nombre correcto.")
        print(f"Total de archivos esperados por JSON: {len(archivos_usados)}")


# --- EJECUTAR ---
auditar_sincronizacion(RUTA_JSON, RUTA_CARPETA_ESCUDOS)