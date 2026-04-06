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
function verDetalleEmpleado(id) {
    const panel = document.getElementById('panelDetalleEmpleado');
    panel.innerHTML = '<div class="text-center mt-5"><div class="spinner-border"></div></div>';

    fetch(`/empleado/detalle/${id}`)
        .then(res => res.text())
        .then(html => {
            panel.innerHTML = html;
            const triggerTabList = [].slice.call(document.querySelectorAll('#empleadoTabs button'))
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

async function gestionarListaObjetivos(id, accion, tipo) {
    try {
        const response = await fetch(`/listaObjetivos/${accion}/${tipo}/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();

        if (result.success) {
            if (accion === 'quitar') {
                if (document.getElementById('tab-listaObjetivos')) {
                    const elemento = document.getElementById(`card-objetivo-${id}`);
                    if (elemento) {
                        elemento.style.transition = "opacity 0.3s ease";
                        elemento.style.opacity = "0";
                        setTimeout(() => elemento.remove(), 300);
                    }
                }
                else{
                    tipo === 'jugador' ? verDetalleJugador(id) : verDetalleEmpleado(id);
                }
            }
            else{
                tipo === 'jugador' ? verDetalleJugador(id) : verDetalleEmpleado(id);
            }
        } else {
            alert("Error: " + result.message);
        }
    } catch (err) {
        console.error("Error en la lista de objetivos:", err);
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












let modalObj;

document.addEventListener('DOMContentLoaded', () => {
    modalObj = new bootstrap.Modal(document.getElementById('modalNegociacion'));
});

async function negociarTraspasoClub(jugadorId) {
    document.getElementById('formOferta').reset();
    let currentJugadorId = jugadorId;
    const modalObj = new bootstrap.Modal(document.getElementById('modalNegociacion'));

    // 1. Obtener datos extendidos del jugador (necesitas un endpoint que devuelva esto)
    const response = await fetch(`/objetivo/detalleTraspaso/${jugadorId}`);
    const data = await response.json();
    const o = data.objetivo;
    const c = data.clubObjetivo;
    const cu = data.miClub;

    
    // 2. Poblar Modal
    document.getElementById('formOferta').dataset.jugadorId = jugadorId;
    document.getElementById('infoNombre').innerText = o.nombre;
    document.getElementById('infoClub').innerText = c ? c.nombre : 'Agente Libre';    
    document.getElementById('infoMedia').innerText = `Media: ${o.valoracion}`;
    document.getElementById('infoPotencial').innerText = `Pot: ${o.potencial}`;
    document.getElementById('infoValor').innerText = `${o.valorMercado.toLocaleString()} €`;
    document.getElementById('infoSalario').innerText = `${(o.salario / 12).toLocaleString()} €/mes (${o.salario.toLocaleString()})`;
    const fecha = new Date(o.finContrato);
    const fechaFormateada = fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    document.getElementById('infoContratoFin').innerText = fechaFormateada;

    const imgEscudo = document.getElementById('infoEscudo');
    if (c && c.escudo) {
        imgEscudo.src = `/img/escudos/${c.escudo}`;
        imgEscudo.style.display = 'block';
    } else {
        imgEscudo.style.display = 'none';
    }

    const imgBandera = document.getElementById('infoBandera');
    if (o.nacionalidad) {
        imgBandera.src = `/img/banderas/${o.nacionalidad}.png`; 
        imgBandera.style.display = 'block';
    } else {
        imgBandera.style.display = 'none';
    }
    // 3. Lógica de Interés (Frontend-Simulada antes de enviar)
    const interes = calcularInteres(o, data.clubObjetivo.reputacion, data.miClub.reputacion, data.fechaActual);
    const barra = document.getElementById('barraInteres');
    barra.style.width = interes + '%';
    if (interes < 20) {
        barra.className = 'progress-bar bg-danger'; 
    } else if (interes < 40) {
        barra.className = 'progress-bar';
        barra.style.backgroundColor = '#fd7e14'; 
    } else if (interes < 60) {
        // Amarillo
        barra.className = 'progress-bar bg-warning text-dark';
        barra.style.backgroundColor = ''; 
    } else if (interes < 85) {
        barra.className = 'progress-bar bg-success';
        barra.style.backgroundColor = '';
    } else {
        barra.className = 'progress-bar';
        barra.style.backgroundColor = '#155724'; 
    }

    document.getElementById('textoInteres').innerText = obtenerLabelInteres(interes);

    // 4. Mostrar modal
    modalObj.show();
}

// Lógica de UI para cambiar entre Traspaso y Cesión
document.getElementsByName('modoNegoc').forEach(radio => {
    radio.addEventListener('change', (e) => {
        document.getElementById('camposTraspaso').classList.toggle('d-none', e.target.id !== 'modoTraspaso');
        document.getElementById('camposCesion').classList.toggle('d-none', e.target.id !== 'modoCesion');
    });
});

document.getElementById('porcentajeSueldo').addEventListener('input', (e) => {
    document.getElementById('valSueldo').innerText = e.target.value;
});

document.getElementById('clausulaCompraCheck').addEventListener('change', (e) => {
    document.getElementById('valorClausula').classList.toggle('d-none', !e.target.checked);
});

function calcularInteres(j, clubOrigen, tuClub, fechaActualPartida) {
    let score = 50;
    const difClubes = tuClub - clubOrigen;
    const nivelJugadorVsClubActual = j.valoracion - clubOrigen;
    const esJovenPromesa = j.edad < 23 && j.potencial > 80;
    const hoy = new Date(fechaActualPartida);
    const fin = new Date(j.finContrato);
    const mesesRestantes = (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth());

    // Si tu club es mucho más prestigioso que el suyo
    if (difClubes > 20){ score += 45; }
    // Salto importante
    else if (difClubes > 10){ score += 25; }
    // Si tu club es inferior 
    else if (difClubes < -15) {
        if (j.rolEquipo !== 'clave' && j.rolEquipo !== 'titular') {
            score += 5;
        } else {
            score -= 40; 
        }
    }
    // Si son clubes de nivel similar
    else score += (difClubes * 2.5); 
    // Si el jugador es demasiado bueno para su club actual
    if (nivelJugadorVsClubActual > 5) {
        score += 15;
        if (tuClub > clubOrigen) score += 10;
    }
    //Si el jugador es demasiado bueno para tu club
    if (j.valoracion > tuClub + 12) score -= 35;
    // Si es "Clave" en un club
    if (j.rolEquipo === 'clave') {
        if (difClubes < -5) {
            // Si tu club es peor
            score -= 25;
        } else {
            // Si tu club es mejor
            score += 15; 
        }
    }
    // Si esta descontento en su club actual
    if (j.estado.satisfaccion < 40) score += 30;
    else if (j.estado.satisfaccion < 60) score += 15;
    else if (j.estado.satisfaccion > 85) score -= 10;
    
    if (esJovenPromesa) {
        // Si es juven promesa y tu club es importante
        if (tuClub > 80) score += 15;
        // O si tu club no lo es 
        if (tuClub < 60) score -= 20;
    }
    //Le quedan 6 meses o menos
    if (mesesRestantes <= 6) {
        if (tuClub >= clubOrigen - 10) score += 30; 
        else score += 15;
    } 
    // Le queda entre 7 y 12 meses 
    else if (mesesRestantes <= 12) {
        score += 10;
    }
    // Contrato muy largo
    else if (mesesRestantes > 36) {
        score -= 10;
    }
    return Math.min(100, Math.max(0, score));
}

function obtenerLabelInteres(val) {
    if (val < 20) return "No esta muy dispuesto a negociar asique será difícil ficharle";
    if (val < 40) return "No está demasiado interesado.";
    if (val < 60) return "Abierto a negociar.";
    if (val < 85) return "Esta interesado en negociar.";
    if (val < 100) return "Muy interesado.";

}

function enviarOferta() {
    const jugadorId = document.getElementById('formOferta').dataset.jugadorId;
    const esTraspaso = document.getElementById('modoTraspaso').checked;
    
    let payload = {
        jugadorId: jugadorId,
        tipo: esTraspaso ? 'traspaso' : 'cesion'
    };

    if (esTraspaso) {
        const precio = parseFloat(document.getElementById('ofertaPrecio').value);
        if (!precio || precio <= 0) {
            return alert("Por favor, introduce un precio de traspaso válido (mayor a 0).");
        }
        payload.precio = precio;
        payload.futuraVenta = parseFloat(document.getElementById('futuraVenta').value) || 0;
        payload.precioRecompra = parseFloat(document.getElementById('precioRecompra').value) || 0;

        // Validar que no pongan -5% en futura venta
        if (payload.futuraVenta < 0 || payload.precioRecompra < 0) {
            return alert("Los valores opcionales no pueden ser negativos.");
        }

    } else {
        payload.porcentajeSueldo = parseInt(document.getElementById('porcentajeSueldo').value);
        
        if (document.getElementById('clausulaCompraCheck').checked) {
            const clausula = parseFloat(document.getElementById('valorClausula').value);
            if (!clausula || clausula <= 0) {
                return alert("Si incluyes cláusula de compra, debe tener un valor mayor a 0.");
            }
            payload.clausulaCompra = clausula;
        }
    }

    console.log("Enviando propuesta:", payload);
    // Aquí iría tu fetch('/objetivo/enviarOferta', { method: 'POST', body: JSON.stringify(payload) ... })
}

function iniciarNegociacionContrato(id) {
    window.location.href = `/fichajes/contrato/${id}`;
}











function verAtributos(jugadorId) {
    const contenedor = document.getElementById('contenidoModalJugador');
    
    contenedor.innerHTML = `
        <div class="text-center p-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Cargando informe técnico...</p>
        </div>`;

    const modalElement = document.getElementById('modalAtributos');
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    bsModal.show();

    fetch(`/jugador/atributos/${jugadorId}`)
            .then(res => res.text())
            .then(html => {
                contenedor.innerHTML = `<div class="p-3">${html}</div>`;
            });
}
function verAtributosEmpleado(empleadoId) {
    const contenedor = document.getElementById('contenidoModalJugador');
    
    contenedor.innerHTML = `
        <div class="text-center p-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Cargando informe técnico...</p>
        </div>`;

    const modalElement = document.getElementById('modalAtributos');
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    bsModal.show();

    fetch(`/empleado/atributos/${empleadoId}`)
            .then(res => res.text())
            .then(html => {
                contenedor.innerHTML = `<div class="p-3">${html}</div>`;
            });
}
document.addEventListener('input', (e) => {
    const valInput = e.target;
    
    if (valInput.name && (valInput.name.includes('Min') || valInput.name.includes('Max'))) {
        const inputName = valInput.name.replace('Min', '').replace('Max', '');
        const inputMin = document.querySelector(`input[name="${inputName}Min"]`);
        const inputMax = document.querySelector(`input[name="${inputName}Max"]`);

        if (!inputMin || !inputMax) return;

        let limiteMax = 1000000000;
        if (inputName === 'edad') limiteMax = 100;
        if (inputName !== 'edad' && inputName !== 'valor') limiteMax = 99;

        if (parseInt(valInput.value) < 0) valInput.value = 0;
        if (parseInt(valInput.value) > limiteMax) valInput.value = limiteMax;

        if (valInput.name.includes('Min')) {
            inputMax.min = valInput.value || 0;
        }
        
        if (valInput.name.includes('Max')) {
            inputMin.max = valInput.value || limiteMax;
        }
    }
});