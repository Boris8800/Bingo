// Variable global para almacenar cartones con bingo
let cartonesConBingo = [];

// Función para verificar todos los cartones automáticamente
function verificarTodosLosCartones() {
    cartonesConBingo = []; // Reiniciamos la lista
    
    // Obtenemos todos los elementos de cartones
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

// Función para actualizar la visualización
function actualizarListaBingos() {
    const lista = document.getElementById('listaCartonesBingo');
    lista.innerHTML = '';
    
    if (cartonesConBingo.length === 0) {
        lista.textContent = "Ningún cartón tiene bingo todavía";
        return;
    }
    
    // Creamos elementos para cada cartón con bingo
    cartonesConBingo.forEach(numero => {
        const elemento = document.createElement('div');
        elemento.className = 'carton-bingo';
        elemento.textContent = `${numero}`;
        lista.appendChild(elemento);
    });
}

// Función para reiniciar el juego (modificada)
function reiniciarJuego() {
    // Limpiar lista de cartones con bingo
    cartonesConBingo = [];
    actualizarListaBingos();
    
    numerosSalidos = [];
    numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
    document.getElementById('numero').textContent = '--';
    const circulos = document.querySelectorAll('.numeroCirculo');
    circulos.forEach(circulo => {
        circulo.classList.remove('marcado');
    });
    clearInterval(intervalo);
    document.getElementById('startStopBtn').textContent = 'Comenzar';
    enEjecucion = false;
    juegoPausado = false;
    actualizarUltimosNumeros();
    limpiarMensajeVerificacion();
    actualizarEstadoJuego("pausado");
}

// Función verificarCarton (modificada para ordenar números por orden de salida)
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
    
    // Ordenar los números que han salido según el orden en que fueron llamados
    const numerosSalidosCarton = numerosCarton.filter(num => numerosSalidos.includes(num));
    numerosSalidosCarton.sort((a, b) => numerosSalidos.indexOf(a) - numerosSalidos.indexOf(b));

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

// Función siguienteNumero (asegurando que verifica los cartones)
function siguienteNumero() {
    if (numerosDisponibles.length === 0) {
        alert("¡Todos los números han sido llamados!");
        clearInterval(intervalo);
        document.getElementById('startStopBtn').textContent = 'Comenzar';
        enEjecucion = false;
        actualizarEstadoJuego("pausado");
        return;
    }

    const indice = Math.floor(Math.random() * numerosDisponibles.length);
    const numero = numerosDisponibles.splice(indice, 1)[0];
    numerosSalidos.push(numero);

    document.getElementById('numero').textContent = numero;
    marcarNumero(numero);

    actualizarUltimosNumeros();
    anunciarNumero(numero);
    
    // Verificar todos los cartones después de cada número
    verificarTodosLosCartones();
}
