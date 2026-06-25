const UI = {
    // Reemplazo estético de confirm()
    confirmar: function(titulo, mensaje, textoBoton, callback) {
        const modalId = 'modal-confirmacion-dinamico';
        let modalEl = document.getElementById(modalId);
        if (modalEl) modalEl.remove();

        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content bg-dark text-white border-secondary">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title">${titulo}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>${mensaje}</p>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" id="btn-confirmar-accion" class="btn ${textoBoton.toLowerCase().includes('despedir') || textoBoton.toLowerCase().includes('libertad') ? 'btn-danger' : 'btn-success'}">${textoBoton}</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const bsModal = new bootstrap.Modal(document.getElementById(modalId));
        bsModal.show();

        document.getElementById('btn-confirmar-accion').addEventListener('click', () => {
            bsModal.hide();
            callback(); // Aquí se ejecuta lo que le pases
        });
    },

    // Reemplazo estético de alert() de éxito
    notificarExito: function(mensaje, callbackRedirect) {
        const modalId = 'modal-exito-dinamico';
        let modalEl = document.getElementById(modalId);
        if (modalEl) modalEl.remove();

        const modalHTML = `
            <div class="modal fade" id="${modalId}" data-bs-backdrop="static" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-sm modal-dialog-centered">
                    <div class="modal-content bg-dark text-center text-white border-success p-3">
                        <div class="text-success fs-1 mb-2"><i class="bi bi-check-circle-fill"></i></div>
                        <h5 class="fw-bold text-success">¡Éxito!</h5>
                        <p class="small mb-3">${mensaje}</p>
                        <button type="button" id="btn-exito-ok" class="btn btn-success btn-sm w-100">Aceptar</button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const bsModal = new bootstrap.Modal(document.getElementById(modalId));
        bsModal.show();

        document.getElementById('btn-exito-ok').addEventListener('click', () => {
            bsModal.hide();
            if (callbackRedirect) callbackRedirect();
        });
    }
};