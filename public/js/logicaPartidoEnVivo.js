// public/js/partidoEnVivo.js

// Leemos las variables globales que inyectamos desde el HTML/EJS
const PARTIDO_ID = window.PARTIDO_ID;
const sesionEnVivo = window.sesionEnVivo;

let intervaloPartido = null;
let simulando = false;
let velocidadActual = 1; 
const velocidadesMs = { 1: 2000, 2: 1000, 3: 400 };
let pausaFaseInterna = null;

$(document).ready(function() {
    // 1. Sincronizar el DOM con el estado real de la sesión al cargar/recargar
    if (sesionEnVivo && sesionEnVivo.partidoId === PARTIDO_ID) {
        const minuto = sesionEnVivo.minutoActual || 0;
        const golesL = sesionEnVivo.estadoMarcador?.golesLocal || 0;
        const golesV = sesionEnVivo.estadoMarcador?.golesVisitante || 0;

        // Actualizar marcador visual inicial
        document.getElementById('badgeMinuto').innerText = minuto + "'";
        document.getElementById('golesLocal').innerText = golesL;
        document.getElementById('golesVisitante').innerText = golesV;

        // Reconstruir la consola de eventos históricos de la sesión
        const caja = document.getElementById('cajaEventos');
        if (sesionEnVivo.estadoMarcador?.eventos && sesionEnVivo.estadoMarcador.eventos.length > 0) {
            caja.innerHTML = ""; // Limpiar el de por defecto
            sesionEnVivo.estadoMarcador.eventos.forEach(ev => {
                let estilo = 'text-white-50'; 
                if (ev.tipo === 'GOL') estilo = 'text-success fw-bold fs-6';
                else if (ev.tipo === 'INFO') estilo = 'text-warning font-italic';
                else if (ev.tipo === 'OCASION') estilo = 'text-info';
                
                caja.innerHTML += `<div class="mb-1 ${estilo}">[Min. ${ev.minuto}] ${ev.texto}</div>`;
            });
            caja.scrollTop = caja.scrollHeight;
        }

        // Si el partido ya estaba completado, lo dejamos bloqueado en "Finalizado" directamente
        if (sesionEnVivo.completado) {
            finalizarPartidoPorCompleto();
            return; // Evitamos asociar eventos de reanudación
        }
    }

    // --- MANEJADORES DE EVENTOS ---
    $('#btnAbrirEstrategia').on('click', function() {
        if (simulando) pausarSimulacion();
        window.location.href = `/partido/${PARTIDO_ID}/tactica`;
    });

    $('#btnPlayPause').on('click', function() {
        if (simulando) pausarSimulacion();
        else arrancarSimulacion();
    });

    $('#btnVelocidad').on('click', function() {
        if (velocidadActual === 1) velocidadActual = 2;
        else if (velocidadActual === 2) velocidadActual = 3;
        else velocidadActual = 1;
        
        $('#textoVelocidad').text('x' + velocidadActual);
        if (simulando) {
            clearInterval(intervaloPartido);
            intervaloPartido = null;
            arrancarSimulacion();
        }
    });
});

function arrancarSimulacion() {
    if (intervaloPartido) return;
    
    simulando = true;
    $('#estadoPartido').text("EN VIVO").removeClass('text-muted').addClass('text-danger');
    $('#btnPlayPause').removeClass('btn-success').addClass('btn-warning');
    $('#iconoPlay').removeClass('bi-play-fill').addClass('bi-pause-fill');
    
    if (pausaFaseInterna === 'TANDA_PENALTIS') {
        $('#textoPlay').text('LANZAR PENALTI');
    } else {
        $('#textoPlay').text('PAUSAR');
    }

    const ms = velocidadesMs[velocidadActual];

    intervaloPartido = setInterval(() => {
        fetch(`/partido-en-vivo/${PARTIDO_ID}/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                pausarSimulacion();
                alert("Error durante la simulación: " + (data.message || 'Desconocido'));
                return;
            }

            const caja = document.getElementById('cajaEventos');

            // --- ESCENARIO A: TANDA DE PENALTIS ---
            if (data.esPenaltis) {
                pausarSimulacion();
                pausaFaseInterna = 'TANDA_PENALTIS';
                $('#textoPlay').text('LANZAR SIGUIENTE');
                $('#contenedorPenaltis').slideDown();

                document.getElementById('penaltisGolesLocal').innerText = data.tanda.golesLocal;
                document.getElementById('penaltisGolesVisitante').innerText = data.tanda.golesVisitante;

                let circulosLocal = data.tanda.disparosLocal.slice(-5).map(r => 
                    r === 'GOL' ? '<i class="bi bi-circle-fill text-success fs-5"></i>' : '<i class="bi bi-x-circle-fill text-danger fs-5"></i>'
                ).join(' ');
                document.getElementById('circulosLocal').innerHTML = circulosLocal;

                let circulosVisitante = data.tanda.disparosVisitante.slice(-5).map(r => 
                    r === 'GOL' ? '<i class="bi bi-circle-fill text-success fs-5"></i>' : '<i class="bi bi-x-circle-fill text-danger fs-5"></i>'
                ).join(' ');
                document.getElementById('circulosVisitante').innerHTML = circulosVisitante;

                if (data.evento) {
                    caja.innerHTML += `<div class="mb-1 text-info fw-bold">[PENALTIS] ${data.evento.texto}</div>`;
                    caja.scrollTop = caja.scrollHeight;
                }

                if (data.terminado) finalizarPartidoPorCompleto();
                return;
            }

            // --- ESCENARIO B: TICK REGULAR DE MINUTOS ---
            document.getElementById('badgeMinuto').innerText = data.minuto + "'";
            document.getElementById('golesLocal').innerText = data.golesLocal;
            document.getElementById('golesVisitante').innerText = data.golesVisitante;
            
            if (data.posesionLocal !== undefined) {
                document.getElementById('contenedorPosesion').style.display = 'block';
                document.getElementById('barraPosesionLocal').style.width = data.posesionLocal + "%";
                document.getElementById('textoPosesionLocal').innerText = data.posesionLocal + "%";
                document.getElementById('textoPosesionVisitante').innerText = (100 - data.posesionLocal) + "%";
            }

            // --- ACTUALIZACIÓN EN VIVO DE JUGADORES (CANSANCIO Y NOTAS) ---
            if (data.jugadoresLocal && data.jugadoresLocal.length > 0) {
                data.jugadoresLocal.forEach(j => {
                    let fila = $(`#listaTitularesLocal [data-id="${j._id}"]`);
                    if(fila.length) {
                        fila.find('.jugador-forma').text(Math.round(j.estado?.forma ?? 100) + '%');
                        fila.find('.jugador-nota').text((j.estado?.notaPartido ?? 6.0).toFixed(1));
                    }
                });
            }
            if (data.jugadoresVisitante && data.jugadoresVisitante.length > 0) {
                data.jugadoresVisitante.forEach(j => {
                    let fila = $(`#listaTitularesVisitante [data-id="${j._id}"]`);
                    if(fila.length) {
                        fila.find('.jugador-forma').text(Math.round(j.estado?.forma ?? 100) + '%');
                        fila.find('.jugador-nota').text((j.estado?.notaPartido ?? 6.0).toFixed(1));
                    }
                });
            }

            if (data.evento) {
                let estilo = 'text-white-50'; 
                if (data.evento.tipo === 'GOL') estilo = 'text-success fw-bold fs-6';
                else if (data.evento.tipo === 'INFO') estilo = 'text-warning font-italic';
                else if (data.evento.tipo === 'OCASION') estilo = 'text-info';
                
                caja.innerHTML += `<div class="mb-1 ${estilo}">[Min. ${data.minuto}] ${data.evento.texto}</div>`;
                caja.scrollTop = caja.scrollHeight;
            }

            // --- PROCESAR PAUSAS PROGRAMADAS ---
            if (data.pausaEstado) {
                pausarSimulacion();
                pausaFaseInterna = data.pausaEstado;

                if (data.pausaEstado === 'DESCANSO') {
                    caja.innerHTML += `<div class="text-warning fw-bold my-2">[INFO] Fin de la primera parte. ¡Descanso!</div>`;
                    $('#textoPlay').text('INICIAR 2ª PARTE');
                } else if (data.pausaEstado === 'FIN_REGULAR_ESPERA_PRORROGA') {
                    caja.innerHTML += `<div class="text-warning fw-bold my-2">[INFO] ¡Empate! Vamos a la prórroga.</div>`;
                    $('#textoPlay').text('INICIAR PRÓRROGA');
                } else if (data.pausaEstado === 'DESCANSO_PRORROGA') {
                    caja.innerHTML += `<div class="text-warning fw-bold my-2">[INFO] Descanso de la prórroga.</div>`;
                    $('#textoPlay').text('REANUDAR PRÓRROGA');
                } else if (data.pausaEstado === 'TANDA_PENALTIS') {
                    caja.innerHTML += `<div class="text-danger fw-bold my-2">[INFO] ¡A los penaltis!</div>`;
                    $('#textoPlay').text('LLEVAR A PENALTIS');
                }
                caja.scrollTop = caja.scrollHeight;
            }

            if (data.terminado) finalizarPartidoPorCompleto();
        })
        .catch(err => {
            console.error("Error en el tick:", err);
            pausarSimulacion();
        });
    }, ms);
}

function pausarSimulacion() {
    if (intervaloPartido) {
        clearInterval(intervaloPartido);
        intervaloPartido = null;
    }
    simulando = false;
    $('#estadoPartido').text("PAUSADO").removeClass('text-danger').addClass('text-muted');
    $('#btnPlayPause').removeClass('btn-warning').addClass('btn-success');
    $('#iconoPlay').removeClass('bi-pause-fill').addClass('bi-play-fill');
    
    if (pausaFaseInterna === 'DESCANSO') $('#textoPlay').text('INICIAR 2ª PARTE');
    else if (pausaFaseInterna === 'FIN_REGULAR_ESPERA_PRORROGA') $('#textoPlay').text('INICIAR PRÓRROGA');
    else if (pausaFaseInterna === 'DESCANSO_PRORROGA') $('#textoPlay').text('REANUDAR PRÓRROGA');
    else if (pausaFaseInterna === 'TANDA_PENALTIS') $('#textoPlay').text('LANZAR PENALTI');
    else $('#textoPlay').text('REANUDAR');
}

function finalizarPartidoPorCompleto() {
    if (intervaloPartido) {
        clearInterval(intervaloPartido);
        intervaloPartido = null;
    }
    simulando = false;
    document.getElementById('estadoPartido').innerText = "FINALIZADO";
    document.getElementById('estadoPartido').className = "text-muted mt-1 fw-bold style-estado-txt";
    
    // Al finalizar bloqueamos controles
    $('#btnPlayPause').prop('disabled', true).removeClass('btn-warning btn-success').addClass('btn-secondary');
    $('#textoPlay').text('FINALIZADO');
    $('#iconoPlay').removeClass('bi-pause-fill bi-play-fill').addClass('bi-check-all');
    $('#btnVelocidad').prop('disabled', true);
    $('#btnAbrirEstrategia').prop('disabled', true); 
    document.getElementById('btnContinuar').style.display = 'block';
}