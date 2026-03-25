$(document).ready(function() {
    const $selectLiga = $('#liga');
    const $inputClubText = $('#club'); 
    const $hiddenClubId = $('#club-id-hidden'); 
    const $datalist = $('#lista-clubes');

    let todosLosClubes = [];
    $('#lista-clubes option').each(function() {
        todosLosClubes.push({
            nombre: $(this).val(),
            id: $(this).attr('data-id'),
            competiciones: $(this).attr('data-competiciones')
        });
    });

    $selectLiga.on('change', function() {
        const ligaSeleccionada = $(this).val().trim();
        
        $inputClubText.val('');
        $hiddenClubId.val('');
        
        $datalist.empty();
        const filtrados = todosLosClubes.filter(c => {
            if (!ligaSeleccionada || ligaSeleccionada === "") return true;
            return c.competiciones.includes(ligaSeleccionada);
        });
        filtrados.forEach(c => {
            $datalist.append(`<option value="${c.nombre}" data-id="${c.id}" data-competicones='${JSON.stringify(c.competiciones)}'>`);
        });
    });

    $inputClubText.on('input', function() {
        console.log("g");
        const valor = $(this).val();
        
        const encontrado = todosLosClubes.find(c => c.nombre === valor);

        if (encontrado) {
            $hiddenClubId.val(encontrado.id);
            console.log("Club ID detectado:", encontrado.id);
        } else {
            $hiddenClubId.val(''); 
        }
    });
});