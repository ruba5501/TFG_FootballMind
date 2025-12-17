let ligaActualIdx = 0;
let clubActualIdx = 0;
let clubesFiltrados = [];

$(document).ready(function() {
    if ($('.liga-item').length > 0) {
        mostrarLiga(0);
    }
});

function mostrarLiga(index) {
    $('.liga-item').addClass('d-none');
    $(`#liga-${index}`).removeClass('d-none');
    ligaActualIdx = index;
}

function moveCarousel(tipo, dir) {
    if (tipo === 'liga') {
        const total = $('.liga-item').length;
        ligaActualIdx = (ligaActualIdx + dir + total) % total;
        mostrarLiga(ligaActualIdx);
        
        // RESET: Si cambias de liga, se oculta el club anterior y se borra el input
        $('#seccion-clubes').addClass('d-none');
        $('#ligaInput').val(''); // Forzamos a que tengan que hacer click en la foto
        $('#clubInput').val('');
    } else {
        const total = clubesFiltrados.length;
        if (total === 0) return;
        clubActualIdx = (clubActualIdx + dir + total) % total;
        mostrarClub(clubActualIdx);
    }
}

// ESTA FUNCIÓN ES LA QUE ACTIVA EL SIGUIENTE PASO
function confirmarLiga(index) {
    const item = $(`#liga-${index}`);
    // Obtenemos el ID de la liga seleccionada
    const idLigaSeleccionada = String(item.data('id')).trim(); 
    
    console.log("Buscando equipos para la liga:", idLigaSeleccionada);

    $('#ligaInput').val(idLigaSeleccionada);
    $('.liga-item img').removeClass('selected-item');
    item.find('img').addClass('selected-item');

    $('.club-item').addClass('d-none'); 

    // FILTRADO
    clubesFiltrados = $('.club-item').filter(function() {
        // Obtenemos el ID del club. Como ahora solo pusimos el ID en el HTML, esto será un string
        const idLigaDelClub = String($(this).attr('data-liga-id')).trim();
        
        // Si por error sigue viniendo el objeto como texto "{...}", extraemos solo el ID
        if (idLigaDelClub.includes('new ObjectId')) {
            // Este es un caso de emergencia por si MongoDB sigue enviando el formato largo
            return idLigaDelClub.includes(idLigaSeleccionada);
        }

        return idLigaDelClub === idLigaSeleccionada;
    });

    console.log("Equipos encontrados:", clubesFiltrados.length);

    if (clubesFiltrados.length > 0) {
        $('#seccion-clubes').removeClass('d-none').fadeIn();
        clubActualIdx = 0;
        mostrarClub(0);
    }
}

function mostrarClub(index) {
    $('.club-item').addClass('d-none');
    $(clubesFiltrados[index]).removeClass('d-none');
}

function confirmarClub(el, id) {
    $('#clubInput').val(id);
    $('.club-item img').removeClass('selected-item');
    $(el).addClass('selected-item');
}