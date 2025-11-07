document.addEventListener('DOMContentLoaded', () => {
  const steps = document.querySelectorAll('.step');
  let currentStep = 0;

  const next1 = document.getElementById('next1');
  const next2 = document.getElementById('next2');
  const back2 = document.getElementById('back2');
  const back3 = document.getElementById('back3');

  // Control de pasos
  function showStep(i) {
    steps.forEach((s, idx) => s.classList.toggle('d-none', idx !== i));
    currentStep = i;
  }

  next1.addEventListener('click', () => {
    const inputs = steps[0].querySelectorAll('input[required]');
    let valid = true;
    inputs.forEach(inp => {
      if (!inp.value.trim()) {
        inp.classList.add('is-invalid');
        valid = false;
      } else {
        inp.classList.remove('is-invalid');
      }
    });
    if (valid) showStep(1);
  });

  next2.addEventListener('click', () => {
    const liga = document.getElementById('ligaSelect').value;
    const club = document.getElementById('club').value;
    if (!liga || !club) return alert('Debes seleccionar una liga y un club');
    showStep(2);
  });

  back2.addEventListener('click', () => showStep(0));
  back3.addEventListener('click', () => showStep(1));

  // 👉 Filtrar clubes por liga seleccionada
  const ligaSelect = document.getElementById('ligaSelect');
  const clubSelect = document.getElementById('club');

  ligaSelect.addEventListener('change', () => {
    const ligaSeleccionada = ligaSelect.value;

    Array.from(clubSelect.options).forEach(option => {
      if (!option.value) return; // dejar opción "Selecciona un club"
      const ligaClub = option.getAttribute('data-liga');
      option.style.display = ligaSeleccionada === ligaClub ? 'block' : 'none';
    });

    // Resetear selección de club al cambiar de liga
    clubSelect.value = '';
  });

  // Sistema de puntos
  const atributos = document.querySelectorAll('.atributo');
  const puntosRestantes = document.getElementById('puntosRestantes');
  const TOTAL_PUNTOS = 450;

  function sumaAtributos() {
    return Array.from(atributos).reduce((acc, inp) => acc + (parseInt(inp.value, 10) || 0), 0);
  }

  atributos.forEach(input => {
    input.dataset.prev = input.value || '0';
    input.addEventListener('input', () => {
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) val = 0;

      input.value = val;
      const suma = sumaAtributos();

      if (suma > TOTAL_PUNTOS) {
        const exceso = suma - TOTAL_PUNTOS;
        let nuevoVal = val - exceso;
        if (nuevoVal < 0) nuevoVal = 0;
        input.value = nuevoVal;
      }

      input.dataset.prev = input.value;
      const restantes = TOTAL_PUNTOS - sumaAtributos();
      puntosRestantes.textContent = `Puntos restantes: ${restantes}`;

      puntosRestantes.classList.toggle('text-danger', restantes < 0);
    });
  });
});
