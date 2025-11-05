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
    const club = document.getElementById('clubSelect').value;
    if (!liga || !club) return alert('Debes seleccionar una liga y un club');
    showStep(2);
  });

  back2.addEventListener('click', () => showStep(0));
  back3.addEventListener('click', () => showStep(1));

  // Filtrar clubes por liga
  document.getElementById('ligaSelect').addEventListener('change', function() {
    const ligaId = this.value;
    const options = document.querySelectorAll('#clubSelect option');
    options.forEach(opt => {
      opt.hidden = opt.getAttribute('data-liga') !== ligaId && opt.value !== "";
    });
    document.getElementById('clubSelect').value = "";
  });

  // Sistema de puntos
  const atributos = document.querySelectorAll('.atributo');
  const puntosRestantes = document.getElementById('puntosRestantes');
  let total = 200;

  atributos.forEach(input => {
    input.addEventListener('input', () => {
      const suma = Array.from(atributos).reduce((acc, inp) => acc + Number(inp.value || 0), 0);
      const restantes = 200 - suma;
      puntosRestantes.textContent = `Puntos restantes: ${restantes}`;
      if (restantes < 0) puntosRestantes.classList.add('text-danger');
      else puntosRestantes.classList.remove('text-danger');
    });
  });
});
