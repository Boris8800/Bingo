// ---- Variables Globales del Juego ----
let numerosSalidos = [];
let numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1); // Se reinicia en reiniciarJuego
let intervalo;
let enEjecucion = false;
let juegoPausado = false; // Tu variable original
let cartonesConBingo = []; // Tu variable original para la lista de bingos

// ---- Variables y Funciones para Selección de Voz ----
let voices = [];
let selectedVoice = null;

function populateVoiceList() {
    if (typeof speechSynthesis === 'undefined') {
        console.warn("API de Voz no soportada por este navegador.");
        const voiceSelectContainer = document.getElementById('voiceSettingsContainer');
        if (voiceSelectContainer) voiceSelectContainer.style.display = 'none';
        return;
    }

    voices = speechSynthesis.getVoices();
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) {
        console.error("Elemento 'voiceSelect' no encontrado en el DOM.");
        return;
    }
    
    const previouslySelectedURI = selectedVoice ? selectedVoice.voiceURI : (voiceSelect.value || '');
    voiceSelect.innerHTML = ''; // Limpiar opciones existentes

    const defaultOption = document.createElement('option');
    defaultOption.textContent = 'Voz por defecto del navegador';
    defaultOption.value = ''; // Valor para identificar la opción por defecto
    voiceSelect.appendChild(defaultOption);

    voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`; // Corregido para mostrar nombre y lang
        option.setAttribute('data-voice-uri', voice.voiceURI); 
        option.value = voice.voiceURI; // Usar voiceURI como valor para fácil recuperación
        voiceSelect.appendChild(option);
    });
    
    // Intentar re-seleccionar la voz si ya había una
    if (previouslySelectedURI && voiceSelect.options.length > 1) { // Más de una opción (default + voces)
        const optionToSelect = Array.from(voiceSelect.options).find(opt => opt.value === previouslySelectedURI);
        if (optionToSelect) {
            optionToSelect.selected = true;
        } else { // Si la voz anterior no se encuentra
             voiceSelect.options[0].selected = true; // fallback a la primera (por defecto)
             selectedVoice = null; 
        }
    } else if (voiceSelect.options.length > 0) {
         voiceSelect.options[0].selected = true; // seleccionar por defecto si no hay selección previa
         selectedVoice = null; // Asegurar que selectedVoice sea null si se selecciona la opción por defecto
    }
}

function setVoice() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect || voiceSelect.selectedOptions.length === 0 || !voiceSelect.value) { // Si value es '', es la opción "por defecto"
        selectedVoice = null; 
        return;
    }
    const selectedVoiceURI = voiceSelect.value;
    selectedVoice = voices.find(voice => voice.voiceURI === selectedVoiceURI);
    if (!selectedVoice) { 
        selectedVoice = null; 
    }
    // console.log("Voz seleccionada:", selectedVoice ? selectedVoice.name : "Por defecto");
}
// ---- FIN FUNCIONES DE VOZ ----

// Función para iniciar/detener el juego (tu lógica original)
function startStop() {
    const startStopBtn = document.getElementById('startStopBtn');
    if (!startStopBtn) return;

    if (enEjecucion) {
        clearInterval(intervalo);
        startStopBtn.textContent = 'Comenzar';
        enEjecucion = false;
        actualizarEstadoJuego("pausado");
    } else {
        if (numerosDisponibles.length === 0) { 
            alert("¡Todos los números han sido llamados! Reinicia el juego.");
            actualizarEstadoJuego("finalizado"); // Usar "finalizado" si todos los números salieron
            return;
        }
        if (window.speechSynthesis) {
            const mensaje = new SpeechSynthesisUtterance("Empezamos");
            if (selectedVoice) {
                mensaje.voice = selectedVoice;
                mensaje.lang = selectedVoice.lang;
            } else {
                mensaje.lang = 'es-ES';
            }
            window.speechSynthesis.speak(mensaje);
        }
        
        enEjecucion = true; 
        startStopBtn.textContent = 'Detener';
        actualizarEstadoJuego("enMarcha");
        limpiarMensajeVerificacion(); 

        setTimeout(() => {
            if (enEjecucion) { 
                intervalo = setInterval(siguienteNumero, 3000);
            }
        }, 100); 
    }
}

// Función para generar el siguiente número (tu lógica original con Math.random)
function siguienteNumero() {
    if (numerosDisponibles.length === 0) {
        alert("¡Todos los números han sido llamados!");
        clearInterval(intervalo);
        const startStopBtn = document.getElementById('startStopBtn');
        if(startStopBtn) startStopBtn.textContent = 'Comenzar';
        enEjecucion = false;
        actualizarEstadoJuego("finalizado"); // Estado finalizado
        // verificarTodosLosCartones(); // Ya se llama abajo
        return;
    }

    const indice = Math.floor(Math.random() * numerosDisponibles.length);
    const numero = numerosDisponibles.splice(indice, 1)[0];
    numerosSalidos.push(numero);

    const numeroDisplay = document.getElementById('numero');
    if(numeroDisplay) numeroDisplay.textContent = numero;
    
    marcarNumero(numero);
    actualizarUltimosNumeros();
    anunciarNumero(numero);
    verificarTodosLosCartones(); 
}

// Función para anunciar el número (modificada para usar selectedVoice)
function anunciarNumero(numero) {
    if (window.speechSynthesis) {
        const mensaje = new SpeechSynthesisUtterance(numero.toString());
        if (selectedVoice) {
            mensaje.voice = selectedVoice;
            mensaje.lang = selectedVoice.lang; 
        } else {
            mensaje.lang = 'es-ES'; 
        }
        window.speechSynthesis.cancel(); 
        window.speechSynthesis.speak(mensaje);
    }
}

// Función para marcar un número como salido (tu lógica original)
function marcarNumero(numero) {
    const circulo = document.getElementById(`numero${numero}`);
    if (circulo) {
        circulo.classList.add('marcado');
    }
}

// Función para reiniciar el juego (tu lógica original, pero actualiza estado a "listo")
function reiniciarJuego() {
    numerosSalidos = [];
    numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
    cartonesConBingo = []; // Reiniciar la lista de bingos aquí

    const numeroDisplay = document.getElementById('numero');
    if(numeroDisplay) numeroDisplay.textContent = '--';
    
    const circulos = document.querySelectorAll('#numerosContainer .numeroCirculo'); // Más específico
    circulos.forEach(circulo => {
        circulo.classList.remove('marcado');
    });
    
    if(intervalo) clearInterval(intervalo);
    const startStopBtn = document.getElementById('startStopBtn');
    if(startStopBtn) startStopBtn.textContent = 'Comenzar';
    
    enEjecucion = false;
    juegoPausado = false; 
    
    actualizarUltimosNumeros();
    limpiarMensajeVerificacion();
    const msgCarton = document.getElementById('mensajeVerificacionCarton');
    if(msgCarton) msgCarton.textContent = "";

    actualizarListaBingos(); 
    actualizarEstadoJuego("listo"); // CAMBIADO: Estado inicial "listo" en lugar de "pausado"
}

// Función para actualizar los últimos 10 números (tu lógica original)
function actualizarUltimosNumeros() {
    const ultimosNumerosContainer = document.getElementById('ultimosNumerosContainer');
    if (!ultimosNumerosContainer) return;

    const ultimos10 = numerosSalidos.slice(-10);
    ultimosNumerosContainer.innerHTML = '';

    ultimos10.forEach(numero => {
        const circulo = document.createElement('div');
        circulo.classList.add('numeroCirculo', 'ultimoNumeroCirculo');
        circulo.textContent = numero;
        ultimosNumerosContainer.appendChild(circulo);
    });
}

// Función para verificar un número (tu lógica original)
function verificarNumero() {
    const numeroVerificar = document.getElementById('numeroVerificar');
    const mensajeVerificacion = document.getElementById('mensajeVerificacion');
    if(!numeroVerificar || !mensajeVerificacion) return;

    const numero = parseInt(numeroVerificar.value);

    if (isNaN(numero) || numero < 1 || numero > 90) {
        mensajeVerificacion.innerHTML = "Por favor, ingresa un número válido (1-90).";
        mensajeVerificacion.style.color = "red";
    } else if (numerosSalidos.includes(numero)) {
        mensajeVerificacion.innerHTML = `✅ El número <span class="numeroVerificado">${numero}</span> ha salido.`;
        mensajeVerificacion.style.color = "green";
        marcarNumero(numero);
    } else {
        mensajeVerificacion.innerHTML = `❌ El número <span class="numeroFaltante">${numero}</span> no ha salido.`;
        mensajeVerificacion.style.color = "red";
    }
    numeroVerificar.value = "";
    numeroVerificar.focus();
}

// Función para verificar un cartón (tu lógica original, modificada para usar selectedVoice)
function verificarCarton() {
    const cartonVerificar = document.getElementById('cartonVerificar');
    const mensajeVerificacionCarton = document.getElementById('mensajeVerificacionCarton');
    if(!cartonVerificar || !mensajeVerificacionCarton) return;

    const numeroCarton = parseInt(cartonVerificar.value);
    // Asegurar que el ID buscado sea exacto, ej. "carton23"
    const cartonElement = document.getElementById(`carton${numeroCarton}`); 

    if (isNaN(numeroCarton)) {
         mensajeVerificacionCarton.innerHTML = "Ingresa un número de cartón válido.";
         mensajeVerificacionCarton.style.color = "red";
    } else if (!cartonElement) {
        mensajeVerificacionCarton.innerHTML = `❌ Cartón ${numeroCarton} no encontrado.`;
        mensajeVerificacionCarton.style.color = "red";
    } else {
        const numerosEnCartonAttr = cartonElement.getAttribute('data-numeros');
        if (!numerosEnCartonAttr || numerosEnCartonAttr.trim() === "") { 
            mensajeVerificacionCarton.innerHTML = `❌ Cartón ${numeroCarton} no tiene números definidos.`;
            mensajeVerificacionCarton.style.color = "red";
        } else {
            const numerosEnCarton = numerosEnCartonAttr.split(',').map(Number).filter(n => n > 0 && !isNaN(n));
            const numerosFaltantes = numerosEnCarton.filter(num => !numerosSalidos.includes(num));
            const numerosSalidosEnCarton = numerosEnCarton.filter(num => numerosSalidos.includes(num));

            if (numerosEnCarton.length > 0 && numerosFaltantes.length === 0) {
                mensajeVerificacionCarton.innerHTML = `✅ ¡Bingo! Todos los números del cartón ${numeroCarton} han salido: ` + 
                    numerosSalidosEnCarton.map(num => `<span class="numeroVerificado">${num}</span>`).join(' ');
                mensajeVerificacionCarton.style.color = "green";

                if (window.speechSynthesis) {
                    const mensaje = new SpeechSynthesisUtterance(`Bingo. El cartón número ${numeroCarton} tiene bingo`);
                    if (selectedVoice) {
                        mensaje.voice = selectedVoice;
                        mensaje.lang = selectedVoice.lang;
                    } else {
                        mensaje.lang = 'es-ES';
                    }
                    window.speechSynthesis.speak(mensaje);
                }
            } else if (numerosEnCarton.length === 0) {
                mensajeVerificacionCarton.innerHTML = `ℹ️ El cartón ${numeroCarton} no tiene números válidos.`;
                 mensajeVerificacionCarton.style.color = "orange";
            } else {
                mensajeVerificacionCarton.innerHTML = `❌ En el cartón ${numeroCarton}:<br>
                    Faltan: ` + numerosFaltantes.map(num => `<span class="numeroFaltante">${num}</span>`).join(' ') + `<br>
                    Salieron: ` + numerosSalidosEnCarton.map(num => `<span class="numeroVerificado">${num}</span>`).join(' ');
                mensajeVerificacionCarton.style.color = "red";
            }
        }
    }
    if(cartonVerificar) {
        cartonVerificar.value = "";
        cartonVerificar.focus();
    }
}

// Eventos focus/blur (tu lógica original)
const numeroVerificarInputEl = document.getElementById('numeroVerificar');
const cartonVerificarInputEl = document.getElementById('cartonVerificar');
const startStopBtnEl = document.getElementById('startStopBtn'); 

if (cartonVerificarInputEl) {
    cartonVerificarInputEl.addEventListener('blur', () => {
        if (juegoPausado && startStopBtnEl) {
            intervalo = setInterval(siguienteNumero, 3000);
            enEjecucion = true;
            juegoPausado = false;
            startStopBtnEl.textContent = 'Detener';
            actualizarEstadoJuego("enMarcha");
        }
        const msgCarton = document.getElementById('mensajeVerificacionCarton');
        if(msgCarton) msgCarton.textContent = "";
    });
    cartonVerificarInputEl.addEventListener('focus', () => {
        if (enEjecucion && startStopBtnEl) {
            clearInterval(intervalo);
            juegoPausado = true;
            startStopBtnEl.textContent = 'Comenzar';
            enEjecucion = false;
            actualizarEstadoJuego("pausado"); // Tu estado original aquí
        }
    });
}

if (numeroVerificarInputEl) {
    numeroVerificarInputEl.addEventListener('focus', () => {
        if (enEjecucion && startStopBtnEl) {
            clearInterval(intervalo);
            juegoPausado = true;
            startStopBtnEl.textContent = 'Comenzar';
            enEjecucion = false;
            actualizarEstadoJuego("pausado"); // Tu estado original aquí
        }
    });
    numeroVerificarInputEl.addEventListener('blur', function() {
        limpiarMensajeVerificacion();
        if (juegoPausado && startStopBtnEl) {
            intervalo = setInterval(siguienteNumero, 3000);
            enEjecucion = true;
            juegoPausado = false;
            startStopBtnEl.textContent = 'Detener';
            actualizarEstadoJuego("enMarcha");
        }
    });
}

document.addEventListener('click', function(event) {
    const msgVerificacion = document.getElementById('mensajeVerificacion');
    const msgCarton = document.getElementById('mensajeVerificacionCarton');

    if (msgVerificacion && !event.target.closest('#verificarNumeroContainer')) {
        limpiarMensajeVerificacion();
    }
    if (msgCarton && !event.target.closest('#verificarCartonContainer')) {
        msgCarton.textContent = "";
    }
});

// Función para actualizar el estado del juego (tu lógica original, con nuevos estados opcionales)
function actualizarEstadoJuego(estado) {
    const estadoJuego = document.getElementById('estadoJuego');
    if (!estadoJuego) return;
    estadoJuego.style.display = 'block';
    switch (estado) {
        case "enMarcha": estadoJuego.textContent = "✅Juego en marcha✅"; estadoJuego.className = "enMarcha"; break;
        case "pausado": estadoJuego.textContent = "❌Juego pausado❌"; estadoJuego.className = "pausado"; break;
        case "listo": estadoJuego.textContent = "ℹ️ Juego listo. ¡Presiona Comenzar! ℹ️"; estadoJuego.className = "listo"; break;
        case "finalizado": estadoJuego.textContent = "🏁 ¡Juego finalizado! 🏁"; estadoJuego.className = "finalizado"; break;
        case "pausadoInput": estadoJuego.textContent = "⌨️ Pausa (input activo) ⌨️"; estadoJuego.className = "pausadoInput"; break;
        default: estadoJuego.textContent = estado; estadoJuego.className = estado; // Fallback
    }
}

// Función para limpiar el mensaje de verificación (tu lógica original)
function limpiarMensajeVerificacion() {
    const mensajeVerificacion = document.getElementById('mensajeVerificacion');
    if (mensajeVerificacion) {
        mensajeVerificacion.innerHTML = '';
        mensajeVerificacion.style.color = '';
    }
}

// Función para verificar todos los cartones automáticamente (corregida)
function verificarTodosLosCartones() {
    // NO reiniciar cartonesConBingo = []; aquí. Solo en reiniciarJuego().
    const elementosCartones = document.querySelectorAll('#cartonesContainer > div[id^="carton"]');
    elementosCartones.forEach(carton => {
        const idCompleto = carton.id;
        // Extraer número de ID "cartonX" de forma más segura
        const match = idCompleto.match(/^carton(\d+)$/); // Busca IDs que son exactamente "carton" seguido de números
        if (!match || !match[1]) {
            // console.warn(`ID de cartón con formato no esperado: ${idCompleto}`);
            return; // Saltar si el ID no es "carton" seguido de un número
        }
        const numeroCarton = parseInt(match[1]);

        if (cartonesConBingo.includes(numeroCarton)) { // Si ya está en la lista, no hacer nada
            return;
        }
        
        const numerosEnCartonAttr = carton.getAttribute('data-numeros');
        // Verificar que data-numeros exista y no esté vacío
        if (numerosEnCartonAttr && numerosEnCartonAttr.trim() !== "") {
            const numerosEnCarton = numerosEnCartonAttr.split(',').map(Number).filter(n => n > 0 && !isNaN(n));
            // Considerar que un cartón válido debe tener un número específico de números, ej. 15
            if (numerosEnCarton.length > 0) { // O un chequeo más estricto: numerosEnCarton.length === 15
                const faltantes = numerosEnCarton.filter(num => !numerosSalidos.includes(num));
                if (faltantes.length === 0) {
                    if (!cartonesConBingo.includes(numeroCarton)) { // Doble chequeo por si acaso
                        cartonesConBingo.push(numeroCarton);
                    }
                }
            }
        }
    });
    actualizarListaBingos();
}

// Función para actualizar la visualización de bingos (tu lógica original)
function actualizarListaBingos() {
    const lista = document.getElementById('listaCartonesBingo');
    if(!lista) return;
    lista.innerHTML = '';
    
    if (cartonesConBingo.length === 0) {
        lista.textContent = "Ningún cartón tiene bingo todavía";
        return;
    }
    
    cartonesConBingo.sort((a,b) => a - b); // Ordenar numéricamente los IDs de cartón
    cartonesConBingo.forEach(numero => {
        const elemento = document.createElement('div');
        elemento.className = 'carton-bingo'; // Usa la clase de tu CSS original
        elemento.textContent = `${numero}`;
        lista.appendChild(elemento);
    });
}

// --- INICIALIZACIÓN DEL JUEGO ---
window.onload = () => {
    // Generar los círculos de números del historial (código original del usuario)
    const numerosContainer = document.getElementById('numerosContainer');
    if (numerosContainer) {
        for (let i = 1; i <= 90; i++) {
            const circulo = document.createElement('div');
            circulo.classList.add('numeroCirculo');
            circulo.textContent = i;
            circulo.id = `numero${i}`;
            numerosContainer.appendChild(circulo);
        }
    } else {
        console.error("Elemento 'numerosContainer' no encontrado.");
    }

    // Configuración de la Selección de Voz
    if (typeof speechSynthesis !== 'undefined') {
        // Es importante llamar a getVoices() una vez antes, y luego de nuevo en onvoiceschanged
        // porque en algunos navegadores la lista no está disponible inmediatamente.
        speechSynthesis.getVoices(); 
        populateVoiceList(); 
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList; 
        }
        const voiceSelectElement = document.getElementById('voiceSelect');
        if (voiceSelectElement) {
            voiceSelectElement.addEventListener('change', setVoice);
        } else {
            console.error("Elemento 'voiceSelect' no encontrado para el listener.");
        }
    } else {
        const voiceSettingsContainer = document.getElementById('voiceSettingsContainer');
        if (voiceSettingsContainer) voiceSettingsContainer.style.display = 'none';
    }
    
    reiniciarJuego(); // Llama a tu función original de reinicio, que ahora termina con estado "listo".
};