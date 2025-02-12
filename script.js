let numerosSalidos = [];
let numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
let intervalo;
let enEjecucion = false;

function startStop() {
    if (enEjecucion) {
        clearInterval(intervalo);
        document.getElementById('startStopBtn').textContent = 'Comenzar';
        enEjecucion = false;
    } else {
        setTimeout(() => {
            intervalo = setInterval(siguienteNumero, 3000);
            document.getElementById('startStopBtn').textContent = 'Detener';
            enEjecucion = true;
        }, 1000);
    }
}

function siguienteNumero() {
    if (numerosDisponibles.length === 0) {
        alert("¡Todos los números han sido llamados!");
        clearInterval(intervalo);
        document.getElementById('startStopBtn').textContent = 'Comenzar';
        enEjecucion = false;
        return;
    }

    const indice = Math.floor(Math.random() * numerosDisponibles.length);
    const numero = numerosDisponibles.splice(indice, 1)[0];
    numerosSalidos.push(numero);

    document.getElementById('numero').textContent = numero;
    anunciarNumero(numero);
}

function anunciarNumero(numero) {
    if (window.speechSynthesis) {
        const mensaje = new SpeechSynthesisUtterance(numero.toString());
        mensaje.lang = 'es-ES';
        window.speechSynthesis.speak(mensaje);
    }
}

function reiniciarJuego() {
    numerosSalidos = [];
    numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
    document.getElementById('numero').textContent = '--';
    clearInterval(intervalo);
    document.getElementById('startStopBtn').textContent = 'Comenzar';
    enEjecucion = false;
}