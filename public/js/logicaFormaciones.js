const GestorTactico = {
    jugadorSeleccionado: null,
    formacionesDisponibles: {},

    init: function(formacionInicial, todasLasFormaciones) {
        this.formacionesDisponibles = todasLasFormaciones;
        
        const listaJugadores = document.querySelectorAll('.list-group-item');
        listaJugadores.forEach(li => {
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => this.seleccionarJugador(li));
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
        const formacionActual = document.getElementById('selector-formacion').value;
        
        if (!this.jugadorSeleccionado) {
            this.jugadorSeleccionado = li;
            li.classList.add('active', 'bg-primary');
        } else {
            if (this.jugadorSeleccionado !== li) {
                this.intercambiarDOM(this.jugadorSeleccionado, li);
            }
            this.jugadorSeleccionado.classList.remove('active', 'bg-primary');
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
        const titulares = document.querySelectorAll('#lista-titulares li');
        titulares.forEach((li, i) => {
            const badge = li.querySelector('.badge');
            if (badge) badge.innerText = i + 1;
        });
    },

    dibujarAlineacion: function(formacionActual) {
        const campo = document.getElementById('campo-futbol');
        const config = this.formacionesDisponibles[formacionActual];
        if (!campo || !config) return;

        campo.innerHTML = '';
        const titulares = document.querySelectorAll('#lista-titulares li');

        titulares.forEach((li, i) => {
            if (i >= 11) return;
            const coords = config.coordenadas[i];
            
            const nombreFull = li.querySelector('strong').innerText || "Jugador";
            const nombreProcesado = nombreFull.split(' ').length > 1 
                ? `${nombreFull.split(' ')[0][0]}. ${nombreFull.split(' ').slice(1).join(' ')}`
                : nombreFull;

            const node = document.createElement('div');
            node.className = 'player-node';
            node.style.top = coords.t + '%';
            node.style.left = coords.l + '%';
            node.innerHTML = `
                <div class="circle">${i + 1}</div>
                <div class="name">${nombreProcesado}</div>
            `;
            campo.appendChild(node);
        });
    },

    guardarCambios: async function(clubId) {
        const nuevaPlantilla = Array.from(document.querySelectorAll('.list-group-item'))
                                    .map(li => li.getAttribute('data-id'));
        const formacion = document.getElementById('selector-formacion').value;

        try {
            await fetch(`/guardarAlineacion/${clubId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ nuevaPlantilla })
            });

            await fetch(`/actualizarRoles/${clubId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ formacion: formacion })
            });

            alert("Estrategia guardada correctamente");
            location.reload();
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("Error al guardar en el servidor");
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
    }
};