const { execSync } = require('child_process');
const path = require('path')

async function cargarTodo() {
  try {
    console.log('1️ Cargando competiciones...');
    execSync(`node ${path.join(__dirname, 'cargarCompeticiones.js')}`, { stdio: 'inherit' });

    console.log('2️ Cargando clubes...');
    execSync(`node ${path.join(__dirname, 'cargarClubes.js')}`, { stdio: 'inherit' });

    console.log('Carga completa y sincronizada.');
  } catch (err) {
    console.error('Error en la carga total:', err);
  }
}

cargarTodo();
