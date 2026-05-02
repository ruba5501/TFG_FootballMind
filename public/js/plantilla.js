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

function calcularInteresRenovacion(j, tuClubReputacion, fechaActualPartida) {
    let score = 70;
    
    const hoy = new Date(fechaActualPartida);
    const fin = new Date(j.finContrato);
    const mesesRestantes = (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth());

    // Satisfacción actual, si esta satisfecho querrá quedarse, si no se querrá ir
    score += (j.estado.satisfaccion - 60); 

    // Nivel del jugador vs Club
    const diferenciaNivel = j.valoracion - tuClubReputacion;
    if (diferenciaNivel > 5) score -= 20; // Se siente demasiado bueno para el club
    if (diferenciaNivel > 10) score -= 30; // Quiere irse a un grande ya

    if (j.potencial > tuClubReputacion + 15 && j.valoracion > 70) {
        score -= 30; 
    }
    // Rol en el equipo
    if (j.rolEquipo === 'clave' || j.rolEquipo === 'titular') score += 15;
    if (j.rolEquipo === 'suplente') score -= 20;
    if (j.rolEquipo === 'reserva') score -= 40;

    // Urgencia de contrato, si le queda poco tendra mas interes en renovar y si le queda mucho no tendra tanto interes
    if (mesesRestantes <= 6) score -= 10;
    if (mesesRestantes > 24) score += 10;

    // cuando estan mas cerca de retirarse suelen estar mas predispuestos a renovar
    if (j.edad > 33) score += 15;

    return Math.min(100, Math.max(0, score));
}

function obtenerLabelInteres(val) {
    if (val < 20) return "No esta muy dispuesto a negociar asique será difícil ficharle";
    if (val < 40) return "No está demasiado interesado.";
    if (val < 60) return "Abierto a negociar.";
    if (val < 85) return "Esta interesado en negociar.";
    if (val <= 100) return "Muy interesado.";

}

// Lógica de UI para cambiar entre Traspaso y Cesión
document.getElementsByName('modoNegoc').forEach(radio => {
    radio.addEventListener('change', (e) => {
        document.getElementById('camposTraspaso').classList.toggle('d-none', e.target.id !== 'modoTraspaso');
        document.getElementById('camposCesion').classList.toggle('d-none', e.target.id !== 'modoCesion');
    });
});

async function negociarTraspasoClub(jugadorId, precioOfertaI = 0, precioContraI = 0, tipoNegoc = 'traspaso', futuraVentaI = 0, recompraI = 0, clausulaCompraI = 0) {
    const precioOferta = Number(precioOfertaI);
    const precioContra = Number(precioContraI);
    const futuraVenta = Number(futuraVentaI);
    const recompra = Number(recompraI);
    const clausulaCompra = Number(clausulaCompraI);

    const form = document.getElementById('formOferta');
    if (form) {
        form.reset();
    }
    
    const contenedorInteres = document.getElementById('contenedorInteres');
    if (contenedorInteres) contenedorInteres.style.display = 'block';

    const modalObj = new bootstrap.Modal(document.getElementById('modalNegociacion'))

    const btnTraspaso = document.getElementById('modoTraspaso');
    const btnCesion = document.getElementById('modoCesion');
    const tituloModal = document.getElementById('tituloModal');
    const divTraspaso = document.getElementById('camposTraspaso');
    const divCesion = document.getElementById('camposCesion');

    const response = await fetch(`/objetivo/detalleTraspaso/${jugadorId}`);
    const data = await response.json();
    const o = data.objetivo;
    const c = data.clubObjetivo;
    const inputPrecio = document.getElementById('ofertaPrecio');
    const inputPorcentajeFutVenta = document.getElementById('futuraVenta');
    const inputRecompra = document.getElementById('precioRecompra');
    const inputSueldo = document.getElementById('porcentajeSueldo');
    const inputclauCompra = document.getElementById('valorClausula');

    if (precioContra > 0) {
        tituloModal.innerText = "Respuesta a la Contraoferta";
        tituloModal.parentElement.classList.replace('bg-dark', 'bg-primary');

        if (tipoNegoc === 'traspaso') {
            btnTraspaso.checked = true;
            btnCesion.disabled = true;
            divTraspaso.classList.remove('d-none');
            divCesion.classList.add('d-none');
            inputPrecio.value = precioOferta;
            inputPorcentajeFutVenta.value = futuraVenta;
            inputRecompra.value = recompra;

            if (data.basicoAceptado) {
                inputPrecio.readOnly = true;
                inputPrecio.classList.add('bg-light');
                inputPorcentajeFutVenta.readOnly = true;
                inputPorcentajeFutVenta.classList.add('bg-light');

                document.querySelector('label[for="precioRecompra"]').innerHTML = 
                `Precio Recompra <span class="badge bg-primary">Sugerido: ${precioContra.toLocaleString()}€</span>`;
            }
            else{
                document.querySelector('label[for="ofertaPrecio"]').innerHTML = 
                `Precio Traspaso <span class="badge bg-primary">Sugerido: ${precioContra.toLocaleString()}€</span>`;
            }
            
        } else {
            btnCesion.checked = true;
            btnTraspaso.disabled = true;
            divCesion.classList.remove('d-none');
            divTraspaso.classList.add('d-none');

            inputSueldo.value = precioOferta;
            inputclauCompra.value = clausulaCompra;

            if (data.basicoAceptado) {
                inputSueldo.readOnly = true;
                inputSueldo.classList.add('bg-light');

                document.querySelector('label[for="valorClausula"]').innerHTML = 
                `Clausula Compra <span class="badge bg-primary">Sugerido: ${precioContra.toLocaleString()}€</span>`;
                
            }
            else{
                document.querySelector('label[for="porcentajeSueldo"]').innerHTML = 
                `Porcentaje de Sueldo <span class="badge bg-primary">Sugerido: ${precioContra.toLocaleString()}%</span>`;
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
    const reputacionClubObjetivo = data.clubObjetivo ? data.clubObjetivo.reputacion : 0;
    const reputacionMiClub = data.miClub ? data.miClub.reputacion : 0;
    const interes = calcularInteres(o, reputacionClubObjetivo, reputacionMiClub, data.fechaActual);
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
        oferta.clausulaCompra = parseFloat(document.getElementById('valorClausula').value);
    }

    try {
        const response = await fetch(`/fichajes/ofertaTraspaso/${jugadorId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oferta })
        });
        const data = await response.json();
        if (data.redirect) {
            window.location.href = data.redirect;
        } else {
            location.reload();
        }
    } catch (err) {
        console.error(err);
    }
}

async function verOfertaRecibida(negociacionId) {
    const form = document.getElementById('formOferta');
    if (form) form.reset();

    const response = await fetch(`/objetivo/detalleOfertaRecibida/${negociacionId}`);
    const data = await response.json();
    
    const neg = data.negociacion;
    const jugador = data.objetivo; 
    const clubEmisor = data.clubEmisor; 
    const miClub = data.miClub;
    const isBasicoAceptado = neg.basicoAceptado || false;

    const tituloModal = document.getElementById('tituloModal');
    const headerModal = document.getElementById('headerNegociacion');     
    const btnTraspaso = document.getElementById('modoTraspaso');
    const btnCesion = document.getElementById('modoCesion');
    const divTraspaso = document.getElementById('camposTraspaso');
    const divCesion = document.getElementById('camposCesion');
    const contenedorInteres = document.getElementById('contenedorInteres');
    if (contenedorInteres) contenedorInteres.style.display = 'none';

    const inputPrecio = document.getElementById('ofertaPrecio');
    const inputFuturaVenta = document.getElementById('futuraVenta');
    const inputRecompra = document.getElementById('precioRecompra');
    const inputSueldo = document.getElementById('porcentajeSueldo');
    const inputClauCompra = document.getElementById('valorClausula');

    [inputPrecio, inputFuturaVenta, inputSueldo].forEach(el => {
        el.readOnly = false;
        el.classList.remove('bg-light');
    });


    // Info Básica
    tituloModal.innerText = "Oferta Recibida ";
    headerModal.classList.remove('bg-dark', 'bg-primary');
    headerModal.classList.add('bg-success');

    document.getElementById('infoNombre').innerText = jugador.nombre;
    document.getElementById('infoClub').innerText = miClub.nombre;
    document.getElementById('infoMedia').innerText = `Media: ${jugador.valoracion}`;
    document.getElementById('infoPotencial').innerText = `Pot: ${jugador.potencial}`;
    document.getElementById('infoValor').innerText = `${jugador.valorMercado.toLocaleString()} €`;
    document.getElementById('infoSalario').innerText = `${(jugador.salario / 12).toLocaleString()} €/mes`;

    //fechas
    const fecha = new Date(jugador.finContrato);
    const fechaFormateada = fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    document.getElementById('infoContratoFin').innerText = fechaFormateada;
    
    // Imágenes (Escudo y Bandera)
    const imgEscudo = document.getElementById('infoEscudo');
    imgEscudo.src = miClub && miClub.escudo ? `/img/escudos/${miClub.escudo}` : '';
    imgEscudo.style.display = miClub && miClub.escudo ? 'block' : 'none';

    const imgBandera = document.getElementById('infoBandera');
    imgBandera.src = jugador.nacionalidad ? `/img/banderas/${jugador.nacionalidad}.png` : '';
    imgBandera.style.display = jugador.nacionalidad ? 'block' : 'none';
    
    tipoEfectivo = neg.tipoOferta || neg.tipo; 

    if (tipoEfectivo === 'traspaso') {
        btnTraspaso.checked = true;
        btnCesion.disabled = true; 
        divTraspaso.classList.remove('d-none');
        divCesion.classList.add('d-none');

        inputPrecio.value = neg.contraofertaTraspaso || 0;
        inputFuturaVenta.value = neg.porcentajeFuturaVenta || 0;
        inputRecompra.value = neg.tuContraofertaRecompra || 0;
        
        if (isBasicoAceptado) {
            inputPrecio.readOnly = true;
            inputPrecio.classList.add('bg-light');
            inputFuturaVenta.readOnly = true;
            inputFuturaVenta.classList.add('bg-light');

             document.querySelector('label[for="precioRecompra"]').innerHTML = 
            `Precio Recompra <span class="badge bg-primary">Sugerido: ${neg.precioRecompra.toLocaleString()}€</span>`;
        }
        else{
            document.querySelector('label[for="ofertaPrecio"]').innerHTML = 
            `Precio Traspaso <span class="badge bg-primary">Sugerido: ${neg.ofertaTraspaso.toLocaleString()}€</span>`;
        }
        
    } else {
        btnCesion.checked = true;
        btnTraspaso.disabled = true;
        divCesion.classList.remove('d-none');
        divTraspaso.classList.add('d-none');

        inputSueldo.value = neg.contraofertaTraspaso || neg.porcentajeSueldo || 0;
        inputClauCompra.value = neg.tuContraofertaClausulaCompra || 0;

        if (isBasicoAceptado) {
            inputSueldo.readOnly = true;
            inputSueldo.classList.add('bg-light');
            
            document.querySelector('label[for="valorClausula"]').innerHTML = 
            `Clausula Compra <span class="badge bg-primary">Sugerido: ${neg.clausulaCompra.toLocaleString()}€</span>`;
        }
        else{
            document.querySelector('label[for="porcentajeSueldo"]').innerHTML = 
            `Porcentaje de Sueldo <span class="badge bg-primary">Sugerido: ${neg.porcentajeSueldo.toLocaleString()}%</span>`;
        }
    }

    form.dataset.negociacionId = negociacionId;
    form.dataset.modoEnvio = 'respuestaVenta';

    const btnAccion = document.querySelector('#formOferta button[onclick*="enviar"]');
    if (btnAccion) {
        btnAccion.innerText = "Enviar Contraoferta";
        btnAccion.setAttribute('onclick', `responderOfertaCPU('${negociacionId}')`);
    }

    const modalObj = new bootstrap.Modal(document.getElementById('modalNegociacion'));
    modalObj.show();
}

async function responderOfertaCPU(negociacionId) {
    const esTraspaso = document.getElementById('modoTraspaso').checked;
    
    let oferta = {
        tipo: esTraspaso ? 'traspaso' : 'cesion',
        interesJugador: 50
    };

    if (esTraspaso) {
        oferta.contraofertaTraspaso = parseFloat(document.getElementById('ofertaPrecio').value) || 0;
        oferta.porcentajeFuturaVenta = parseFloat(document.getElementById('futuraVenta').value) || 0;
        oferta.tuContraofertaRecompra = parseFloat(document.getElementById('precioRecompra').value) || 0;
    } else {
        oferta.contraofertaTraspaso = parseInt(document.getElementById('porcentajeSueldo').value) || 0;
        oferta.tuContraofertaClausulaCompra = parseFloat(document.getElementById('valorClausula').value) || 0;
    }

    try {
        const response = await fetch(`/fichajes/responderOfertaRecibida/${negociacionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                accion: 'contraofertar', 
                oferta: oferta 
            })
        });

        const data = await response.json();
        
        if (data.success) {
            location.reload();
        } else {
            alert("Error al enviar la contraoferta: " + data.message);
        }
    } catch (err) {
        console.error("Error en responderOfertaCPU:", err);
        alert("Error de conexión con el servidor");
    }
}

async function NegociarContrato(id, sueldoOf = null, sueldoContraI = null, aniosContraI = null,
     rolContraI = '', primaContraI = null, aniosOf = null, 
     rolOf = '', clauOf = null, primaOf = null) {
    const sueldoOferta = sueldoOf ? Number(sueldoOf) : null;
    const sueldoContra = sueldoContraI ? Number(sueldoContraI) : null;
    const aniosContra = aniosContraI ? Number(aniosContraI) : null;
    const primaContra = primaContraI ? Number(primaContraI) : null;
    const aniosOferta = aniosOf ? Number(aniosOf) : null;
    const clauOferta = clauOf ? Number(clauOf) : null;
    const primaOferta = primaOf ? Number(primaOf) : null;
    const jerarquiaRoles = { 'clave': 5, 'importante': 4, 'suplente': 3, 'reserva': 2, 'promesa': 1 };

    const response = await fetch(`/objetivo/detalleTraspaso/${id}`);
    const data = await response.json();
    const o = data.objetivo;
    const miClubId = data.miClub._id;
    const clubSujetoId = data.clubObjetivo ? data.clubObjetivo._id : null;
    const esRenovacion = (clubSujetoId === miClubId);

    const modalContrato = new bootstrap.Modal(document.getElementById('modalContrato'))  
    document.getElementById('formContrato').reset();

    // Referencias a inputs
    const inputSueldo = document.getElementById('ofertaSueldo');
    const inputAnios = document.getElementById('ofertaAnios');
    const inputRol = document.getElementById('ofertaRol');
    const inputClausula = document.getElementById('ofertaClausula');
    const contenedorClausula = inputClausula.closest('.col-md-6');
    const inputPrima = document.getElementById('ofertaPrima');
    const tituloModal = document.getElementById('tituloModalContrato');
    
    inputRol.innerHTML = '';
    const opciones = data.tipo === 'jugador' 
        ? ['clave', 'importante', 'suplente', 'reserva', 'promesa'] 
        : ['preparadorFisico','preparadorTecnico','preparadorTactico','preparadorPorteros','psicologo','medico','fisio','ojeador','ojeadorCantera','entrenadorCantera','segundoEntrenador'];

    opciones.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt;
        el.innerText = opt;
        if (rolOf === opt || (!rolOf && (o.rolEquipo === opt || o.puesto === opt))) el.selected = true;
        inputRol.appendChild(el);
    });
    inputSueldo.readOnly = false;
    inputSueldo.classList.remove('bg-light');
    inputAnios.disabled = false;
    inputAnios.classList.remove('bg-light');
    inputRol.disabled = false;
    inputRol.classList.remove('bg-light');

    if (sueldoContra > 0 || aniosContra > 0 || rolContraI != '' || primaOferta > 0 ) {
        tituloModal.innerText = "Respuesta a Contraoferta del Jugador";
        tituloModal.parentElement.classList.replace('bg-primary', 'bg-info');
        
        inputSueldo.value = sueldoOferta > 0 ? sueldoOferta : sueldoContra;
        inputAnios.value = aniosOferta;
        inputClausula.value = clauOferta;
        inputPrima.value = primaOferta;

        if(sueldoContra != null && sueldoContra > sueldoOferta){
            document.querySelector('label[for="ofertaSueldo"]').innerHTML = 
                `Sueldo Anual (€) <span class="badge bg-primary">Sugerido: ${sueldoContra.toLocaleString()}€</span>`;
        }
        if(aniosContra != null && aniosContra < aniosOferta){
            document.querySelector('label[for="ofertaAnios"]').innerHTML = 
            `Duración (Años) <span class="badge bg-primary">max: ${aniosContra}</span>`;
        }
        if(rolContraI != ''){
            document.querySelector('label[for="ofertaRol"]').innerHTML = 
                `Rol Prometido <span class="badge bg-primary">Pide: ${rolContraI}</span>`;
        }
        if (data.basicoContratoAceptado) {
            inputSueldo.readOnly = true;
            inputSueldo.classList.add('bg-light');
            inputAnios.disabled = true;
            inputAnios.classList.add('bg-light');
            inputRol.disabled = true;
            inputRol.classList.add('bg-light');
             document.querySelector('label[for="ofertaPrima"]').innerHTML = 
            `Prima (€) <span class="badge bg-primary">Sugerido: ${primaContra}</span>`;
        }
    } else {
        tituloModal.innerText = esRenovacion ? "Renovación de Contrato" : "Negociación de Fichaje";
        tituloModal.parentElement.classList.replace('bg-info', 'bg-primary');
        document.querySelector('label[for="ofertaSueldo"]').innerText = "Sueldo Anual (€)";
        document.querySelector('label[for="ofertaAnios"]').innerText = "Duración (Años)";
        document.querySelector('label[for="ofertaRol"]').innerText = "Rol Prometido";
    }

    document.getElementById('contNombre').innerText = o.nombre;
    const isJugador = document.getElementById('isJugador');
    const interesJugador = document.getElementById('interesJugador');
    if (data.tipo === 'jugador') {
        isJugador.classList.remove('d-none');
        if (interesJugador) interesJugador.classList.remove('d-none');
        if (contenedorClausula) contenedorClausula.classList.remove('d-none');
        document.getElementById('Media').innerText = `Media: ${o.valoracion}`;
        document.getElementById('Potencial').innerText = `Pot: ${o.potencial}`;
        
        interesJugador.classList.remove('d-none');
        const reputacionClubObjetivo = data.clubObjetivo ? data.clubObjetivo.reputacion : 0;
        const reputacionMiClub = data.miClub ? data.miClub.reputacion : 0;
        const interes = esRenovacion ? calcularInteresRenovacion(o, reputacionMiClub, data.fechaActual) : calcularInteres(o, reputacionClubObjetivo, reputacionMiClub, data.fechaActual);
        const barra = document.getElementById('barraInteresContrato');
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

        document.getElementById('textoInteresContrato').innerText = obtenerLabelInteres(interes);

    } else {
        isJugador.classList.add('d-none');
        if (interesJugador) interesJugador.classList.add('d-none');
        if (contenedorClausula) contenedorClausula.classList.add('d-none');
        inputClausula.value = 0;
    }
    const finContrato = document.getElementById('finContrato');
    const txtFin = document.getElementById('contFinContrato');

    if (esRenovacion && o.finContrato) {
        finContrato.classList.remove('d-none');
        
        const fecha = new Date(o.finContrato);
        txtFin.innerText = fecha.toLocaleDateString('es-ES', {
            month: 'long',
            year: 'numeric'
        });
    } else {
        finContrato.classList.add('d-none');
    }
    document.getElementById('contTipo').innerText = `${data.tipo.toUpperCase()}`;
    document.getElementById('contSueldoActual').innerText = `${o.salario.toLocaleString()} €/año`;
    document.getElementById('tituloModalContrato').innerText = esRenovacion ? "Renovación de Contrato" : "Negociación de Fichaje";

    const selectRol = document.getElementById('ofertaRol');
    
    const form = document.getElementById('formContrato');
    form.dataset.id = id;
    form.dataset.tipo = data.tipo; // 'jugador' o 'empleado'
    form.dataset.esRenovacion = esRenovacion;

    modalContrato.show();
}

async function confirmarContrato() {
    const form = document.getElementById('formContrato');
    const id = form.dataset.id;
    const interesActual = parseFloat(document.getElementById('barraInteresContrato').style.width) || 0;

    const payload = {
        sueldo: document.getElementById('ofertaSueldo').value,
        anios: document.getElementById('ofertaAnios').value,
        rol: document.getElementById('ofertaRol').value,
        prima: document.getElementById('ofertaPrima').value,
        clausula: document.getElementById('ofertaClausula').value,
        tipo: form.dataset.tipo,
        esRenovacion: form.dataset.esRenovacion,
        interesJugador: interesActual 
    };
    try {
        const res = await fetch(`/objetivo/confirmarContrato/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.redirect) {
            window.location.href = data.redirect;
        } else {
            location.reload();
        }
    } catch (err) {
        console.error(err);
    }
}

async function finalizarNegociacion(negId) {
    try {
        const response = await fetch(`/negociaciones/finalizar/${negId}`, {
            method: 'GET',
        });
        location.reload();
    } catch (err) {
        console.error(err);
    }
}

async function aceptarOfertaRecibida(negId) {    
    try {
        const response = await fetch(`/negociaciones/aceptar-recibida/${negId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            location.reload();
        } else {
            alert("Error: " + data.mensaje);
        }
    } catch (err) {
        console.error(err);
    }
}

async function borrarNegociacion(negId) {
    try {
        const response = await fetch(`/negociaciones/borrar/${negId}`, {
            method: 'GET',
        });
        location.reload();
    } catch (err) {
        console.error(err);
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