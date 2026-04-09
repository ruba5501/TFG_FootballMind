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

async function negociarTraspasoClub(jugadorId, precioContraI = 0, tipoNegoc = 'traspaso', futuraVentaI = 0, recompraI = 0, clausulaCompraI = 0) {
    const precioContra = Number(precioContraI);
    const futuraVenta = Number(futuraVentaI);
    const recompra = Number(recompraI);
    const clausulaCompra = Number(clausulaCompraI);

    const form = document.getElementById('formOferta');
    if (form) {
        form.reset();
    }

    const modalObj = new bootstrap.Modal(document.getElementById('modalNegociacion'));
    const btnTraspaso = document.getElementById('modoTraspaso');
    const btnCesion = document.getElementById('modoCesion');
    const tituloModal = document.getElementById('tituloModal');
    const divTraspaso = document.getElementById('camposTraspaso');
    const divCesion = document.getElementById('camposCesion');

    const response = await fetch(`/objetivo/detalleTraspaso/${jugadorId}`);
    const data = await response.json();
    const o = data.objetivo;
    const c = data.clubObjetivo;

    if (precioContra > 0) {
        tituloModal.innerText = "Respuesta a la Contraoferta";
        tituloModal.parentElement.classList.replace('bg-dark', 'bg-primary');

        if (tipoNegoc === 'traspaso') {
            btnTraspaso.checked = true;
            btnCesion.disabled = true;
            divTraspaso.classList.remove('d-none');
            divCesion.classList.add('d-none');
            
            document.getElementById('ofertaPrecio').value = precioContra;
            document.getElementById('futuraVenta').value = futuraVenta;
            document.getElementById('precioRecompra').value = recompra;

            document.querySelector('label[for="ofertaPrecio"]').innerHTML = 
                `Precio Traspaso <span class="badge bg-primary">Sugerido: ${precioContra.toLocaleString()}€</span>`;
            
        } else {
            btnCesion.checked = true;
            btnTraspaso.disabled = true;
            divCesion.classList.remove('d-none');
            divTraspaso.classList.add('d-none');

            document.getElementById('porcentajeSueldo').value = precioContra;
            document.getElementById('valSueldo').innerText = precioContra;

            if (clausulaCompra > 0) {
                document.getElementById('clausulaCompraCheck').checked = true;
                document.getElementById('divClausulaCompra').classList.remove('d-none');
                document.getElementById('valorClausula').value = clausulaCompra;
            }
        }
    } else {
        tituloModal.innerText = "Negociación de Fichaje";
        tituloModal.parentElement.classList.replace('bg-primary', 'bg-dark');
        btnTraspaso.disabled = false;
        btnCesion.disabled = false;
        btnTraspaso.checked = true;
        divTraspaso.classList.remove('d-none');
        divCesion.classList.add('d-none');
        document.querySelector('label[for="ofertaPrecio"]').innerText = "Precio del Traspaso (€)";
    }

    document.getElementById('formOferta').dataset.jugadorId = jugadorId;
    document.getElementById('formOferta').dataset.tipoActual = tipoNegoc;
    document.getElementById('infoNombre').innerText = o.nombre;
    document.getElementById('infoClub').innerText = c ? c.nombre : 'Agente Libre';    
    document.getElementById('infoMedia').innerText = `Media: ${o.valoracion}`;
    document.getElementById('infoPotencial').innerText = `Pot: ${o.potencial}`;
    document.getElementById('infoValor').innerText = `${o.valorMercado.toLocaleString()} €`;
    document.getElementById('infoSalario').innerText = `${(o.salario / 12).toLocaleString()} €/mes (${o.salario.toLocaleString()})`;
    
    //fechas
    const fecha = new Date(o.finContrato);
    const fechaFormateada = fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    document.getElementById('infoContratoFin').innerText = fechaFormateada;

    // Imágenes (Escudo y Bandera)
    const imgEscudo = document.getElementById('infoEscudo');
    imgEscudo.src = c && c.escudo ? `/img/escudos/${c.escudo}` : '';
    imgEscudo.style.display = c && c.escudo ? 'block' : 'none';

    const imgBandera = document.getElementById('infoBandera');
    imgBandera.src = o.nacionalidad ? `/img/banderas/${o.nacionalidad}.png` : '';
    imgBandera.style.display = o.nacionalidad ? 'block' : 'none';

    // Lógica de Interés
    const interes = calcularInteres(o, data.clubObjetivo.reputacion, data.miClub.reputacion, data.fechaActual);
    const barra = document.getElementById('barraInteres');
    barra.style.width = interes + '%';
    if (interes < 20) {
        barra.className = 'progress-bar bg-danger'; 
    } else if (interes < 40) {
        barra.className = 'progress-bar';
        barra.style.backgroundColor = '#fd7e14'; 
    } else if (interes < 60) {
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

    //calcular una posible afinidad a tu club de forma aleatoria con los id para que sea siempre la misma
    const afinidad = (parseInt(j._id.toString().slice(-3), 16) % 31) - 10; 
    score += afinidad;

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
    
    //factor edad
    if (esJovenPromesa) {
        // Si es juven promesa y tu club es importante
        if (tuClub > 80) score += 15;
        // O si tu club no lo es 
        if (tuClub < 60) score -= 20;
    }
    if (j.edad >= 34){
        //si esta cerca de retirarse igual quiere hacerlo en su pais
        if (j.nacionalidad === tuClub.pais) {
            score += 20;
        }
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

async function enviarOferta() {
    const jugadorId = document.getElementById('formOferta').dataset.jugadorId;
    const esTraspaso = document.getElementById('modoTraspaso').checked;
    const interes = parseFloat(document.getElementById('barraInteres').style.width) || 50;
    
    let oferta = {
        tipo: esTraspaso ? 'traspaso' : 'cesion',
        interesJugador: interes
    };

    if (esTraspaso) {
        oferta.precio = parseFloat(document.getElementById('ofertaPrecio').value);
        oferta.futuraVenta = parseFloat(document.getElementById('futuraVenta').value) || 0;
        oferta.precioRecompra = parseFloat(document.getElementById('precioRecompra').value) || 0;
    } else {
        oferta.porcentajeSueldo = parseInt(document.getElementById('porcentajeSueldo').value);
        if (document.getElementById('clausulaCompraCheck').checked) {
            oferta.clausulaCompra = parseFloat(document.getElementById('valorClausula').value);
        }
    }

    try {
        const response = await fetch(`/fichajes/ofertaTraspaso/${jugadorId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oferta })
        });
        const data = await response.json();
        console.log("Respuesta del servidor:", data);
        if (data.redirect) {
            window.location.href = data.redirect;
        } else {
            console.warn("No hay redirect en la respuesta, recargando...");
            location.reload();
        }
    } catch (err) {
        console.error(err);
    }
}

async function abrirNegociacionContrato(id) {
    // 1. Obtener datos usando TU ruta
    const response = await fetch(`/objetivo/detalleTraspaso/${id}`);
    const data = await response.json();
    const o = data.objetivo;
    const miClubId = data.miClub._id;
    const clubSujetoId = data.clubObjetivo ? data.clubObjetivo._id : null;

    // 2. Determinar si es RENOVACIÓN o FICHAJE
    // Si el ID de su club coincide con el mío, es renovación
    const esRenovacion = (clubSujetoId === miClubId);

    // 3. Poblar textos del Modal
    document.getElementById('contNombre').innerText = o.nombre;
    document.getElementById('contTipo').innerText = `${data.tipo.toUpperCase()} - Media ${o.valoracion}`;
    document.getElementById('contSueldoActual').innerText = `${o.salario.toLocaleString()} €/año`;
    
    // Cambiar el título del modal según el contexto
    document.getElementById('tituloModalContrato').innerText = esRenovacion ? "🤝 Renovación de Contrato" : "🤝 Negociación de Fichaje";

    // 4. Adaptar Select de Roles (Jugador vs Empleado)
    const selectRol = document.getElementById('ofertRol');
    selectRol.innerHTML = '';
    
    const opciones = data.tipo === 'jugador' 
        ? ['Clave', 'Titular', 'Rotación', 'Juvenil', 'Descarte'] 
        : ['Primer Entrenador', 'Asistente', 'Preparador', 'Ojeador', 'Fisio'];

    opciones.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt;
        el.innerText = opt;
        if (o.rolEquipo === opt || o.puesto === opt) el.selected = true; // Preseleccionar actual
        selectRol.appendChild(el);
    });

    // 5. Guardar metadata necesaria para el envío
    const form = document.getElementById('formContrato');
    form.dataset.id = id;
    form.dataset.tipo = data.tipo; // 'jugador' o 'empleado'
    form.dataset.esRenovacion = esRenovacion;

    // Mostrar el modal (Asegúrate de que el ID del modal coincida con el HTML)
    const modalContrato = new bootstrap.Modal(document.getElementById('modalContrato'));
    modalContrato.show();
}

async function confirmarContrato() {
    const form = document.getElementById('formContrato');
    const id = form.dataset.id;

    const payload = {
        sueldo: document.getElementById('ofertSueldo').value,
        anios: document.getElementById('ofertAnios').value,
        rol: document.getElementById('ofertRol').value,
        clausula: document.getElementById('ofertClausula').value,
        tipo: form.dataset.tipo,
        esRenovacion: form.dataset.esRenovacion
    };

    // Validar sueldo positivo
    if (!payload.sueldo || payload.sueldo <= 0) {
        return Swal.fire("Error", "Introduce un sueldo válido", "warning");
    }

    try {
        const res = await fetch(`/objetivo/confirmarContrato/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            Swal.fire("🤝 ¡Acuerdo!", result.mensaje, "success").then(() => {
                location.reload();
            });
        } else {
            Swal.fire("❌ Rechazado", result.mensaje, "error");
        }
    } catch (err) {
        console.error(err);
    }
}

async function cancelarNegociacion(negId) {
    const result = await Swal.fire({
        title: '¿Retirar oferta?',
        text: "Perderás el progreso de la negociación",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, retirar'
    });

    if (result.isConfirmed) {
        const res = await fetch(`/negociaciones/cancelar/${negId}`, { method: 'DELETE' });
        if (res.ok) {
            Swal.fire('Cancelada', 'La oferta ha sido retirada', 'success')
                .then(() => location.reload());
        }
    }
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