window.cambiarJornada = (delta) => {
    const contenedorJornadas = document.querySelector('#contenedorJornadas');
    if (!contenedorJornadas) return;

    const jornadas = contenedorJornadas.querySelectorAll('.jornada-index');    
    const actual = contenedorJornadas.querySelector('.jornada-index:not(.d-none)');
    
    if (!jornadas.length || !actual) return;

    const todasLasJornadas = Array.from(jornadas).map(w => w.dataset.jornada);
    const indexActual = todasLasJornadas.indexOf(actual.dataset.jornada);
    let nuevoIndex = indexActual + delta;

    if (nuevoIndex >= 0 && nuevoIndex < todasLasJornadas.length) {
        actual.classList.add('d-none');
        jornadas[nuevoIndex].classList.remove('d-none');
        
        const indicador = document.getElementById('numJornada');
        if (indicador) {
            indicador.innerText = jornadas[nuevoIndex].dataset.jornada;
        }
    }
};