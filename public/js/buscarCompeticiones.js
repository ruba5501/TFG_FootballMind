document.addEventListener('DOMContentLoaded', () => {
    const selectPais = document.getElementById('selectPais');
    const selectCompeticion = document.getElementById('selectCompeticion');
    const btnMostrar = document.getElementById('btnMostrar');
    const contenedor = document.getElementById('contenedorResultados');

    const competiciones = JSON.parse(document.getElementById('competiciones-data').textContent);
    const partidaId = document.getElementById('partida-id').value;

    selectPais.addEventListener('change', () => {
        const paisSel = selectPais.value;
        selectCompeticion.innerHTML = '<option value="">-- Seleccionar Competición --</option>';
        
        if (paisSel) {
            const filtradas = competiciones.filter(c => {
                if (paisSel === 'Internacional') return c.tipo.includes('internacional');
                return c.pais === paisSel;
            });

            filtradas.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c._id;
                opt.dataset.tipo = c.tipo; 
                opt.textContent = c.nombre;
                opt.dataset.fase = c.faseActual;
                selectCompeticion.appendChild(opt);
            });

            selectCompeticion.disabled = false;
        } else {
            selectCompeticion.disabled = true;
            btnMostrar.disabled = true;
        }
    });

    selectCompeticion.addEventListener('change', () => {
        btnMostrar.disabled = !selectCompeticion.value;
    });

    window.cargarInfo = async (compId = null, vistaForzada = null) => {
        const id = compId || selectCompeticion.value;
        if (!id) return;

        const opt = Array.from(selectCompeticion.options).find(o => o.value === id);
        const tipo = opt ? opt.dataset.tipo : '';
        const fase = opt ? opt.dataset.fase : '';

        let urlBase;
        if (vistaForzada) {
            urlBase = vistaForzada === 'liga' ? '/clasificacion' : '/copa';
        } else {
            urlBase = (fase === 'eliminatorias') ? '/copa' : '/clasificacion';
        }

        contenedor.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-primary"></div><p>Cargando datos...</p></div>';

        try {
            const res = await fetch(`${urlBase}/${partidaId}/${id}?ajax=true`);
            if (!res.ok) throw new Error('Error en la respuesta');
            const html = await res.text();
            contenedor.innerHTML = html;
        } catch (err) {
            console.error(err);
            contenedor.innerHTML = '<div class="alert alert-danger">No se pudo cargar la información.</div>';
        }
    };

    btnMostrar.addEventListener('click', () => {
        window.cargarInfo();
    });
});