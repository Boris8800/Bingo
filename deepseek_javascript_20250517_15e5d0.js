// Variables globales
let numerosSalidos = [];
let numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
let intervalo;
let enEjecucion = false;
let juegoPausado = false;
let cartonesConBingo = [];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Generar los círculos de números
    const numerosContainer = document.getElementById('numerosContainer');
    for (let i = 1; i <= 90; i++) {
        const circulo = document.createElement('div');
        circulo.classList.add('numeroCirculo');
        circulo.textContent = i;
        circulo.id = `numero${i}`;
        numerosContainer.appendChild(circulo);
    }

    // Event listeners
    document.getElementById('startStopBtn').addEventListener('click', startStop);
    document.getElementById('reiniciarBtn').addEventListener('click', reiniciarJuego);
    document.getElementById('verificarNumBtn').addEventListener('click', verificarNumero);
    document.getElementById('verificarCartonBtn').addEventListener('click', verificarCarton);
    
    // Eventos para pausar/reanudar con inputs
    document.getElementById('numeroVerificar').addEventListener('focus', pausarJuego);
    document.getElementById('cartonVerificar').addEventListener('focus', pausarJuego);
    document.getElementById('numeroVerificar').addEventListener('blur', reanudarJuego);
    document.getElementById('cartonVerificar').addEventListener('blur', reanudarJuego);
    
    // Limpiar mensajes al hacer clic en cualquier parte
    document.addEventListener('click', limpiarMensajes);
});

// Funciones del juego
function startStop() {
    if (enEjecucion) {
        detenerJuego();
    } else {
        comenzarJuego();
    }
}

function comenzarJuego() {
    // Reproducir la palabra "Empezamos"
    if (window.speechSynthesis) {
        const mensaje = new SpeechSynthesisUtterance("Empezamos");
        mensaje.lang = 'es-ES';
        window.speechSynthesis.speak(mensaje);
    }

    // Iniciar el juego después de un breve retraso
    setTimeout(() => {
        intervalo = setInterval(siguienteNumero, 3000);
        document.getElementById('startStopBtn').textContent = 'Detener';
        enEjecucion = true;
        actualizarEstadoJuego("enMarcha");
        limpiarMensajeVerificacion();
    }, 100);
}

function detenerJuego() {
    clearInterval(intervalo);
    document.getElementById('startStopBtn').textContent = 'Comenzar';
    enEjecucion = false;
    actualizarEstadoJuego("pausado");
}

function pausarJuego() {
    if (enEjecucion) {
        clearInterval(intervalo);
        juegoPausado = true;
        document.getElementById('startStopBtn').textContent = 'Comenzar';
        enEjecucion = false;
        actualizarEstadoJuego("pausado");
    }
}

function reanudarJuego() {
    if (juegoPausado) {
        intervalo = setInterval(siguienteNumero, 3000);
        enEjecucion = true;
        juegoPausado = false;
        document.getElementById('startStopBtn').textContent = 'Detener';
        actualizarEstadoJuego("enMarcha");
    }
    limpiarMensajes();
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

    document.getElementById('numero').textContent = numero;
    marcarNumero(numero);

    actualizarUltimosNumeros();
    anunciarNumero(numero);
    verificarTodosLosCartones();
}

function marcarNumero(numero) {
    const circulo = document.getElementById(`numero${numero}`);
    if (circulo) {
        circulo.classList.add('marcado');
    }
}

function reiniciarJuego() {
    cartonesConBingo = [];
    actualizarListaBingos();
    
    numerosSalidos = [];
    numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
    document.getElementById('numero').textContent = '--';
    
    const circulos = document.querySelectorAll('.numeroCirculo');
    circulos.forEach(circulo => {
        circulo.classList.remove('marcado');
    });
    
    detenerJuego();
    juegoPausado = false;
    actualizarUltimosNumeros();
    limpiarMensajeVerificacion();
}

function actualizarUltimosNumeros() {
    const ultimos10 = numerosSalidos.slice(-10);
    const ultimosNumerosContainer = document.getElementById('ultimosNumerosContainer');
    ultimosNumerosContainer.innerHTML = '';

    ultimos10.forEach(numero => {
        const circulo = document.createElement('div');
        circulo.classList.add('numeroCirculo', 'ultimoNumeroCirculo');
        circulo.textContent = numero;
        ultimosNumerosContainer.appendChild(circulo);
    });
}

function anunciarNumero(numero) {
    if (window.speechSynthesis) {
        const mensaje = new SpeechSynthesisUtterance(numero.toString());
        mensaje.lang = 'es-ES';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(mensaje);
    }
}

// Funciones de verificación
function verificarNumero() {
    const numero = parseInt(document.getElementById('numeroVerificar').value);
    const mensajeVerificacion = document.getElementById('mensajeVerificacion');

    if (isNaN(numero) || numero < 1 || numero > 90) {
        mensajeVerificacion.innerHTML = "Por favor, ingresa un número válido (1-90).";
        mensajeVerificacion.style.color = "red";
        document.getElementById('numeroVerificar').value = "";
        document.getElementById('numeroVerificar').focus();
        return;
    }

    if (numerosSalidos.includes(numero)) {
        mensajeVerificacion.innerHTML = `✅ El número <span class="numeroVerificado">${numero}</span> ha salido.`;
        mensajeVerificacion.style.color = "green";
        marcarNumero(numero);
    } else {
        mensajeVerificacion.innerHTML = `❌ El número <span class="numeroFaltante">${numero}</span> no ha salido.`;
        mensajeVerificacion.style.color = "red";
    }

    document.getElementById('numeroVerificar').value = "";
    document.getElementById('numeroVerificar').focus();
}

function verificarCarton() {
    const numeroCarton = parseInt(document.getElementById('cartonVerificar').value);
    const carton = document.getElementById(`carton${numeroCarton}`);
    const mensajeVerificacionCarton = document.getElementById('mensajeVerificacionCarton');

    if (!carton) {
        mensajeVerificacionCarton.innerHTML = "❌ Cartón no encontrado.";
        mensajeVerificacionCarton.style.color = "red";
        document.getElementById('cartonVerificar').value = "";
        document.getElementById('cartonVerificar').focus();
        return;
    }

    const numerosCarton = carton.getAttribute('data-numeros').split(',').map(Number);
    const numerosFaltantes = numerosCarton.filter(num => !numerosSalidos.includes(num));
    const numerosSalidosCarton = numerosCarton.filter(num => numerosSalidos.includes(num));

    if (numerosFaltantes.length === 0) {
        mensajeVerificacionCarton.innerHTML = `✅ ¡Bingo! Todos los números del cartón ${numeroCarton} han salido: ` + 
            numerosSalidosCarton.map(num => `<span class="numeroVerificado">${num}</span>`).join(' ');
        mensajeVerificacionCarton.style.color = "green";

        if (window.speechSynthesis) {
            const mensaje = new SpeechSynthesisUtterance(`Bingo. El cartón número ${numeroCarton} tiene bingo`);
            mensaje.lang = 'es-ES';
            window.speechSynthesis.speak(mensaje);
        }
    } else {
        mensajeVerificacionCarton.innerHTML = ` En el cartón ${numeroCarton}:<br>
            ❌Faltan: ` + numerosFaltantes.map(num => `<span class="numeroFaltante">${num}</span>`).join(' ') + `<br>
            ✅Salieron: ` + numerosSalidosCarton.map(num => `<span class="numeroVerificado">${num}</span>`).join(' ');
        mensajeVerificacionCarton.style.color = "red";
    }

    document.getElementById('cartonVerificar').value = "";
    document.getElementById('cartonVerificar').focus();
}

// Funciones para cartones con bingo
function verificarTodosLosCartones() {
    cartonesConBingo = [];
    const elementosCartones = document.querySelectorAll('#cartonesContainer > div[id^="carton"]');
    
    elementosCartones.forEach(carton => {
        const numeroCarton = parseInt(carton.id.replace('carton', ''));
        const numerosCarton = carton.getAttribute('data-numeros').split(',').map(Number);
        const faltantes = numerosCarton.filter(num => !numerosSalidos.includes(num));
        
        if (faltantes.length === 0) {
            cartonesConBingo.push(numeroCarton);
        }
    });
    
    actualizarListaBingos();
}

function actualizarListaBingos() {
    const lista = document.getElementById('listaCartonesBingo');
    lista.innerHTML = '';
    
    if (cartonesConBingo.length === 0) {
        lista.textContent = "Ningún cartón tiene bingo todavía";
        return;
    }
    
    cartonesConBingo.sort((a, b) => a - b);
    
    cartonesConBingo.forEach(numero => {
        const elemento = document.createElement('div');
        elemento.className = 'cartonBingo';
        elemento.textContent = `Cartón ${numero}`;
        lista.appendChild(elemento);
    });
}

// Funciones auxiliares
function actualizarEstadoJuego(estado) {
    const estadoJuego = document.getElementById('estadoJuego');
    estadoJuego.style.display = 'block';
    estadoJuego.textContent = estado === "enMarcha" ? "✅Juego en marcha✅" : "❌Juego pausado❌";
    estadoJuego.className = estado === "enMarcha" ? "enMarcha" : "pausado";
}

function limpiarMensajeVerificacion() {
    const mensajeVerificacion = document.getElementById('mensajeVerificacion');
    mensajeVerificacion.innerHTML = '';
    mensajeVerificacion.style.color = '';
}

function limpiarMensajes(event) {
    if (!event.target.closest('#verificarNumeroContainer')) {
        limpiarMensajeVerificacion();
    }
    
    if (!event.target.closest('#verificarCartonContainer')) {
        document.getElementById('mensajeVerificacionCarton').textContent = "";
    }
}