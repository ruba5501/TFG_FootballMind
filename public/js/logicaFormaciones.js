const GestorTactico = {
    jugadorSeleccionado: null,

    coordenadas: {
        '4-3-3': [
            {t:85, l:50}, {t:65, l:15}, {t:70, l:38}, {t:70, l:62}, {t:65, l:85},
            {t:45, l:50}, {t:40, l:25}, {t:40, l:75}, {t:15, l:50}, {t:20, l:15}, {t:20, l:85}
        ],
        '4-4-2': [
            {t:85, l:50}, {t:70, l:15}, {t:75, l:38}, {t:75, l:62}, {t:70, l:85},
            {t:45, l:15}, {t:45, l:38}, {t:45, l:62}, {t:45, l:85}, {t:20, l:35}, {t:20, l:65}
        ]
    },

    init: function(formacionInicial) {
        const listaJugadores = document.querySelectorAll('.list-group-item');
        
        listaJugadores.forEach(li => {
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => this.seleccionarJugador(li, formacionInicial));
        });

        this.dibujarAlineacion(formacionInicial);
    },

    seleccionarJugador: function(li, formacion) {
        if (!this.jugadorSeleccionado) {
            this.jugadorSeleccionado = li;
            li.classList.add('active', 'bg-primary');
        } else {
            if (this.jugadorSeleccionado !== li) {
                this.intercambiarDOM(this.jugadorSeleccionado, li);
            }
            
            this.jugadorSeleccionado.classList.remove('active', 'bg-primary');
            this.jugadorSeleccionado = null;
            
            this.dibujarAlineacion(formacion);
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
        if (!campo) return;
        
        campo.innerHTML = '';
        const coords = this.coordenadas[formacionActual] || this.coordenadas['4-3-3'];
        
        const titulares = document.querySelectorAll('#lista-titulares li');

        titulares.forEach((li, i) => {
            if (i > 10) return;
            const nombreFull = li.querySelector('strong').innerText;
            const nombreProcesado = nombreFull.split(' ').length > 1 
                ? `${nombreFull.split(' ')[0][0]}. ${nombreFull.split(' ').slice(1).join(' ')}`
                : nombreFull;

            const numero = i + 1;

            const node = document.createElement('div');
            node.className = 'player-node';
            node.style.top = coords[i].t + '%';
            node.style.left = coords[i].l + '%';
            node.innerHTML = `
                <div class="circle">${numero}</div>
                <div class="name">${nombreProcesado}</div>
            `;
            campo.appendChild(node);
        });
    },

    guardarCambios: async function(clubId) {
        const todosLosIds = Array.from(document.querySelectorAll('.list-group-item'))
                                 .map(li => li.getAttribute('data-id'));

        try {
            const response = await fetch(`/guardarAlineacion/${clubId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ nuevaPlantilla: todosLosIds })
            });

            if(response.ok) {
                alert("Alineación guardada correctamente");
            }
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

            if (response.ok) {
                alert("✅ Roles actualizados con éxito");
                location.reload();
            }
        } catch (error) {
            console.error("Error al guardar roles:", error);
        }
    },

    subirCanterano: async function(jugadorId) {
        if (!confirm("¿Deseas promover a este jugador al primer equipo?")) return;

        try {
            const response = await fetch(`/subirCanterano/${jugadorId}`, {
                method: 'POST'
            });

            if (response.ok) {
                alert("⭐ Jugador subido a la plantilla principal");
                location.reload();
            }
        } catch (error) {
            console.error("Error al subir canterano:", error);
        }
    }
};