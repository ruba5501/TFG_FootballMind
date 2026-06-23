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
        const fase = opt ? opt.dataset.fase : '';

        let urlBase;
        if (vistaForzada) {
            urlBase = vistaForzada === 'liga' ? '/clasificacion' : '/copa';
        } else {
            urlBase = (fase === 'eliminatorias') ? '/copa' : '/clasificacion';
        }

        contenedor.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-primary"></div><p class="text-white-50 mt-2">Cargando datos...</p></div>';

        try {
            const res = await fetch(`${urlBase}/${partidaId}/${id}?ajax=true`);
            if (!res.ok) throw new Error('Error en la respuesta');
            const htmlCompleto = await res.text();
            
            // 🛑 SOLUCIÓN AL NAVBAR REPETIDO: Filtrar el HTML recibido
            const parser = new DOMParser();
            const docFiltrado = parser.parseFromString(htmlCompleto, 'text/html');
            
            // Intentamos buscar la estructura interna de pestañas o el contenedor limpio de resultados
            const contenidoLimpio = docFiltrado.querySelector('.container.mt-4.mb-5') || docFiltrado.getElementById('contenedorResultados') || docFiltrado.body;
            
            // Quitamos el botón de "Volver al Centro de Mando" si viene repetido dentro del buscador del mundo para que sea más estético
            const btnVolverRepetido = contenidoLimpio.querySelector('a[href^="/inicioJuego"]');
            if (btnVolverRepetido) btnVolverRepetido.remove();

            contenedor.innerHTML = contenidoLimpio.innerHTML;
        } catch (err) {
            console.error(err);
            contenedor.innerHTML = '<div class="alert alert-danger">No se pudo cargar la información.</div>';
        }
    };

    btnMostrar.addEventListener('click', () => {
        window.cargarInfo();
    });

    // 🛑 SOLUCIÓN AL PRIMER CLIC EN RESULTADOS FILTRADOS POR AJAX:
    // Al usar delegación de eventos en el contenedor, capturamos los clics de las pestañas inyectadas dinámicamente
    contenedor.addEventListener('click', function (event) {
        const btn = event.target.closest('#tabsCompeticion button');
        if (!btn) return;

        event.preventDefault();

        const targetId = btn.getAttribute('data-bs-target');
        const targetPane = contenedor.querySelector(targetId);

        if (targetPane) {
            // Ocultar pestaña activa actual dentro del contenedor inyectado
            const activePane = contenedor.querySelector('.tab-content .tab-pane.show.active');
            if (activePane) activePane.classList.remove('show', 'active');

            // Mostrar la seleccionada
            targetPane.classList.add('show', 'active');
        }

        // Alternar clases visuales de los botones
        const todosLosBotones = contenedor.querySelectorAll('#tabsCompeticion button');
        todosLosBotones.forEach(b => {
            b.classList.remove('btn-info', 'text-dark');
            b.classList.add('btn-outline-secondary', 'border-0', 'text-white');
        });

        btn.classList.remove('btn-outline-secondary', 'border-0', 'text-white');
        btn.classList.add('btn-info', 'text-dark');
    });
});