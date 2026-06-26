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
                this.intercambiarDatosJugadores(this.jugadorSeleccionado, li);
            }
            this.jugadorSeleccionado.classList.remove('selected', 'bg-primary');
            this.jugadorSeleccionado = null;
            
            this.dibujarAlineacion(formacionActual);
            this.actualizarNumeracion();
        }
    },

    intercambiarDatosJugadores: function(node1, node2) {
        // 1. Guardamos temporalmente todos los atributos clave del Nodo 1
        const id1 = node1.getAttribute('data-id');
        const bloqueado1 = node1.getAttribute('data-bloqueado');
        const vacio1 = node1.getAttribute('data-vacio');
        const pos1 = node1.getAttribute('data-posicion');
        const sec1 = node1.getAttribute('data-secundarias');
        const html1 = node1.innerHTML;
        const clases1 = node1.className;
        const estilo1 = node1.style.cssText;

        // 2. Pasamos los datos del Nodo 2 al Nodo 1
        node1.setAttribute('data-id', node2.getAttribute('data-id') || 'vacio');
        node1.setAttribute('data-bloqueado', node2.getAttribute('data-bloqueado') || 'false');
        node1.setAttribute('data-posicion', node2.getAttribute('data-posicion') || '');
        node1.setAttribute('data-secundarias', node2.getAttribute('data-secundarias') || '');
        if (node2.getAttribute('data-vacio') === 'true') {
            node1.setAttribute('data-vacio', 'true');
        } else {
            node1.removeAttribute('data-vacio');
        }
        node1.innerHTML = node2.innerHTML;
        node1.className = node2.className;
        node1.style.cssText = node2.style.cssText;

        // 3. Pasamos los datos guardados del Nodo 1 al Nodo 2
        node2.setAttribute('data-id', id1 || 'vacio');
        node2.setAttribute('data-bloqueado', bloqueado1 || 'false');
        node2.setAttribute('data-posicion', pos1 || '');
        node2.setAttribute('data-secundarias', sec1 || '');
        if (vacio1 === 'true') {
            node2.setAttribute('data-vacio', 'true');
        } else {
            node2.removeAttribute('data-vacio');
        }
        node2.innerHTML = html1;
        node2.className = clases1;
        node2.style.cssText = estilo1;

        // Limpiar rastro visual de selección compartida
        node1.classList.remove('selected', 'bg-primary');
        node2.classList.remove('selected', 'bg-primary');

        if (node1.closest('#lista-reservas') && node1.getAttribute('data-vacio') === 'true') {
            node1.remove();
        }
        if (node2.closest('#lista-reservas') && node2.getAttribute('data-vacio') === 'true') {
            node2.remove();
        }
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
        return Array.from(document.querySelectorAll('#lista-titulares .jugador-item')).slice(0, 11);
    },

    dibujarAlineacion: function(formacionActual) {
        const contenedorJugadores = document.getElementById('capa-jugadores');
        const config = this.formacionesDisponibles[formacionActual];
        if (!contenedorJugadores || !config) return;

        const contenedoresEtiquetas = document.querySelectorAll('.label-posicion-fija');
        contenedoresEtiquetas.forEach(contenedor => {
            const index = parseInt(contenedor.getAttribute('data-index'));
            const nuevaPosicionTexto = config.posiciones[index];
            const badge = contenedor.querySelector('.badge-posicion-tactica');
            if (badge && nuevaPosicionTexto) {
                badge.textContent = nuevaPosicionTexto;
            }
        });

        contenedorJugadores.innerHTML = ''; 
        const titularesAsignados = this.repartirJugadores(config);

        titularesAsignados.forEach((li, i) => {
            if (!li) return; 

            const coords = config.coordenadas[i];
            const posEnTactica = config.posiciones[i]; 
            if (!coords) return;

            if (li.getAttribute('data-vacio') === 'true') {
                const nodeVacio = document.createElement('div');
                nodeVacio.className = 'player-node'; 
                nodeVacio.style.top = coords.t + '%';
                nodeVacio.style.left = coords.l + '%';
                nodeVacio.innerHTML = `
                    <div class="circle bg-secondary" style="opacity: 0.4; border: 2px dashed #fff;">${posEnTactica}</div>
                    <div class="name text-muted" style="font-style: italic;">Vacío</div>
                `;
                contenedorJugadores.appendChild(nodeVacio);
                return; // Saltamos al siguiente titular
            }

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
            const posA = a.querySelector('.badge')?.innerText || 'RES';
            const posB = b.querySelector('.badge')?.innerText || 'RES';
            return (ORDEN_POSICIONES[posA] || 99) - (ORDEN_POSICIONES[posB] || 99);
        });

        jugadores.forEach(node => listaTitulares.appendChild(node));
        this.actualizarNumeracion();
        this.dibujarAlineacion(document.getElementById('selector-formacion').value);
    },

    guardarCambios: async function(clubId) {
        // 1. Obtener los elementos de cada sección de forma independiente
        const titulares = Array.from(document.querySelectorAll('#lista-titulares .jugador-item'));
        const suplentes = Array.from(document.querySelectorAll('#lista-suplentes .jugador-item'));
        const titularesYSuplentes = [...titulares, ...suplentes];

        // 2. Validación: No se permiten lesionados o sancionados convocados
        const tieneNoDisponibles = titularesYSuplentes.some(li => li.getAttribute('data-bloqueado') === 'true');
        if (tieneNoDisponibles) {
            UI.notificarError(
                "Convocatoria Inválida", 
                "No puedes guardar la alineación. Tienes jugadores lesionados o sancionados entre los titulares o suplentes. Muévelos a la Reserva usando el botón de desconvocar (🔽)."
            );
            return;
        }

        // 3. Validación: El 11 inicial debe estar COMPLETO (sin huecos vacíos)
        const tieneHuecosEnOnce = titulares.some(li => li.getAttribute('data-vacio') === 'true');
        if (tieneHuecosEnOnce) {
            UI.notificarError(
                "Alineación Incompleta",
                "No puedes dejar puestos vacíos en el 11 titular. Asigna un jugador a cada posición antes de guardar."
            );
            return;
        }

        // 4. Validación: Mínimo 17 jugadores convocados en total (11 titulares + al menos 6 suplentes reales)
        const convocadosReales = titularesYSuplentes.filter(li => li.getAttribute('data-vacio') !== 'true').length;
        if (convocadosReales < 17) {
            UI.notificarError(
                "Convocatoria Insuficiente",
                `Debes convocar al menos 17 futbolistas (11 titulares y mínimo 6 suplentes). Actualmente tienes ${convocadosReales} asignados.`
            );
            return;
        }

        // 5. Mapear IDs para el backend (los vacíos viajan como null para no descolocar los índices de las listas fijas)
        const nuevaPlantilla = Array.from(document.querySelectorAll('.jugador-item'))
            .map(li => {
                const id = li.getAttribute('data-id');
                return id === 'vacio' ? null : id;
            });

        const formacion = document.getElementById('selector-formacion').value;
        
        try {
            const response = await fetch(`/guardarAlineacion/${clubId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ nuevaPlantilla: nuevaPlantilla, formacion: formacion })
            });
            
            if (response.ok) {
                UI.notificarExito("Alineación y táctica guardadas correctamente.", () => {
                    location.reload();
                });
            } else {
                const errData = await response.json();
                UI.notificarError("Error del Servidor", errData.error || "No se pudo guardar la táctica.");
            }
        } catch (error) { 
            console.error(error); 
            UI.notificarError("Error de Conexión", "Hubo un problema de red al intentar guardar.");
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
                body: JSON.stringify({ estiloJuego: estilo, mentalidad: mentalidad })
            });
            if (response.ok) location.reload();
        } catch (error) {
            console.error("Error al guardar la filosofía táctica:", error);
            alert("Error al conectar con el servidor al guardar tácticas");
        }
    },

    subirCanterano: function(jugadorId) {
        UI.confirmar(
            "Convocar Canterano", 
            "¿Deseas convocar a este jugador para el próximo partido?", 
            "Convocar Jugador", 
            async () => {
                try {
                    const response = await fetch(`/subirCanterano/${jugadorId}`, { method: 'POST' });
                    if (response.ok) {
                        UI.notificarExito("Jugador convocado correctamente", () => {
                            location.reload();
                        });
                    }
                } catch (error) { console.error(error); }
            }
        );
    },
    
    verAtributos: function(jugadorId) {
        const contenedor = document.getElementById('contenidoModalJugador');
        contenedor.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div></div>';
        const bsModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAtributos'));
        bsModal.show();

        fetch(`/jugador/atributos/${jugadorId}`)
            .then(res => res.text())
            .then(html => { contenedor.innerHTML = `<div class="p-3">${html}</div>`; });
    },

    desconvocarJugador: function(liJugador) {
        const listaReservas = document.getElementById('lista-reservas');
        const selectorFormacion = document.getElementById('selector-formacion');
        const formacionActual = selectorFormacion ? selectorFormacion.value : '4-3-3';

        if (!listaReservas || !liJugador || liJugador.getAttribute('data-vacio') === 'true') return;

        if (this.jugadorSeleccionado === liJugador) {
            liJugador.classList.remove('selected', 'bg-primary');
            this.jugadorSeleccionado = null;
        }

        // 1. Clonamos el jugador para la grada
        const clonParaReservas = liJugador.cloneNode(true);
        clonParaReservas.classList.remove('selected', 'bg-primary');
        
        // Quitamos el botón de desconvocar en el clon de reservas
        const btnBajar = clonParaReservas.querySelector('.btn-outline-danger');
        if (btnBajar) btnBajar.remove();
        
        listaReservas.appendChild(clonParaReservas);

        // 2. Transformamos el elemento en el HUECO VACÍO estático
        liJugador.setAttribute('data-id', 'vacio');
        liJugador.setAttribute('data-bloqueado', 'false');
        liJugador.setAttribute('data-vacio', 'true');
        liJugador.removeAttribute('data-posicion');
        liJugador.removeAttribute('data-secundarias');
        
        liJugador.className = "list-group-item jugador-item d-flex align-items-center justify-content-between bg-dark text-muted p-2 border-secondary style-jugador-vacio";
        liJugador.style.opacity = "0.5";
        liJugador.style.cursor = "pointer";
        
        liJugador.innerHTML = `
            <div class="d-flex align-items-center gap-2 py-1 ms-1">
                <span class="badge bg-secondary text-dark fw-bold" style="font-size: 0.7rem; min-width: 24px;">--</span>
                <span class="fw-semibold text-secondary">Sin asignar</span>
            </div>
            
            <div class="me-2">
                <small class="text-uppercase text-muted fw-bold tracking-wider" style="font-size: 0.65rem; letter-spacing: 0.5px;">Vacío</small>
            </div>
        `;

        this.dibujarAlineacion(formacionActual);
        this.actualizarNumeracion();
    }
};