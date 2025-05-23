// ---- Variables Globales del Juego ----
let numerosSalidos = [];
let numerosDisponibles = []; // Se inicializa en reiniciarJuego
let intervalo;
let enEjecucion = false;
let juegoPausado = false; 
let cartonesConBingo = []; 

// ---- Variables para Selección de Voz ----
let voices = [];
let selectedVoice = null;

// ---- Variables para Nuevas Funcionalidades ----
let myTrackedCardNumbers = []; 
const bingoAudio = new Audio('bingo-sound.mp3'); // !!! CAMBIA 'bingo-sound.mp3' !!!
                                                // por la ruta a tu archivo de sonido.
bingoAudio.preload = 'auto';

// ---- Funciones para Selección de Voz ----
function populateVoiceList() {
    if (typeof speechSynthesis === 'undefined') {
        console.warn("API de Voz no soportada.");
        const voiceSelectContainer = document.getElementById('voiceSettingsContainer');
        if (voiceSelectContainer) voiceSelectContainer.style.display = 'none';
        return;
    }
    
    voices = speechSynthesis.getVoices();
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) {
        // console.error("Elemento 'voiceSelect' no encontrado."); 
        return;
    }
    
    const previouslySelectedURI = selectedVoice ? selectedVoice.voiceURI : (voiceSelect.value || '');
    voiceSelect.innerHTML = ''; 

    const defaultOption = document.createElement('option');
    defaultOption.textContent = 'Voz por defecto del navegador';
    defaultOption.value = ''; 
    voiceSelect.appendChild(defaultOption);

    voices.forEach((voice) => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.value = voice.voiceURI; 
        voiceSelect.appendChild(option);
    });
    
    if (previouslySelectedURI) {
        const optionToSelect = Array.from(voiceSelect.options).find(opt => opt.value === previouslySelectedURI);
        if (optionToSelect) {
            optionToSelect.selected = true;
        } else if (voiceSelect.options.length > 0) {
             voiceSelect.options[0].selected = true; 
             selectedVoice = null; 
        }
    } else if (voiceSelect.options.length > 0) {
         voiceSelect.options[0].selected = true;
         selectedVoice = null;
    }
}

function setVoice() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect || !voiceSelect.value) { 
        selectedVoice = null; 
        return;
    }
    selectedVoice = voices.find(voice => voice.voiceURI === voiceSelect.value);
    if (!selectedVoice) selectedVoice = null;
}
// ---- FIN FUNCIONES DE VOZ ----

// ---- NUEVAS FUNCIONES PARA SEGUIR "MIS CARTONES" ----
function trackMyCards() {
    const inputEl = document.getElementById('myCardNumbersInput');
    if (!inputEl) {
        console.error("Elemento 'myCardNumbersInput' no encontrado.");
        return; // Salir si el input no existe
    }
    const inputText = inputEl.value;
    myTrackedCardNumbers = inputText.split(',')
        .map(numStr => parseInt(numStr.trim()))
        .filter(num => !isNaN(num) && num > 0);
    
    actualizarMisCartonesBingoDisplay(); 
    inputEl.value = myTrackedCardNumbers.join(', '); 
}

function actualizarMisCartonesBingoDisplay() {
    const myTrackedListDiv = document.getElementById('myTrackedBingosList');
    if (!myTrackedListDiv) return;
    myTrackedListDiv.innerHTML = '';

    const misBingosEnJuego = cartonesConBingo.filter(cartonId => myTrackedCardNumbers.includes(cartonId));

    if (misBingosEnJuego.length === 0) {
        myTrackedListDiv.textContent = "---";
        return;
    }
    
    misBingosEnJuego.sort((a,b) => a - b); 

    misBingosEnJuego.forEach(cartonId => {
        const elemento = document.createElement('span'); 
        elemento.className = 'carton-bingo mis-cartones-bingo-item'; 
        elemento.textContent = `${cartonId}`; 
        myTrackedListDiv.appendChild(elemento);
        myTrackedListDiv.appendChild(document.createTextNode(' ')); 
    });
}
// ---- FIN FUNCIONES "MIS CARTONES" ----

// ---- FUNCIONES PRINCIPALES DEL JUEGO ----
function reiniciarJuego() { 
    numerosSalidos = [];
    numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
    cartonesConBingo = []; 

    const numeroDisplay = document.getElementById('numero');
    if(numeroDisplay) numeroDisplay.textContent = '--';
    
    const circulos = document.querySelectorAll('#numerosContainer .numeroCirculo');
    circulos.forEach(circulo => circulo.classList.remove('marcado'));
    
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
    actualizarMisCartonesBingoDisplay(); 
    actualizarEstadoJuego("listo"); 
}

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
            actualizarEstadoJuego("finalizado");
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

function siguienteNumero() {
    if (numerosDisponibles.length === 0) {
        alert("¡Todos los números han sido llamados!");
        clearInterval(intervalo);
        const startStopBtn = document.getElementById('startStopBtn');
        if(startStopBtn) startStopBtn.textContent = 'Comenzar';
        enEjecucion = false;
        actualizarEstadoJuego("finalizado"); 
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

function marcarNumero(numero) {
    const circulo = document.getElementById(`numero${numero}`);
    if (circulo) circulo.classList.add('marcado');
}

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
    if(numeroVerificar) numeroVerificar.value = "";
    if(numeroVerificar) numeroVerificar.focus();
}

function verificarCarton() {
    const cartonVerificar = document.getElementById('cartonVerificar');
    const mensajeVerificacionCarton = document.getElementById('mensajeVerificacionCarton');
    if (!cartonVerificar || !mensajeVerificacionCarton) return;
    
    const numeroCartonInput = cartonVerificar.value;
    const numeroCarton = parseInt(numeroCartonInput.replace(/[^0-9]/g, ''));

    if (isNaN(numeroCarton)) {
         mensajeVerificacionCarton.innerHTML = "Ingresa un número de cartón válido.";
         mensajeVerificacionCarton.style.color = "red";
    } else {
        const cartonElement = document.getElementById(`carton${numeroCarton}`); 
        if (!cartonElement || !cartonElement.getAttribute('data-numeros')) {
            mensajeVerificacionCarton.innerHTML = `❌ Cartón ${numeroCarton} no encontrado o inválido.`;
            mensajeVerificacionCarton.style.color = "red";
        } else {
            const numerosEnCartonAttr = cartonElement.getAttribute('data-numeros');
            if (!numerosEnCartonAttr || numerosEnCartonAttr.trim() === "") { 
                mensajeVerificacionCarton.innerHTML = `❌ Cartón ${numeroCarton} no tiene números definidos.`;
                mensajeVerificacionCarton.style.color = "red";
            } else {
                const numerosEnCarton = numerosEnCartonAttr.split(',').map(Number).filter(n => n > 0 && !isNaN(n));
                const faltantes = numerosEnCarton.filter(num => !numerosSalidos.includes(num));
                const numerosSalidosEnCarton = numerosEnCarton.filter(num => numerosSalidos.includes(num));

                if (numerosEnCarton.length > 0 && faltantes.length === 0) {
                    mensajeVerificacionCarton.innerHTML = `✅ ¡Bingo! Cartón ${numeroCarton} completo: ` + 
                        numerosSalidosEnCarton.map(num => `<span class="numeroVerificado">${num}</span>`).join(' ');
                    mensajeVerificacionCarton.style.color = "green";
                    if (window.speechSynthesis) {
                        const msg = new SpeechSynthesisUtterance(`Bingo. El cartón número ${numeroCarton} tiene bingo`);
                        if (selectedVoice) {
                            msg.voice = selectedVoice;
                            msg.lang = selectedVoice.lang;
                        } else {
                            msg.lang = 'es-ES';
                        }
                        window.speechSynthesis.speak(msg);
                    }
                    if (!cartonesConBingo.includes(numeroCarton)) { 
                        try { bingoAudio.currentTime = 0; bingoAudio.play().catch(e => console.warn("Error al reproducir sonido (verif. manual):", e)); } 
                        catch (e) { console.warn("Excepción al reproducir sonido (verif. manual):", e); }
                    }
                } else if (numerosEnCarton.length === 0) {
                    mensajeVerificacionCarton.innerHTML = `ℹ️ Cartón ${numeroCarton} sin números válidos.`;
                    mensajeVerificacionCarton.style.color = "orange";
                } else {
                    mensajeVerificacionCarton.innerHTML = `Cartón ${numeroCarton}:<br>
                        ❌Faltan: ` + faltantes.map(num => `<span class="numeroFaltante">${num}</span>`).join(' ') + `<br>
                        ✅Salieron: ` + numerosSalidosEnCarton.map(num => `<span class="numeroVerificado">${num}</span>`).join(' ');
                    mensajeVerificacionCarton.style.color = "red";
                }
            }
        }
    }
    if(cartonVerificar) {
        cartonVerificar.value = "";
        cartonVerificar.focus();
    }
}

// Eventos focus/blur
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
            actualizarEstadoJuego("pausadoInput");
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
            actualizarEstadoJuego("pausadoInput");
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

function actualizarEstadoJuego(estado) {
    const estadoJuegoDiv = document.getElementById('estadoJuego');
    if (!estadoJuegoDiv) return;
    estadoJuegoDiv.style.display = 'block';
    switch (estado) {
        case "enMarcha": estadoJuegoDiv.textContent = "✅ Juego en marcha ✅"; estadoJuegoDiv.className = "enMarcha"; break;
        case "pausado": estadoJuegoDiv.textContent = "❌ Juego pausado ❌"; estadoJuegoDiv.className = "pausado"; break;
        case "listo": estadoJuegoDiv.textContent = "ℹ️ Juego listo. ¡Presiona Comenzar! ℹ️"; estadoJuegoDiv.className = "listo"; break;
        case "finalizado": estadoJuegoDiv.textContent = "🏁 ¡Juego finalizado! 🏁"; estadoJuegoDiv.className = "finalizado"; break;
        case "pausadoInput": estadoJuegoDiv.textContent = "⌨️ Pausa (input activo) ⌨️"; estadoJuegoDiv.className = "pausadoInput"; break;
        default: estadoJuegoDiv.textContent = estado; estadoJuegoDiv.className = estado; 
    }
}

function limpiarMensajeVerificacion() {
    const mensajeVerificacion = document.getElementById('mensajeVerificacion');
    if (mensajeVerificacion) {
        mensajeVerificacion.innerHTML = ''; 
        mensajeVerificacion.style.color = ''; 
    }
}

// --- Lógica de Bingo (General - basada en tu script original, corregida y con sonido) ---
function verificarTodosLosCartones() {
    const elementosCartones = document.querySelectorAll('#cartonesContainer > div[id^="carton"]');
    let algunBingoNuevoEsteTurno = false;

    elementosCartones.forEach(cartonElement => {
        const idCompleto = cartonElement.id;
        const match = idCompleto.match(/^carton(\d+)$/);
        if (!match || !match[1]) return; 
        const numeroCarton = parseInt(match[1]);

        if (cartonesConBingo.includes(numeroCarton)) { 
            return; 
        }
        
        const numerosEnCartonAttr = cartonElement.getAttribute('data-numeros');
        if (numerosEnCartonAttr && numerosEnCartonAttr.trim() !== "") {
            const numerosEnCarton = numerosEnCartonAttr.split(',').map(Number).filter(n => n > 0 && !isNaN(n));
            if (numerosEnCarton.length > 0) { 
                const faltantes = numerosEnCarton.filter(num => !numerosSalidos.includes(num));
                if (faltantes.length === 0) { 
                    if (!cartonesConBingo.includes(numeroCarton)) { 
                        cartonesConBingo.push(numeroCarton);
                        algunBingoNuevoEsteTurno = true;
                    }
                }
            }
        }
    });

    if (algunBingoNuevoEsteTurno) {
        try {
            bingoAudio.currentTime = 0; 
            bingoAudio.play().catch(e => console.warn("Error al reproducir sonido de bingo:", e));
        } catch (e) {
            console.warn("Excepción al reproducir sonido de bingo (general):", e);
        }
    }

    actualizarListaBingos();
    actualizarMisCartonesBingoDisplay(); 
}

function actualizarListaBingos() { 
    const lista = document.getElementById('listaCartonesBingo');
    if(!lista) return;
    lista.innerHTML = '';
    
    if (cartonesConBingo.length === 0) {
        lista.textContent = "Ningún cartón tiene bingo todavía";
        return;
    }
    
    cartonesConBingo.sort((a,b) => a - b); 
    cartonesConBingo.forEach(numero => {
        const elemento = document.createElement('div');
        elemento.className = 'carton-bingo'; 
        elemento.textContent = `${numero}`;
        lista.appendChild(elemento);
    });
}
// --- FIN Lógica de Bingo ---

// --- INICIALIZACIÓN DEL JUEGO ---
window.onload = () => {
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

    if (typeof speechSynthesis !== 'undefined') {
        if (speechSynthesis.getVoices().length === 0) {
            speechSynthesis.onvoiceschanged = () => {
                populateVoiceList();
                const voiceSelectElement = document.getElementById('voiceSelect');
                 if (voiceSelectElement && !voiceSelectElement.onchange) { 
                    voiceSelectElement.addEventListener('change', setVoice);
                }
            };
        } else {
            populateVoiceList(); 
            const voiceSelectElement = document.getElementById('voiceSelect');
            if (voiceSelectElement) {
                voiceSelectElement.addEventListener('change', setVoice);
            }
        }
    } else {
        const voiceSettingsContainer = document.getElementById('voiceSettingsContainer');
        if (voiceSettingsContainer) voiceSettingsContainer.style.display = 'none';
    }
    
    reiniciarJuego(); 
};
