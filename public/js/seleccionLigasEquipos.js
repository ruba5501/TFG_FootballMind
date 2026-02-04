let ligaActualIdx = 0;
let clubActualIdx = 0;

$(document).ready(function() {
    if ($('.liga-item').length > 0) {
        actualizarVistaLiga(0);
    }
});

function actualizarVistaLiga(index) {
    const ligas = $('.liga-item');
    ligas.addClass('d-none');
    
    const ligaActiva = $(ligas[index]);
    ligaActiva.removeClass('d-none');
    
    const nombreLiga = ligaActiva.attr('data-nombre');
    ligaActualIdx = index;

    filtrarClubesPorLiga(nombreLiga);
}

function filtrarClubesPorLiga(nombreLiga) {
    const todosLosClubes = $('.club-item');
    todosLosClubes.addClass('d-none');
    
    const filtrados = todosLosClubes.filter(`[data-liga-nombre="${nombreLiga}"]`);
    
    if (filtrados.length > 0) {
        clubActualIdx = 0; 
        $(filtrados[0]).removeClass('d-none');
    }
}

function confirmarLiga(index, nombreLiga) {
    $('.liga-item img').removeClass('selected-item');
    $(`#liga-${index} img`).addClass('selected-item');

    $('#ligaInput').val(nombreLiga);

    $('#seccion-clubes').hide().removeClass('d-none').fadeIn();
}

function moveCarousel(tipo, direccion) {
    if (tipo === 'liga') {
        const totalLigas = $('.liga-item').length;
        ligaActualIdx = (ligaActualIdx + direccion + totalLigas) % totalLigas;
        actualizarVistaLiga(ligaActualIdx);
        
        $('#ligaInput').val('');
        $('.liga-item img').removeClass('selected-item');
        $('#seccion-clubes').addClass('d-none');
        $('#clubInput').val(''); 
    } else {
        const ligaSeleccionada = $('.liga-item').eq(ligaActualIdx).attr('data-nombre');
        const elementos = $(`.club-item[data-liga-nombre="${ligaSeleccionada}"]`);
        
        if (elementos.length === 0) return;

        elementos.addClass('d-none');
        clubActualIdx = (clubActualIdx + direccion + elementos.length) % elementos.length;
        $(elementos[clubActualIdx]).removeClass('d-none');
    }
}

function confirmarClub(el, nombreClub) {
    $('#clubInput').val(nombreClub); 
    $('.club-item img').removeClass('selected-item'); // Tu clase CSS
    $(el).addClass('selected-item');
}