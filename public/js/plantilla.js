/*sirve para cantera y para plantilla*/
function verDetalleJugador(id) {
    const panel = document.getElementById('panelDetalleJugador');
    panel.innerHTML = '<div class="text-center mt-5"><div class="spinner-border"></div></div>';

    fetch(`/jugador/detalle/${id}`)
        .then(res => res.text())
        .then(html => {
            panel.innerHTML = html;
            const triggerTabList = [].slice.call(document.querySelectorAll('#jugadorTabs button'))
            triggerTabList.forEach(function (triggerEl) {
                const tabTrigger = new bootstrap.Tab(triggerEl)
                triggerEl.addEventListener('click', function (event) {
                    event.preventDefault()
                    tabTrigger.show()
                })
            })
        });
}

async function accionJugador(id, tipo) {
    try {
        const response = await fetch(`/jugador/cambiar-estado/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: tipo }) // tipo puede ser 'transferible' o 'cedible'
        });
        const result = await response.json();

        if (result.success) {
            verDetalleJugador(id);
        }
    } catch (err) {
        console.error("Error en la acción:", err);
    }
}

let mapaDorsales = {}; 
let idJugadorActual = null;

async function abrirModalDorsal(jugadorId) {
    idJugadorActual = jugadorId;
    
    const input = document.getElementById('inputDorsal');
    const infoLibre = document.getElementById('infoLibre');
    const infoOcupante = document.getElementById('infoOcupante');

    // Estado de espera
    infoLibre.innerHTML = 'Cargando dorsales...';
    infoOcupante.classList.add('d-none');
    
    // Abrir el modal
    const modalElement = document.getElementById('modalDorsal');
    const modalBootstrap = bootstrap.Modal.getOrCreateInstance(modalElement);
    modalBootstrap.show();

    try {
        const res = await fetch(`/club/dorsales-ocupados?clubId=${CLUB_ID_ACTUAL}`);
        const data = await res.json();
        
        mapaDorsales = data.ocupados || {};

        input.value = 1;
        actualizarEstadoDorsal(1);
        
    } catch (err) {
        console.error("Error al obtener ocupados:", err);
        infoLibre.innerHTML = "Error de conexión";
    }
}

function actualizarEstadoDorsal(num) {
    const infoOcupante = document.getElementById('infoOcupante');
    const infoLibre = document.getElementById('infoLibre');
    
    const numeroABuscar = String(num).trim();
    const ocupante = mapaDorsales[numeroABuscar];

    if (ocupante) {
        infoOcupante.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i> Ocupado por: <strong>${ocupante}</strong>`;
        infoOcupante.classList.remove('d-none');
        infoLibre.classList.add('d-none');
    } else {
        infoOcupante.classList.add('d-none');
        infoLibre.classList.remove('d-none');
        infoLibre.innerHTML = '<i class="bi bi-check-circle-fill"></i> Dorsal disponible';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputD = document.getElementById('inputDorsal');
    if (inputD) {
        inputD.addEventListener('input', (e) => {
            actualizarEstadoDorsal(e.target.value);
        });
    }

    const btnConf = document.getElementById('btnConfirmarDorsal');
    if (btnConf) {
        btnConf.onclick = function() {
            const num = document.getElementById('inputDorsal').value;
            console.log("Botón confirmar pulsado. Dorsal:", num, "ID Jugador:", idJugadorActual);
            
            if (!idJugadorActual) {
                alert("Error: No se detecta el ID del jugador");
                return;
            }

            ejecutarCambioDorsal(idJugadorActual, num);
        };
    }
});

function ejecutarCambioDorsal(id, dorsal) {
    console.log("Enviando petición de cambio al servidor...");
    fetch(`/jugador/cambiar-dorsal/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dorsal: dorsal })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Respuesta del servidor:", data);
        if (data.success) {
            const modalElement = document.getElementById('modalDorsal');
            const inst = bootstrap.Modal.getInstance(modalElement);
            if (inst) inst.hide();
            
            verDetalleJugador(id);
            actualizarFilaTabla(id, dorsal);

            if (data.mensaje.includes("intercambiados")) {
                location.reload(); 
            }
        } else {
            alert("Error: " + data.error);
        }
    })
    .catch(err => console.error("Error en fetch cambio:", err));
}

function actualizarFilaTabla(id, nuevoDorsal) {
    const filas = document.querySelectorAll('table tbody tr');
    filas.forEach(fila => {
        if (fila.getAttribute('onclick') && fila.getAttribute('onclick').includes(id)) {
            const tdDorsal = fila.querySelector('td:first-child');
            if (tdDorsal) {
                tdDorsal.textContent = nuevoDorsal;
                tdDorsal.classList.add('table-success');
                setTimeout(() => tdDorsal.classList.remove('table-success'), 2000);
            }
        }
    });
}

function enviarOjeador(ojeadorId) {
    const pais = document.getElementById(`select-pais-${ojeadorId}`).value;
    const meses = document.getElementById(`input-meses-${ojeadorId}`).value;

    fetch('/ojeador/enviar-ojeador', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ojeadorId, pais, meses })
    }).then(res => res.json()).then(data => {
        if(data.success) location.reload();
        else alert(data.message);
    });
}

function cancelarMision(ojeadorId) {
    if (!confirm("¿Estás seguro de cancelar la misión? Perderás cualquier informe en progreso.")) return;

    fetch('/ojeador/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ojeadorId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.reload();
        } else {
            alert("Error al cancelar la misión");
        }
    });
}

function subirPrimerEquipo(id) {
    if(confirm("¿Estás seguro de que quieres subir a este jugador? Ocupará una ficha del primer equipo.")) {
        fetch(`/cantera/promocionar/${id}`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if(data.success) window.location.href = '/plantilla';
            });
    }
}