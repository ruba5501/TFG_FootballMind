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

        // Inicializamos los carruseles del modal táctico automáticamente
        this.initModalTacticas();
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
            if (!li) return; 

            const coords = config.coordenadas[i];
            const posEnTactica = config.posiciones[i]; 
            const posPrincipal = li.getAttribute('data-posicion'); 
            const secundarias = (li.getAttribute('data-secundarias') || "").split(',').filter(s => s !== "");

            let colorClase = 'bg-danger'; 
            if (posPrincipal === posEnTactica) {
                colorClase = 'bg-primary'; 
            } else if (secundarias.includes(posEnTactica)) {
                colorClase = 'bg-warning text-dark'; 
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
            const response = await fetch(`/guardarAlineacion/${clubId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    nuevaPlantilla: nuevaPlantilla, 
                    formacion: formacion 
                })
            });

            if (response.ok) {
                alert("Alineación y táctica guardadas correctamente");
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

    initModalTacticas: function() {
        const carruselEstilos = document.getElementById('carouselEstilos');
        if (carruselEstilos) {
            carruselEstilos.addEventListener('slid.bs.carousel', function (event) {
                const idEstilo = event.relatedTarget.getAttribute('data-val');
                const inputEstilo = document.getElementById('input-estilo-juego');
                if (inputEstilo) inputEstilo.value = idEstilo;
            });
        }

        const carruselMentalidades = document.getElementById('carouselMentalidades');
        if (carruselMentalidades) {
            carruselMentalidades.addEventListener('slid.bs.carousel', function (event) {
                const idMentalidad = event.relatedTarget.getAttribute('data-val');
                const inputMentalidad = document.getElementById('input-mentalidad');
                if (inputMentalidad) inputMentalidad.value = idMentalidad;
            });
        }
    },

    guardarEstiloMentalidad: async function(clubId, estilo, mentalidad) {
        try {
            const response = await fetch(`/guardarTactica/${clubId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    estiloJuego: estilo, 
                    mentalidad: mentalidad 
                })
            });

            if (response.ok) location.reload();
        } catch (error) {
            console.error("Error al guardar la filosofía táctica:", error);
            alert("Error al conectar con el servidor al guardar tácticas");
        }
    },

    subirCanterano: async function(jugadorId) {
        if (!confirm("¿Deseas subir a este jugador?")) return;
        try {
            const response = await fetch(`/subirCanterano/${jugadorId}`, { method: 'POST' });
            if (response.ok) location.reload();
        } catch (error) { console.error(error); }
    },
    
    verAtributos: function(jugadorId) {
        const contenedor = document.getElementById('contenidoModalJugador');
        contenedor.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div></div>';

        const bsModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAtributos'));
        bsModal.show();

        fetch(`/jugador/atributos/${jugadorId}`)
            .then(res => res.text())
            .then(html => {
                contenedor.innerHTML = `<div class="p-3">${html}</div>`;
            });
    }
};