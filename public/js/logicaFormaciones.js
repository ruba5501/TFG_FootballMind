const GestorTactico = {
    jugadorSeleccionado: null,
    formacionesDisponibles: {},

    init: function(formacionInicial, todasLasFormaciones) {
        this.formacionesDisponibles = todasLasFormaciones;
        
        const listaJugadores = document.querySelectorAll('.jugador-item');
        listaJugadores.forEach(li => {
            li.style.cursor = 'pointer';
        });

        const selector = document.getElementById('selector-formacion');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.dibujarAlineacion(e.target.value);
            });
        }

        this.dibujarAlineacion(formacionInicial);
    },

    seleccionarJugador: function(li) {
        const selectorFormacion = document.getElementById('selector-formacion');
        const formacionActual = selectorFormacion ? selectorFormacion.value : '4-3-3';
        
        if (!this.jugadorSeleccionado) {
            this.jugadorSeleccionado = li;
            li.classList.add('selected', 'bg-primary'); 
        } else {
            if (this.jugadorSeleccionado !== li) {
                this.intercambiarDOM(this.jugadorSeleccionado, li);
            }
            this.jugadorSeleccionado.classList.remove('selected', 'bg-primary');
            this.jugadorSeleccionado = null;
            
            this.dibujarAlineacion(formacionActual);
            this.actualizarNumeracion();
        }
    },

    intercambiarDOM: function(node1, node2) {
        const parent1 = node1.parentNode;
        const parent2 = node2.parentNode;
        const next1 = node1.nextSibling;
        const next2 = node2.nextSibling;

        parent1.insertBefore(node2, next1);
        parent2.insertBefore(node1, next2);
    },

    actualizarNumeracion: function() {
        const titulares = document.querySelectorAll('#lista-titulares .jugador-item');
    
        titulares.forEach((li, i) => {
            const badge = li.querySelector('.num-titular');
            if (badge) {
                badge.innerText = i + 1;
                badge.style.display = (i < 11) ? 'inline-block' : 'none';
            }
        });
    },

    
   repartirJugadores: function(configTactica) {
        const titulares = Array.from(document.querySelectorAll('#lista-titulares .jugador-item')).slice(0, 11);
        const copiaTitulares = [...titulares];
        const asignacion = new Array(11);

        configTactica.posiciones.forEach((posRequerida, index) => {
            const i = copiaTitulares.findIndex(j => j.getAttribute('data-posicion') === posRequerida);
            if (i !== -1) {
                asignacion[index] = copiaTitulares.splice(i, 1)[0];
            }
        });

        configTactica.posiciones.forEach((pos, index) => {
            if (!asignacion[index]) {
                asignacion[index] = copiaTitulares.shift();
            }
        });

        return asignacion;
    },

    dibujarAlineacion: function(formacionActual) {
        const contenedorJugadores = document.getElementById('capa-jugadores');
        const config = this.formacionesDisponibles[formacionActual];
        if (!contenedorJugadores || !config) return;

        contenedorJugadores.innerHTML = ''; 
        
        const titularesAsignados = this.repartirJugadores(config);

        titularesAsignados.forEach((li, i) => {
            if (!li) return; // Seguridad

            const coords = config.coordenadas[i];
            const posEnTactica = config.posiciones[i]; 
            const posPrincipal = li.getAttribute('data-posicion'); 
            const secundarias = (li.getAttribute('data-secundarias') || "").split(',').filter(s => s !== "");

            let colorClase = 'bg-danger'; // Rojo (Fuera de lugar)
            if (posPrincipal === posEnTactica) {
                colorClase = 'bg-primary'; // Azul (Posición Principal)
            } else if (secundarias.includes(posEnTactica)) {
                colorClase = 'bg-warning text-dark'; // Amarillo (Posición Secundaria)
            }

            const nombreFull = li.querySelector('.nombre-txt')?.innerText || "Jugador";
            const partes = nombreFull.trim().split(' ');
            const nombreProcesado = partes.length > 1 
                ? `${partes[0][0]}. ${partes.slice(1).join(' ')}`
                : partes[0];

            const node = document.createElement('div');
            node.className = 'player-node'; 
            node.style.top = coords.t + '%';
            node.style.left = coords.l + '%';
            node.innerHTML = `
                <div class="circle ${colorClase}" title="Natural: ${posPrincipal}">${posEnTactica}</div>
                <div class="name">${nombreProcesado}</div>
            `;
            contenedorJugadores.appendChild(node);
        });
    },

    validarPosicion: function(requerida, real) {
        if (requerida === real) return true;
        if (requerida === 'MC' && (real === 'MCD' || real === 'MCO')) return true;
        if (requerida === 'DFC' && (real === 'LD' || real === 'LI')) return true;
        return false;
    },

    ordenarPlantillaPorPosicion: function() {
        const listaTitulares = document.getElementById('lista-titulares');
        const jugadores = Array.from(listaTitulares.querySelectorAll('.jugador-item'));

        jugadores.sort((a, b) => {
            const posA = a.querySelector('.badge').innerText;
            const posB = b.querySelector('.badge').innerText;
            return (ORDEN_POSICIONES[posA] || 99) - (ORDEN_POSICIONES[posB] || 99);
        });

        jugadores.forEach(node => listaTitulares.appendChild(node));
        
        this.actualizarNumeracion();
        this.dibujarAlineacion(document.getElementById('selector-formacion').value);
    },

    guardarCambios: async function(clubId) {
        const nuevaPlantilla = Array.from(document.querySelectorAll('.jugador-item'))
                                    .map(li => li.getAttribute('data-id'));
        const formacion = document.getElementById('selector-formacion').value;

        try {
            const resAlineacion = await fetch(`/club/guardarAlineacion/${clubId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ nuevaPlantilla })
            });

            const resRoles = await fetch(`/club/actualizarRoles/${clubId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tactica: { formacion: formacion } })
            });

            if (resAlineacion.ok && resRoles.ok) {
                alert("Estrategia guardada correctamente");
                location.reload();
            } else {
                throw new Error("Error en la respuesta del servidor");
            }
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("Error al conectar con el servidor");
        }
    },

    guardarRoles: async function(clubId) {
        const form = document.getElementById('formRoles');
        const formData = new FormData(form);
        const datos = Object.fromEntries(formData.entries());
        try {
            const response = await fetch(`/actualizarRoles/${clubId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            if (response.ok) location.reload();
        } catch (error) { console.error(error); }
    },

    subirCanterano: async function(jugadorId) {
        if (!confirm("¿Deseas subir a este jugador?")) return;
        try {
            const response = await fetch(`/subirCanterano/${jugadorId}`, { method: 'POST' });
            if (response.ok) location.reload();
        } catch (error) { console.error(error); }
    },
    
    /*HAY QUE MIRARLO*/
    verAtributos: async function(jugadorId) {
        try {
            const response = await fetch(`/jugador/datos/${jugadorId}`);
            if (!response.ok) throw new Error("No se pudo obtener la información");
            
            const jugador = await response.json();

            document.getElementById('nombreJugadorModal').innerText = jugador.nombre;
            document.getElementById('posicionModal').innerText = jugador.posicionPrincipal;
            document.getElementById('mediaModal').innerText = jugador.media;

            const contenedor = document.getElementById('contenedorAtributos');
            contenedor.innerHTML = '';

            const atributosAMostrar = [
                { nombre: 'Ritmo', valor: jugador.atributos.ritmo },
                { nombre: 'Tiro', valor: jugador.atributos.tiro },
                { nombre: 'Pase', valor: jugador.atributos.pase },
                { nombre: 'Regate', valor: jugador.atributos.regate },
                { nombre: 'Defensa', valor: jugador.atributos.defensa },
                { nombre: 'Físico', valor: jugador.atributos.fisico }
            ];

            atributosAMostrar.forEach(attr => {
                const div = document.createElement('div');
                div.className = 'col-6 mb-2';
                const colorClase = attr.valor >= 80 ? 'text-success' : (attr.valor >= 60 ? 'text-warning' : 'text-danger');
                
                div.innerHTML = `
                    <div class="d-flex justify-content-between p-2 bg-secondary rounded shadow-sm" style="--bs-bg-opacity: .2;">
                        <span>${attr.nombre}</span>
                        <span class="fw-bold ${colorClase}">${attr.valor}</span>
                    </div>
                `;
                contenedor.appendChild(div);
            });

            const modalElement = document.getElementById('modalAtributos');
            const bsModal = new bootstrap.Modal(modalElement);
            bsModal.show();

        } catch (error) {
            console.error("Error al cargar atributos:", error);
            alert("Error al cargar los datos del jugador.");
        }
    }
};