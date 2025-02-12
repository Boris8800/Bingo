// Configuración inicial
let numerosSalidos = [];
let numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
let intervalo;
let enEjecucion = false;
let juegoPausado = false;

// Elementos DOM
const elementos = {
    numero: document.getElementById('numero'),
    startStopBtn: document.getElementById('startStopBtn'),
    estadoJuego: document.getElementById('estadoJuego'),
    listaGanadores: document.getElementById('listaGanadores')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    generarNumeros();
    setupEventListeners();
});

// Generar números en el tablero
function generarNumeros() {
    const contenedor = document.getElementById('numerosContainer');
    for (let i = 1; i <= 90; i++) {
        const div = document.createElement('div');
        div.className = 'numeroCirculo';
        div.id = `numero${i}`;
        div.textContent = i;
        contenedor.appendChild(div);
    }
}

// Event listeners
function setupEventListeners() {
    document.getElementById('reiniciarBtn').addEventListener('click', reiniciarJuego);
    document.getElementById('startStopBtn').addEventListener('click', startStop);
    document.getElementById('btnVerificarNumero').addEventListener('click', verificarNumero);
    document.getElementById('btnVerificarCarton').addEventListener('click', verificarCarton);
    
    // Eventos para pausar/reanudar
    ['numeroVerificar', 'cartonVerificar'].forEach(id => {
        document.getElementById(id).addEventListener('focus', pausarJuego);
        document.getElementById(id).addEventListener('blur', reanudarJuego);
    });
}

// Funcionalidad principal del juego
function startStop() {
    if (enEjecucion) {
        detenerJuego();
    } else {
        iniciarJuego();
    }
}

function iniciarJuego() {
    if (window.speechSynthesis) {
        const mensaje = new SpeechSynthesisUtterance("Empezamos");
        mensaje.lang = 'es-ES';
        window.speechSynthesis.speak(mensaje);
    }
    
    setTimeout(() => {
        intervalo = setInterval(siguienteNumero, 3000);
        elementos.startStopBtn.textContent = 'Detener';
        enEjecucion = true;
        actualizarEstado("enMarcha");
    }, 1000);
}

function detenerJuego() {
    clearInterval(intervalo);
    elementos.startStopBtn.textContent = 'Comenzar';
    enEjecucion = false;
    actualizarEstado("pausado");
}

function siguienteNumero() {
    if (numerosDisponibles.length === 0) {
        alert("¡Todos los números han sido llamados!");
        detenerJuego();
        return;
    }

    const indice = Math.floor(Math.random() * numerosDisponibles.length);
    const numero = numerosDisponibles.splice(indice, 1)[0];
    
    numerosSalidos.push(numero);
    actualizarInterfaz(numero);
    verificarCarton44();
}

// Funcionalidad de verificación automática
function verificarCarton44() {
    const carton = document.getElementById('carton44');
    const numerosCarton = carton.dataset.numeros.split(',').map(Number);
    
    if (numerosCarton.every(num => numerosSalidos.includes(num))) {
        mostrarGanador(44, numerosCarton);
        detenerJuego();
    }
}

// Funcionalidad de ganadores
function mostrarGanador(numeroCarton, numeros) {
    if (document.getElementById(`ganador-${numeroCarton}`)) return;

    const div = document.createElement('div');
    div.className = 'ganador-item';
    div.id = `ganador-${numeroCarton}`;
    div.innerHTML = `
        <h3>Cartón ${numeroCarton}</h3>
        <div class="numeros-ganadores">
            ${numeros.map(n => `<span class="numero-ganador">${n}</span>`).join(' ')}
        </div>
    `;
    
    elementos.listaGanadores.prepend(div);
    
    if (window.speechSynthesis) {
        const mensaje = new SpeechSynthesisUtterance(`¡Bingo! Cartón ${numeroCarton} ganador`);
        mensaje.lang = 'es-ES';
        window.speechSynthesis.speak(mensaje);
    }
}

// Resto de funciones
function actualizarInterfaz(numero) {
    elementos.numero.textContent = numero;
    marcarNumero(numero);
    actualizarUltimosNumeros();
    anunciarNumero(numero);
}

function actualizarEstado(estado) {
    elementos.estadoJuego.textContent = estado === "enMarcha" ? "Juego en marcha" : "Juego pausado";
    elementos.estadoJuego.className = estado;
}
