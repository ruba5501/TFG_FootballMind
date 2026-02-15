import sys
import json
from ortools.sat.python import cp_model

try:
    from ortools.sat.python import cp_model
except ImportError:
    print(json.dumps({"error": "OR-Tools no instalado"}))
    sys.exit(1)
    
def solve():
    try:
        # Leer datos de Node.js
        input_data = json.loads(sys.stdin.read())
        equipos = input_data['equipos']
        enfrentamientos = input_data['enfrentamientos']
        
        # Determinar si son 8 o 6 jornadas (UCL/UEL vs UECL)
        num_jornadas = 6 if len(enfrentamientos) == 108 else 8
        
        model = cp_model.CpModel()
        
        # Variables binarias: ¿El partido P se juega en la jornada J?
        x = {}
        for p_idx in range(len(enfrentamientos)):
            for j in range(1, num_jornadas + 1):
                x[p_idx, j] = model.NewBoolVar(f'p{p_idx}_j{j}')

        # Restricción 1: Cada partido debe jugarse exactamente una vez
        for p_idx in range(len(enfrentamientos)):
            model.Add(sum(x[p_idx, j] for j in range(1, num_jornadas + 1)) == 1)

        # Restricción 2: Un equipo no juega dos veces en la misma jornada
        equipo_ids = [e['id'] for e in equipos]
        for eq_id in equipo_ids:
            for j in range(1, num_jornadas + 1):
                partidos_del_equipo = []
                for p_idx, p in enumerate(enfrentamientos):
                    if p['loc'] == eq_id or p['vis'] == eq_id:
                        partidos_del_equipo.append(x[p_idx, j])
                model.Add(sum(partidos_del_equipo) <= 1)

        solver = cp_model.CpSolver()
        # Añadimos un pequeño componente aleatorio para que los calendarios varíen
        solver.parameters.random_seed = 42 
        status = solver.Solve(model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            resultado = []
            for p_idx, p in enumerate(enfrentamientos):
                for j in range(1, num_jornadas + 1):
                    if solver.Value(x[p_idx, j]):
                        p['jornada'] = j
                        resultado.append(p)
            print(json.dumps(resultado))
        else:
            print(json.dumps([]))

    except Exception as e:
        # Enviar error en formato JSON para que Node.js no rompa
        print(json.dumps({"error": str(e)}))

if __name__ == '__main__':
    solve()