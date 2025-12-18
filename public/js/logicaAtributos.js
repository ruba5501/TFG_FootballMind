document.addEventListener("DOMContentLoaded", () => {
    const TOTAL_DISPONIBLE = 450;
    const sliders = document.querySelectorAll(".atributo-slider");
    const inputs = document.querySelectorAll(".atributo-input");
    const restanteLabel = document.getElementById("puntosRestantes");
    const btnFinalizar = document.getElementById("btnFinalizar");

    function actualizarPuntos() {
        let suma = 0;
        inputs.forEach(i => suma += parseInt(i.value || 0));
        
        const saldo = TOTAL_DISPONIBLE - suma;
        restanteLabel.textContent = saldo;

        if (saldo < 0) {
            restanteLabel.classList.replace("bg-dark", "bg-danger");
            btnFinalizar.disabled = true;
        } else {
            restanteLabel.classList.replace("bg-danger", "bg-dark");
            btnFinalizar.disabled = false;
        }
    }

    sliders.forEach((slider, index) => {
        const inputCorrespondiente = inputs[index];
        const labelValor = slider.closest('.p-3').querySelector('.value-indicator');

        slider.addEventListener("input", () => {
            inputCorrespondiente.value = slider.value;
            labelValor.textContent = slider.value;
            actualizarPuntos();
        });

        inputCorrespondiente.addEventListener("input", () => {
            if(inputCorrespondiente.value > 100) inputCorrespondiente.value = 100;
            slider.value = inputCorrespondiente.value;
            labelValor.textContent = inputCorrespondiente.value;
            actualizarPuntos();
        });
    });

    actualizarPuntos();
});