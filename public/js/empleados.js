function verAtributos(id) {
    fetch(`/empleado/atributos/${id}`)
        .then(res => res.json())
        .then(data => {
            const body = document.getElementById('modalBodyAtributos');
            body.innerHTML = Object.entries(data.atributos)
                .map(([key, val]) => `
                    <div class="d-flex justify-content-between border-bottom py-1">
                        <span class="fw-bold">${key.replace(/([A-Z])/g, ' $1')}</span>
                        <span>${val}</span>
                    </div>
                `).join('');
            new bootstrap.Modal(document.getElementById('modalAtributos')).show();
        });
}

function confirmarDespido(id) {
    if(confirm('¿Seguro que quieres despedir a este empleado?')) {
        fetch(`/empleados/despedir/${id}`, { method: 'POST' })
            .then(() => location.reload());
    }
}