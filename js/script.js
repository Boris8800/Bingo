// ---- Variables Globales del Juego ----
let numerosSalidos = [];
let numerosDisponibles = []; // Se inicializa en reiniciarJuego
let intervalo;
let enEjecucion = false;
let juegoPausado = false;
let cartonesConBingo = [];

// ---- Sistema de Sindicación y Sincronización (No-Server) ----
// Permite que múltiples pestañas y múltiples dispositivos se mantengan sincronizados
// sin necesidad de un backend propio, ideal para hosting estático (GitHub Pages).

// 1. BroadcastChannel: Sincronización instantánea entre pestañas del mismo navegador.
const syncChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('bingo_sync') : null;

// 2. Variables de Control de Estado de Red
let isMaster = true;           // Define si esta pestaña controla el juego (Host) o solo escucha (Live)
let ntfyEventSource = null;    // Fuente de eventos para recibir datos desde otros dispositivos (Cross-Device)
let lastDrawCounterReceived = -1; // Protege contra mensajes antiguos o fuera de orden

// ---- Identificadores de Juego (Tokens) ----
let currentGameToken = null;
let gameCodeFixed = null; // Código único de 4 dígitos (1000-9999) para aislar la partida
let drawCounter = 0;      // Contador secuencial para asegurar que se procesen los sorteos en orden correcto

// ---- Sincronización Logic ----
if (syncChannel) {
    syncChannel.onmessage = (event) => {
        if (!isMaster) {
            console.log('Sync received via BroadcastChannel');
            applySharedState(event.data);
        }
    };
}

// Escuchar cambios en otras pestañas vía localStorage (fallback)
window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && !isMaster) {
        console.log('Sync received via LocalStorage');
        const state = JSON.parse(event.newValue);
        applySharedState(state);
    }
});

/**
 * Inicializa la escucha de eventos desde otros dispositivos.
 * Utiliza ntfy.sh como puente de comunicación redundante y gratuito.
 */
function initCrossDeviceSync() {
    if (isMaster || !gameCodeFixed) return;
    
    if (ntfyEventSource) {
        ntfyEventSource.close();
    }
    
    // El tema es único basado en el código de 4 dígitos para evitar colisiones
        const topic = `bingo_boris_2026_${gameCodeFixed}`; // Unique topic based on the 4-digit code to avoid collisions
    console.log(`📡 Iniciando escucha Cross-Device en tema: ${topic}`);
    
    try {
        ntfyEventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);

        // Manejo robusto del mensaje SSE: ntfy puede enviar distintos formatos.
        ntfyEventSource.onmessage = (event) => {
            try {
                // event.data puede ser: "{\"message\":\"...\"}" o bien directamente el cuerpo enviado.
                let parsed = null;
                try {
                    parsed = JSON.parse(event.data);
                } catch (e) {
                    // No JSON, trataremos el texto tal cual
                    parsed = event.data;
                }

                // Si ntfy nos envía un wrapper con "message", usemos su contenido
                if (parsed && typeof parsed === 'object' && parsed.message) {
                    try {
                        const state = JSON.parse(parsed.message);
                        console.log('📲 Actualización recibida de otro dispositivo (wrapper.message)');
                        applySharedState(state);
                        return;
                    } catch (e) {
                        console.warn('Mensaje wrapper no es JSON:', e);
                    }
                }

                // Si el body ya es el JSON del estado
                if (typeof parsed === 'object') {
                    console.log('📲 Actualización recibida de otro dispositivo (direct JSON)');
                    applySharedState(parsed);
                    return;
                }

                // Si recibimos texto plano, intentamos parsearlo como JSON
                try {
                    const maybeState = JSON.parse(String(parsed));
                    console.log('📲 Actualización recibida (texto -> JSON)');
                    applySharedState(maybeState);
                    return;
                } catch (e) {
                    console.warn('No se pudo interpretar el mensaje SSE como JSON:', e);
                }
            } catch (e) {
                console.error('Error procesando mensaje Cross-Device', e);
            }
        };

        ntfyEventSource.onerror = (err) => {
            console.warn('Error en conexión Cross-Device. El cliente intentará reconectar automáticamente.', err);
        };
    } catch (e) {
        console.error('No se pudo iniciar Cross-Device Sync', e);
    }
}

/**
 * Difunde el estado actual del juego a todos los interesados.
 * Se ejecuta cada vez que el estado del juego cambia (numero nuevo, pausa, etc.)
 */
async function broadcastState() {
    if (!isMaster) return; // Solo el Master puede dictar el estado del juego

    const state = {
        numerosSalidos,
        numerosDisponibles,
        cartonesConBingo,
        drawIntervalMs,
        drawCounter,
        juegoPausado,
        enEjecucion,
        gameCodeFixed
    };
    
    // 1. Sincronización Local: Envía a otras pestañas en el mismo navegador/dispositivo
    if (syncChannel) {
        syncChannel.postMessage(state);
    }
    
    // 2. Sincronización Global: Envía a otros dispositivos vía ntfy.sh
    if (gameCodeFixed) {
        const topic = `bingo_boris_2026_${gameCodeFixed}`;
        try {
            // Enviamos JSON explícitamente para que el receptor lo identifique
            fetch(`https://ntfy.sh/${topic}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            }).catch(e => console.warn('Error al enviar estado a otros dispositivos', e));
        } catch (e) {
            console.warn('Error al enviar estado a otros dispositivos', e);
        }
    }
    
    // Guardar también en persistencia local por seguridad
    saveGameState();
}

/**
 * Aplica un estado de juego recibido externamente.
 * Filtra por drawCounter para evitar aplicar estados retrasados.
 */
function applySharedState(state) {
    if (!state) return;
    
    // Seguridad: Si el número de sorteo recibido es menor al actual, lo ignoramos
    if (state.drawCounter < lastDrawCounterReceived) return;
    lastDrawCounterReceived = state.drawCounter;
    
    numerosSalidos = state.numerosSalidos || [];
    numerosDisponibles = state.numerosDisponibles || [];
    cartonesConBingo = state.cartonesConBingo || [];
    drawIntervalMs = state.drawIntervalMs || 3500;
    drawCounter = state.drawCounter || 0;
    gameCodeFixed = state.gameCodeFixed || gameCodeFixed;
    
    // Actualizamos la interfaz con los nuevos datos
    applyGameStateToUI();
    
    // Sincronizamos los botones de control para reflejar el estado del Master
    const startStopBtn = document.getElementById('startStopBtn');
    if (startStopBtn) {
        if (state.enEjecucion) {
            startStopBtn.textContent = 'Detener';
            actualizarEstadoJuego("enMarcha");
        } else {
            startStopBtn.textContent = 'Empezar';
            actualizarEstadoJuego(state.juegoPausado ? "pausado" : "listo");
        }
    }
}

// ---- Velocidad del juego (ms) ----
let drawIntervalMs = 3500;

/// ---- Variables para Selección de Voz ----
let voices = [];
let selectedVoice = null;

// ---- Persistencia (localStorage) ----
const STORAGE_KEY = 'bingoGameStateV1';
let preferredVoiceURI = '';

// ---- Variables para Nuevas Funcionalidades ----
let myTrackedCardNumbers = [];
let audioCtx = null;

// ---- Sound Effects (Synthesized for reliability) ----
function initAudioContext() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("AudioContext not available:", e);
            return false;
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.warn("Could not resume AudioContext:", e));
    }
    return !!audioCtx;
}

function playBingoSoundEffect() {
    try {
        if (!initAudioContext()) return; // Exit silently if AudioContext unavailable
        
        const now = audioCtx.currentTime;
        
        function playNote(freq, startTime, duration, type = 'triangle') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        }

        // Happy "Winning" Sequence
        playNote(523.25, now, 0.4);          // C5
        playNote(659.25, now + 0.1, 0.4);    // E5
        playNote(783.99, now + 0.2, 0.4);    // G5
        playNote(1046.50, now + 0.3, 0.8, 'sine'); // C6
        
    } catch (e) {
        console.warn("Could not play synthesized sound:", e);
    }
}

// Unlock audio on mobile/browser with first user gesture (click, touch, keyboard)
// This allows AudioContext to be created and resumed properly
['click', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn("AudioContext not available:", e);
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(e => console.warn("Could not resume AudioContext:", e));
        }
    }, { once: true });
});

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
    if (!voiceSelect) return;

    const previouslySelectedURI = selectedVoice
        ? selectedVoice.voiceURI
        : (preferredVoiceURI || voiceSelect.value || '');
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

    // Intentamos auto-seleccionar Google Español o Paulina
    let autoSelectedVoice = voices.find(v => /Google Español/i.test(v.name) || /Paulina/i.test(v.name));
    if (autoSelectedVoice) {
        selectedVoice = autoSelectedVoice;
        const optionToSelect = Array.from(voiceSelect.options).find(opt => opt.value === autoSelectedVoice.voiceURI);
        if (optionToSelect) optionToSelect.selected = true;
    } else if (previouslySelectedURI) {
        const optionToSelect = Array.from(voiceSelect.options).find(opt => opt.value === previouslySelectedURI);
        if (optionToSelect) {
            optionToSelect.selected = true;
            selectedVoice = voices.find(voice => voice.voiceURI === previouslySelectedURI) || null;
        } else {
            voiceSelect.options[0].selected = true;
            selectedVoice = null;
        }
    } else {
        voiceSelect.options[0].selected = true;
        selectedVoice = null;
    }
}

function setVoice() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect || !voiceSelect.value) {
        selectedVoice = null;
        preferredVoiceURI = '';
        saveGameState();
        return;
    }
    selectedVoice = voices.find(voice => voice.voiceURI === voiceSelect.value) || null;
    preferredVoiceURI = voiceSelect.value;
    saveGameState();
}

// ---- FIN FUNCIONES DE VOZ ----

// ---- NUEVAS FUNCIONES PARA SEGUIR "MIS CARTONES" ----
function trackMyCards() {
    const inputEl = document.getElementById('myCardNumbersInput');
    if (!inputEl) {
        console.error("Elemento 'myCardNumbersInput' no encontrado.");
        return;
    }
    const inputText = inputEl.value;
    myTrackedCardNumbers = validateCardNumbers(inputText);

    actualizarMisCartonesBingoDisplay();
    inputEl.value = myTrackedCardNumbers.join(', ');
    saveGameState();

    const msgEl = document.getElementById('trackerMsg');
    if (msgEl) {
        msgEl.textContent = "Recordado";
        msgEl.style.color = "red";
        setTimeout(() => {
            msgEl.textContent = "";
        }, 1000);
    }
}

function validateCardNumbers(input) {
    if (!input || typeof input !== 'string') {
        console.error('❌ Invalid input: Input is not a string or is empty.');
        return [];
    }

    return input.split(',')
        .map(numStr => parseInt(numStr.trim()))
        .filter(num => !isNaN(num) && num > 0);
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

    misBingosEnJuego.sort((a, b) => a - b);
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.justifyContent = 'center';
    container.style.gap = '10px';
    container.style.marginTop = '10px';

    misBingosEnJuego.forEach(cartonId => {
        const elemento = document.createElement('div');
        elemento.className = 'numeroCirculo ultimoNumeroCirculo';
        elemento.style.backgroundColor = 'var(--bingo-success)';
        elemento.style.color = 'white';
        // Removed hardcoded dimensions to match "Last 10 Numbers" style
        elemento.textContent = cartonId;
        container.appendChild(elemento);
    });
    
    myTrackedListDiv.appendChild(container);
}
// ---- FIN FUNCIONES "MIS CARTONES" ----

// ---- FUNCIONES PRINCIPALES DEL JUEGO ----
/**
 * Reinicia el estado completo del juego.
 * Solo el Master tiene permiso para realizar un reinicio global.
 */
function reiniciarJuego() {
    if (numerosSalidos.length > 0 && isMaster) {
        if (!confirm("¿Estás seguro de que quieres reiniciar el juego? Se perderá el progreso actual.")) {
            return;
        }
    }
    
    // Reseteo de variables de estado
    gameCodeFixed = null;
    currentGameToken = null;
    drawCounter = 0; 
    
    numerosSalidos = [];
    numerosDisponibles = Array.from({ length: 90 }, (_, i) => i + 1);
    cartonesConBingo = [];

    const numeroDisplay = document.getElementById('numero');
    if (numeroDisplay) numeroDisplay.textContent = '--';

    const circulos = document.querySelectorAll('#numerosContainer .numeroCirculo');
    circulos.forEach(circulo => circulo.classList.remove('marcado'));

    if (intervalo) clearInterval(intervalo);
    const startStopBtn = document.getElementById('startStopBtn');
    if (startStopBtn) startStopBtn.textContent = 'Empezar';

    enEjecucion = false;
    juegoPausado = false;

    actualizarUltimosNumeros();
    limpiarMensajeVerificacion();
    
    // Si somos el Host, generamos un nuevo token único
    if (isMaster) {
        window.location.hash = '';
        const newToken = generateGameToken();
        window.location.hash = newToken;
    }
    
    const msgCarton = document.getElementById('mensajeVerificacionCarton');
    if (msgCarton) msgCarton.textContent = "";

    actualizarListaBingos();
    actualizarMisCartonesBingoDisplay();
    actualizarEstadoJuego("listo");
    saveGameState();
    
    updateShareButton();
    broadcastState();
}

function startStop() {
    if (!isMaster) {
        alert("El control del juego está deshabilitado en esta página. Por favor usa la página principal de control.");
        return;
    }
    const startStopBtn = document.getElementById('startStopBtn');
    if (!startStopBtn) return;

    if (enEjecucion) {
        clearInterval(intervalo);
        startStopBtn.textContent = 'Empezar';
        enEjecucion = false;
        actualizarEstadoJuego("pausado");
        broadcastState();
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
                intervalo = setInterval(siguienteNumero, drawIntervalMs);
                broadcastState();
            }
        }, 100);
    }
}

function siguienteNumero() {
    if (numerosDisponibles.length === 0) {
        alert("¡Todos los números han sido llamados!");
        clearInterval(intervalo);
        const startStopBtn = document.getElementById('startStopBtn');
        if (startStopBtn) startStopBtn.textContent = 'Empezar';
        enEjecucion = false;
        actualizarEstadoJuego("finalizado");
        return;
    }

    const indice = Math.floor(Math.random() * numerosDisponibles.length);
    const numero = numerosDisponibles.splice(indice, 1)[0];
    numerosSalidos.push(numero);
    drawCounter++; // Increment draw counter for web3 sync
    
    // Update URL hash with new token for web3 sync (only if game code exists from sharing)
    if (gameCodeFixed) {
        const newToken = generateGameToken();
        window.location.hash = newToken;
        console.log(`📡 Token updated: ${newToken}`);
    }

    const numeroDisplay = document.getElementById('numero');
    if (numeroDisplay) numeroDisplay.textContent = numero;

    marcarNumero(numero);
    actualizarUltimosNumeros();
    anunciarNumero(numero);
    verificarTodosLosCartones(); // This will now handle sound for tracked bingos
    saveGameState();
    broadcastState();
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
    ultimos10.forEach((numero, index) => {
        const circulo = document.createElement('div');
        circulo.classList.add('numeroCirculo', 'ultimoNumeroCirculo');
        
        // Add pulse-once only to the most recent number (the last one in the list)
        if (index === ultimos10.length - 1) {
            circulo.classList.add('pulse-once');
        }
        
        circulo.textContent = numero;
        ultimosNumerosContainer.appendChild(circulo);
    });
}

function verificarNumero() {
    const numeroVerificar = document.getElementById('numeroVerificar');
    const mensajeVerificacion = document.getElementById('mensajeVerificacion');
    if (!numeroVerificar || !mensajeVerificacion) return;
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
    if (numeroVerificar) numeroVerificar.value = "";
    if (numeroVerificar) numeroVerificar.focus();
}

/**
 * Verifica manualmente un cartón específico por su número de ID.
 * Útil para arbitraje en vivo. Muestra números faltantes y confirma Bingos.
 */
function verificarCarton() {
    const cartonVerificar = document.getElementById('cartonVerificar');
    const mensajeVerificacionCarton = document.getElementById('mensajeVerificacionCarton');
    const cartonDisplayContainer = document.getElementById('cartonDisplayContainer');
    if (!cartonVerificar || !mensajeVerificacionCarton || !cartonDisplayContainer) return;

    let numeroCartonInput = cartonVerificar.value.trim();
    if (!numeroCartonInput) return;

    const numeroCarton = parseInt(numeroCartonInput.replace(/[^0-9]/g, ''));

    cartonDisplayContainer.innerHTML = ''; // Limpiar visualizaciones previas
    mensajeVerificacionCarton.innerHTML = ''; 

    if (isNaN(numeroCarton) || numeroCarton < 1) {
        mensajeVerificacionCarton.textContent = "Número de cartón inválido.";
        mensajeVerificacionCarton.style.color = "red";
    } else {
        const cartonElement = document.getElementById(`carton${numeroCarton}`);
        if (!cartonElement) {
            mensajeVerificacionCarton.textContent = `No se encontró el cartón ${numeroCarton}.`;
            mensajeVerificacionCarton.style.color = "red";
        } else {
            const numerosEnCartonAttr = cartonElement.getAttribute('data-numeros');
            if (!numerosEnCartonAttr || numerosEnCartonAttr.trim() === "") {
                mensajeVerificacionCarton.textContent = "El cartón está vacío.";
                mensajeVerificacionCarton.style.color = "red";
            } else {
                const numerosEnCarton = numerosEnCartonAttr.split(',').map(Number).filter(n => n > 0 && !isNaN(n));
                const faltantes = numerosEnCarton.filter(num => !numerosSalidos.includes(num));
                
                // Generar mini-tablero visual para inspección rápida
                const card = document.createElement('div');
                card.className = 'saved-card';
                const title = document.createElement('strong');
                title.className = 'saved-card-title';
                title.textContent = `Cartón ${numeroCarton}`;
                card.appendChild(title);
                card.appendChild(generarMiniTableroParaCarton(numerosEnCartonAttr));
                cartonDisplayContainer.appendChild(card);

                if (numerosEnCarton.length > 0 && faltantes.length === 0) { // ¡Bingo detectado!
                    mensajeVerificacionCarton.textContent = "¡BINGO CONFIRMADO!";
                    mensajeVerificacionCarton.style.color = "green";
                    
                    // Anuncio vocal del resultado
                    if (window.speechSynthesis) {
                        const msg = new SpeechSynthesisUtterance(`Bingo confirmado. El cartón número ${numeroCarton} tiene bingo`);
                        if (selectedVoice) {
                            msg.voice = selectedVoice;
                            msg.lang = selectedVoice.lang;
                        } else {
                            msg.lang = 'es-ES';
                        }
                        window.speechSynthesis.speak(msg);
                    }
                    
                    // Sonido especial si el cartón está en seguimiento personal
                    if (myTrackedCardNumbers.includes(numeroCarton) && !cartonesConBingo.includes(numeroCarton)) {
                        playBingoSoundEffect();
                    }
                    
                    // Agregar a la lista global de Bingos si es nuevo
                    if (!cartonesConBingo.includes(numeroCarton)) {
                        cartonesConBingo.push(numeroCarton);
                        actualizarListaBingos();
                        actualizarMisCartonesBingoDisplay();
                        saveGameState();
                        broadcastState();
                    }
                } else {
                    // Informar qué números faltan para cantar Bingo
                    mensajeVerificacionCarton.innerHTML = `Faltan: <span style="color:red">${faltantes.join(', ')}</span>`;
                }
            }
        }
    }
    if (cartonVerificar) {
        cartonVerificar.value = "";
        cartonVerificar.focus();
    }
}

// Eventos focus/blur (sin cambios de sonido aquí)
const numeroVerificarInputEl = document.getElementById('numeroVerificar');
const cartonVerificarInputEl = document.getElementById('cartonVerificar');
const startStopBtnEl = document.getElementById('startStopBtn');

if (cartonVerificarInputEl) {
    cartonVerificarInputEl.addEventListener('blur', () => {
        if (juegoPausado && startStopBtnEl) {
            intervalo = setInterval(siguienteNumero, drawIntervalMs);
            enEjecucion = true;
            juegoPausado = false;
            startStopBtnEl.textContent = 'Detener';
            actualizarEstadoJuego("enMarcha");
        }
        const msgCarton = document.getElementById('mensajeVerificacionCarton');
        if (msgCarton) msgCarton.textContent = "";
        const cartonDisplay = document.getElementById('cartonDisplayContainer');
        if (cartonDisplay) cartonDisplay.innerHTML = "";
    });
    cartonVerificarInputEl.addEventListener('focus', () => {
        if (enEjecucion && startStopBtnEl) {
            clearInterval(intervalo);
            juegoPausado = true;
            startStopBtnEl.textContent = 'Empezar';
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
            startStopBtnEl.textContent = 'Empezar';
            enEjecucion = false;
            actualizarEstadoJuego("pausadoInput");
        }
    });
    numeroVerificarInputEl.addEventListener('blur', function () {
        limpiarMensajeVerificacion();
        if (juegoPausado && startStopBtnEl) {
            intervalo = setInterval(siguienteNumero, drawIntervalMs);
            enEjecucion = true;
            juegoPausado = false;
            startStopBtnEl.textContent = 'Detener';
            actualizarEstadoJuego("enMarcha");
        }
    });
}

function formatMs(ms) {
    return `${(ms / 1000).toFixed(1)}s`;
}

function setDrawSpeed(ms, { persist = true } = {}) {
    if (!Number.isFinite(ms)) return;
    const clamped = Math.min(7000, Math.max(1500, Math.round(ms / 500) * 500));
    drawIntervalMs = clamped;

    const slider = document.getElementById('speedSlider');
    if (slider) slider.value = String(clamped);
    const label = document.getElementById('speedValue');
    if (label) label.textContent = formatMs(clamped);

    // If the game is running, apply immediately
    if (enEjecucion) {
        if (intervalo) clearInterval(intervalo);
        intervalo = setInterval(siguienteNumero, drawIntervalMs);
    }

    if (persist) saveGameState();
}
document.addEventListener('click', function (event) {
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
        case "listo": estadoJuegoDiv.textContent = "ℹ️ Juego listo. ¡Presiona Empezar! ℹ️"; estadoJuegoDiv.className = "listo"; break;
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
function verificarTodosLosCartones(options = {}) {
    const { silent = false } = options;
    const elementosCartones = document.querySelectorAll('#cartonesContainer > div[id^="carton"]');
    // let algunBingoNuevoEsteTurno = false; // Variable no longer used for sound here

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
                if (faltantes.length === 0) { // Bingo detected
                    if (!cartonesConBingo.includes(numeroCarton)) {
                        cartonesConBingo.push(numeroCarton);
                        // algunBingoNuevoEsteTurno = true; // Not used for sound here

                        // Req 3: Play sound if this new bingo is for a tracked card
                        if (!silent && myTrackedCardNumbers.includes(numeroCarton)) {
                            playBingoSoundEffect();
                        }
                        
                        // If we are master, we should broadcast that a new bingo was found
                        if (isMaster) {
                            broadcastState();
                        }
                    }
                }
            }
        }
    });

    actualizarListaBingos();
    actualizarMisCartonesBingoDisplay();

    // Refresh "Cartones Guardados" if they are visible
    const container = document.getElementById('cartonesGuardadosContainer');
    if (container && !container.hasAttribute('hidden')) {
        mostrarCartonesGuardados();
    }
}

// ---- Persistencia: guardar/cargar estado ----
function saveGameState() {
    try {
        if (typeof localStorage === 'undefined') return;
        const state = {
            numerosSalidos,
            numerosDisponibles,
            cartonesConBingo,
            myTrackedCardNumbers,
            preferredVoiceURI,
            drawIntervalMs,
            currentGameToken,
            gameCodeFixed,  // Save game code to persist token
            drawCounter,    // Save draw counter to rebuild token
            updatedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        // localStorage puede fallar (modo privado / cuota / permisos)
        console.warn('No se pudo guardar el estado del juego:', e);
    }
}

function loadGameState() {
    try {
        if (typeof localStorage === 'undefined') return false;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        const state = JSON.parse(raw);
        if (!state || typeof state !== 'object') return false;

        const salidos = Array.isArray(state.numerosSalidos) ? state.numerosSalidos : null;
        const disponibles = Array.isArray(state.numerosDisponibles) ? state.numerosDisponibles : null;
        if (!salidos || !disponibles) return false;

        numerosSalidos = salidos.filter(n => Number.isInteger(n) && n >= 1 && n <= 90);
        numerosDisponibles = disponibles.filter(n => Number.isInteger(n) && n >= 1 && n <= 90);
        // If both saved arrays are empty, treat this as no valid saved state
        // (prevents showing "all numbers called" on a fresh/new session with empty storage)
        if (numerosSalidos.length === 0 && numerosDisponibles.length === 0) return false;
        cartonesConBingo = Array.isArray(state.cartonesConBingo)
            ? state.cartonesConBingo.filter(n => Number.isInteger(n) && n > 0)
            : [];
        myTrackedCardNumbers = Array.isArray(state.myTrackedCardNumbers)
            ? state.myTrackedCardNumbers.filter(n => Number.isInteger(n) && n > 0)
            : [];
        preferredVoiceURI = typeof state.preferredVoiceURI === 'string' ? state.preferredVoiceURI : '';

        if (typeof state.drawIntervalMs === 'number' && Number.isFinite(state.drawIntervalMs)) {
            drawIntervalMs = state.drawIntervalMs;
        }

        if (typeof state.currentGameToken === 'string') {
            currentGameToken = state.currentGameToken;
        }
        
        // Restore game code and draw counter for token persistence
        if (typeof state.gameCodeFixed === 'number') {
            gameCodeFixed = state.gameCodeFixed;
        }
        if (typeof state.drawCounter === 'number') {
            drawCounter = state.drawCounter;
        }

        // Nunca reanudamos automáticamente en modo "en ejecución" al recargar.
        if (intervalo) clearInterval(intervalo);
        enEjecucion = false;
        juegoPausado = false;

        return true;
    } catch (e) {
        console.warn('No se pudo cargar el estado del juego:', e);
        return false;
    }
}

function applyGameStateToUI() {
    // Reset visual marks
    const circulos = document.querySelectorAll('#numerosContainer .numeroCirculo');
    circulos.forEach(circulo => circulo.classList.remove('marcado'));

    // Mark drawn numbers
    numerosSalidos.forEach(marcarNumero);

    // Current number = last drawn
    const numeroDisplay = document.getElementById('numero');
    if (numeroDisplay) {
        numeroDisplay.textContent = numerosSalidos.length ? String(numerosSalidos[numerosSalidos.length - 1]) : '--';
    }

    // Inputs
    const inputEl = document.getElementById('myCardNumbersInput');
    if (inputEl) inputEl.value = myTrackedCardNumbers.join(', ');

    // Voice preference
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect && preferredVoiceURI) {
        const option = Array.from(voiceSelect.options).find(opt => opt.value === preferredVoiceURI);
        if (option) {
            voiceSelect.value = preferredVoiceURI;
            setVoice();
        }
    }

    actualizarUltimosNumeros();
    setDrawSpeed(drawIntervalMs, { persist: false });
    verificarTodosLosCartones({ silent: true });
    limpiarMensajeVerificacion();
    const msgCarton = document.getElementById('mensajeVerificacionCarton');
    if (msgCarton) msgCarton.textContent = '';
    actualizarEstadoJuego('listo');

    const startStopBtn = document.getElementById('startStopBtn');
    if (startStopBtn) startStopBtn.textContent = 'Empezar';

    setDrawSpeed(drawIntervalMs, { persist: false });
}

// ---- Cartones guardados (mini tableros) ----
function generarMiniTableroElement(numeros) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mini-board';
    const nums = (numeros || '').split(',').map(n => n.trim()).filter(Boolean);
    nums.forEach(num => {
        const cell = document.createElement('div');
        cell.className = 'mini-cell';
        const val = parseInt(num, 10);
        cell.textContent = num;
        
        // Mark if the number has been drawn
        if (numerosSalidos.includes(val)) {
            cell.classList.add('marcado');
        }
        
        wrapper.appendChild(cell);
    });
    return wrapper;
}

function generarMiniTableroParaCarton(numeros) {
    return generarMiniTableroElement(numeros);
}

function mostrarCartonesGuardados() {
    const contenedor = document.getElementById('listaCartonesGuardados');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const cartonesNodeList = document.querySelectorAll('#cartonesContainer > div[data-numeros]');
    const cartonesArray = Array.from(cartonesNodeList);

    cartonesArray.sort((a, b) => {
        const numA = parseInt(a.id.replace('carton', ''), 10) || 0;
        const numB = parseInt(b.id.replace('carton', ''), 10) || 0;
        return numA - numB;
    });

    cartonesArray.forEach(carton => {
        const id = carton.id;
        const numeros = carton.getAttribute('data-numeros') || '';

        const card = document.createElement('div');
        card.className = 'saved-card';

        const title = document.createElement('strong');
        title.className = 'saved-card-title';
        title.textContent = id;

        card.appendChild(title);
        card.appendChild(generarMiniTableroElement(numeros));
        contenedor.appendChild(card);
    });
}

function setupCartonesGuardadosToggle() {
    const btn = document.getElementById('toggleCartonesBtn');
    const container = document.getElementById('cartonesGuardadosContainer');
    if (!btn || !container) return;

    btn.addEventListener('click', () => {
        const isHidden = container.hasAttribute('hidden');
        if (isHidden) {
            mostrarCartonesGuardados();
            container.removeAttribute('hidden');
            btn.textContent = 'Ocultar Cartones Guardados';
        } else {
            container.setAttribute('hidden', '');
            btn.textContent = 'Ver Cartones Guardados';
        }
    });
}

function actualizarListaBingos() {
    const lista = document.getElementById('listaCartonesBingo');
    if (!lista) return;
    lista.innerHTML = '';

    if (cartonesConBingo.length === 0) {
        lista.textContent = "Ningún cartón tiene bingo todavía";
        return;
    }

    cartonesConBingo.sort((a, b) => a - b);
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.justifyContent = 'center';
    container.style.gap = '10px';
    container.style.marginTop = '10px';

    cartonesConBingo.forEach(numero => {
        const elemento = document.createElement('div');
        elemento.className = 'numeroCirculo ultimoNumeroCirculo';
        elemento.style.backgroundColor = 'var(--bingo-success)';
        elemento.style.color = 'white';
        // Removed hardcoded dimensions to match "Last 10 Numbers" style
        elemento.textContent = numero;
        container.appendChild(elemento);
    });
    
    lista.appendChild(container);
}
// --- FIN Lógica de Bingo ---
// ---- Game Sharing Functions ----

function generateGameToken() {
    // If no game code exists, generate a 4-digit code (1000-9999)
    if (!gameCodeFixed) {
        gameCodeFixed = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        console.log(`🎲 New game code generated: ${gameCodeFixed}`);
    }
    
    // Base token is the code
    let token = gameCodeFixed.toString();
    
    // Append all drawn numbers: 21,1,30,21,45...
    if (numerosSalidos.length > 0) {
        token += ',' + numerosSalidos.join(',');
    }
    
    currentGameToken = token;
    return token;
}

function updateShareButton() {
    const token = generateGameToken();
    const btn = document.getElementById('shareGameBtn');
    if (btn) {
        // Extract the 4-digit game code for display
        const gameCode = gameCodeFixed || '----';
        btn.textContent = `Compartir (${gameCode})`;
    }
}

function shareGame() {
    try {
        const token = generateGameToken();
        
        // Build the correct share URL based on the current location
        const currentPath = window.location.pathname; // e.g., "/Bingo/index.html" or "/Bingo/"
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/Bingo'; // Get the directory
        const shareUrl = window.location.origin + basePath + '/web3.html#' + token;
        
        // Update Modal Content
        const tokenDisplay = document.getElementById('modalTokenDisplay');
        const shareUrlDisplay = document.getElementById('modalShareUrl');
        const fullTokenDisplay = document.getElementById('fullTokenDisplay');
        const qrContainer = document.getElementById('qrCodeContainer');
        
        // Display 4-digit game code
        if (tokenDisplay) tokenDisplay.textContent = gameCodeFixed || '----';
        if (shareUrlDisplay) shareUrlDisplay.textContent = shareUrl;
        if (fullTokenDisplay) fullTokenDisplay.textContent = token; // Show token like "22+1+2+3"
        
        // Clear and Generate QR Code
        if (qrContainer) {
            qrContainer.innerHTML = '';
            try {
                new QRCode(qrContainer, {
                    text: shareUrl,
                    width: 180,
                    height: 180,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.L  // Use Low error correction to fit longer URLs
                });
            } catch (qrError) {
                console.error('QR Code generation failed:', qrError);
                qrContainer.innerHTML = '<p style="color: red; font-size: 0.9em;">QR code too large. Use the link below.</p>';
            }
        }
        
        // Show Modal
        const modal = document.getElementById('shareModal');
        if (modal) {
            modal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error in shareGame:', error);
        alert('Error generating share: ' + error.message);
    }
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) modal.style.display = 'none';
}

function copyShareUrl() {
    const urlDisplay = document.getElementById('modalShareUrl');
    if (!urlDisplay) return;
    
    const url = urlDisplay.textContent;
    navigator.clipboard.writeText(url).then(() => {
        // Simple visual feedback on the button
        const btn = document.querySelector('#modalTokenContainer button');
        const originalText = btn.textContent;
        btn.textContent = '¡Copiado!';
        btn.style.backgroundColor = 'var(--bingo-success)';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

function copyFullToken() {
    const tokenDisplay = document.getElementById('fullTokenDisplay');
    if (!tokenDisplay) return;
    
    const token = tokenDisplay.textContent;
    navigator.clipboard.writeText(token).then(() => {
        // Simple visual feedback on the button
        const btn = document.querySelector('[onclick="copyFullToken()"]');
        const originalText = btn.textContent;
        btn.textContent = '¡Copiado!';
        btn.style.backgroundColor = 'var(--bingo-success)';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar token:', err);
    });
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('shareModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function validateSharedToken(encoded) {
    // Returns a structured result describing decode/parse outcome for easier debugging
    const result = {
        ok: false,
        reason: null, // 'not-base64'|'not-json'|'null-state'|'invalid-structure'|'error'|'ok'
        message: '',
        decoded: null,
        state: null,
        errors: {}
    };

    if (typeof encoded !== 'string') {
        result.reason = 'error';
        result.message = 'Token must be a string';
        return result;
    }

    // Attempt several decoding strategies and record any errors
    let decodedStr = null;
    let lastError = null;

    // Raw base64
    try {
        decodedStr = atob(encoded);
    } catch (e1) {
        result.errors.raw = e1.toString();
        lastError = e1;
    }

    // URL-decoded base64
    if (decodedStr === null) {
        try {
            const decodedUri = decodeURIComponent(encoded);
            if (decodedUri !== encoded) {
                decodedStr = atob(decodedUri);
                result.errors.used = 'decodeURIComponent';
            }
        } catch (e2) {
            result.errors.decodeURIComponent = e2.toString();
            lastError = lastError || e2;
        }
    }

    // Base64 with padding
    if (decodedStr === null) {
        try {
            const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
            decodedStr = atob(padded);
            result.errors.used = 'padding';
        } catch (e3) {
            result.errors.padding = e3.toString();
            lastError = lastError || e3;
        }
    }

    if (decodedStr === null) {
        result.reason = 'not-base64';
        result.message = 'Token is not valid Base64 (tried raw, decodeURIComponent, and padding).';
        return result;
    }

    result.decoded = decodedStr;

    // Try parsing JSON
    let parsed = null;
    try {
        parsed = JSON.parse(decodedStr);
    } catch (parseErr) {
        result.reason = 'not-json';
        result.message = 'Token decodes to non-JSON text.';
        result.errors.parse = parseErr.toString();
        return result;
    }

    // Check for null
    if (parsed === null) {
        result.reason = 'null-state';
        result.message = 'Token decoded to JSON null ("null"). Not a valid shared game snapshot.';
        result.state = null;
        return result;
    }

    // Validate structure
    if (typeof parsed !== 'object' || !Array.isArray(parsed.numerosSalidos)) {
        result.reason = 'invalid-structure';
        result.message = 'Decoded JSON does not have required structure (missing numerosSalidos array).';
        result.state = parsed;
        return result;
    }

    // Looks good
    result.ok = true;
    result.reason = 'ok';
    result.message = 'Valid shared-game snapshot';
    result.state = parsed;
    return result;
}

function loadSharedGame(encoded) {
    try {
        const validation = validateSharedToken(encoded);

        // If invalid, provide detailed logs and optional UI feedback
        if (!validation.ok) {
            console.error('loadSharedGame failed:', validation.reason, validation.message, validation.errors || '');
            // If token message area exists, show helpful message
            const tokenMessage = document.getElementById('tokenMessage');
            if (tokenMessage) {
                tokenMessage.textContent = `Error al cargar token: ${validation.message}`;
                tokenMessage.style.color = 'red';
            }
            return false;
        }

        // Apply the state
        const state = validation.state;
        numerosSalidos = state.numerosSalidos;
        drawIntervalMs = state.drawIntervalMs || 3500;
        myTrackedCardNumbers = state.myTrackedCardNumbers || [];
        cartonesConBingo = state.cartonesConBingo || [];
        currentGameToken = encoded;

        applyGameStateToUI();
        updateShareButton();

        // Success message (optional UI feedback)
        const tokenMessage = document.getElementById('tokenMessage');
        if (tokenMessage) {
            tokenMessage.textContent = '✅ Partida cargada desde token compartido.';
            tokenMessage.style.color = 'green';
        }

        return true;
    } catch (e) {
        console.error('Unexpected error in loadSharedGame:', e);
        const tokenMessage = document.getElementById('tokenMessage');
        if (tokenMessage) {
            tokenMessage.textContent = 'Error inesperado al cargar el token.';
            tokenMessage.style.color = 'red';
        }
    }
    return false;
}
// --- INICIALIZACIÓN DEL JUEGO ---
window.onload = () => {
    // Detect page mode
    const path = window.location.pathname;
    const page = document.body.getAttribute('data-page');
    
    if (page === 'web3') {
        isMaster = false;
    } else if (path.includes('live_index.html')) {
        isMaster = false;
    } else {
        isMaster = true; // index.html is the master
    }

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

    setupCartonesGuardadosToggle();

    // Speed slider
    const speedSlider = document.getElementById('speedSlider');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            setDrawSpeed(value);
        });
    }

    // Default UI - Set to 3.5 seconds as default
    setDrawSpeed(3500, { persist: true });

    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement ? document.activeElement.tagName : '';
        const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        if (isTyping) return;

        if (e.code === 'Space') {
            e.preventDefault();
            startStop();
        }
        if (e.key && e.key.toLowerCase() === 'r') {
            reiniciarJuego();
        }
    });

    const restored = loadGameState();
    if (restored) {
        applyGameStateToUI();
        if (!isMaster) initCrossDeviceSync();
    } else {
        // Check for shared game in URL hash
        const hash = window.location.hash.substring(1);
        if (hash) {
            // Check if it's the numeric format (XXXX,num1,num2...)
            if (/^\d{4}(?:,\d+)*$/.test(hash)) {
                console.log("Loading numeric token from hash:", hash);
                const parts = hash.split(',');
                gameCodeFixed = parseInt(parts[0]);
                numerosSalidos = parts.slice(1).map(Number);
                numerosDisponibles = Array.from({ length: 90 }, (_, i) => i + 1).filter(n => !numerosSalidos.includes(n));
                applyGameStateToUI();
                if (!isMaster) initCrossDeviceSync();
            } else if (loadSharedGame(hash)) {
                // Shared game loaded via Base64
                if (!isMaster) initCrossDeviceSync();
            } else {
                reiniciarJuego();
            }
        } else if (!isMaster) {
            // If we are on slave page without a hash, just wait for WebSocket or show empty
            reiniciarJuego();
        } else {
            reiniciarJuego();
        }
    }

    // New lightweight Visit Counter (Number only)
    const visitCounter = document.getElementById('count-display');
    if (visitCounter) {
        let visits = parseInt(localStorage.getItem('bingo_visits') || '0', 10);
        visits++;
        localStorage.setItem('bingo_visits', visits);
        visitCounter.textContent = visits;
    }

    // Update share button with current token
    updateShareButton();
};

async function downloadCardsAsPDF() {
    const originalText = "Descargar Cartones (PDF)";
    const links = document.querySelectorAll('a[onclick*="downloadCardsAsPDF"]');
    links.forEach(l => l.textContent = "Generando PDF...");

    // Create Loading Overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    // Use an opaque background to ensure the main site is hidden, highlighting that "something is happening"
    loadingOverlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
    loadingOverlay.style.zIndex = '99999';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.color = 'white';
    loadingOverlay.style.fontSize = '24px';
    loadingOverlay.style.flexDirection = 'column';
    loadingOverlay.innerHTML = '<div style="margin-bottom: 20px;"><div class="spinner" style="border: 4px solid rgba(255,255,255,0.3); border-radius: 50%; border-top: 4px solid #fff; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div></div><p>Generando tu PDF...</p><p style="font-size: 16px;">Por favor espera, esto puede tardar unos segundos.</p><style>@keyframes spin {0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}</style>';
    document.body.appendChild(loadingOverlay);

    try {
        // Create a temporary container for PDF generation
        // Strategy: Render it OFF-SCREEN but fully expanded (not scrollable)
        const tempContainer = document.createElement('div');
        tempContainer.id = 'pdf-capture-container';
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-12000px'; 
        tempContainer.style.top = '0';
        tempContainer.style.width = '1000px'; // Wide enough for 3 cards per row comfortably
        tempContainer.style.backgroundColor = '#ffffff';
        tempContainer.style.color = '#000000';
        tempContainer.style.padding = '40px';
        tempContainer.style.boxSizing = 'border-box';
        // Ensure no inherited transparency or dark mode issues
        tempContainer.style.setProperty('background-color', '#ffffff', 'important');
        tempContainer.style.setProperty('color', '#000000', 'important');

        const title = document.createElement('h1');
        title.style.fontSize = '36pt';
        title.style.margin = '0 0 40px 0';
        title.textContent = 'MIS CARTONES - BINGO';
        title.style.textAlign = 'center';
        title.style.color = '#000';
        title.style.fontFamily = 'Helvetica, sans-serif';
        tempContainer.appendChild(title);

        const grid = document.createElement('div');
        grid.style.display = 'flex';
        grid.style.flexWrap = 'wrap';
        grid.style.justifyContent = 'center';
        grid.style.gap = '30px';
        tempContainer.appendChild(grid);

        // Get all hardcoded cards from the web
        const cartonesNodeList = document.querySelectorAll('#cartonesContainer > div[data-numeros]');
        console.log(`Encontrados ${cartonesNodeList.length} contenedores de cartones.`);
        
        let addedCards = 0;
        cartonesNodeList.forEach(carton => {
            const id = carton.id;
            const numeros = carton.getAttribute('data-numeros');
            if (numeros && numeros.trim().length > 0) {
                addedCards++;
                const cardWrapper = document.createElement('div');
                cardWrapper.style.border = '3px solid #000';
                cardWrapper.style.borderRadius = '15px';
                cardWrapper.style.padding = '15px';
                cardWrapper.style.backgroundColor = '#ffffff';
                cardWrapper.style.width = '280px';
                cardWrapper.style.pageBreakInside = 'avoid';
                
                const cardTitle = document.createElement('div');
                cardTitle.textContent = "CARTÓN " + id.replace('carton', '').toUpperCase();
                cardTitle.style.fontWeight = 'bold';
                cardTitle.style.marginBottom = '15px';
                cardTitle.style.textAlign = 'center';
                cardTitle.style.fontSize = '16pt';
                cardTitle.style.color = '#000';
                cardTitle.style.fontFamily = 'Helvetica, sans-serif';

                cardWrapper.appendChild(cardTitle);
                
                // Create the mini board manually
                const miniBoard = document.createElement('div');
                miniBoard.style.display = 'grid';
                miniBoard.style.gridTemplateColumns = 'repeat(5, 1fr)';
                miniBoard.style.gap = '4px';
                miniBoard.style.justifyContent = 'center';
                
                const nums = numeros.split(',').map(n => n.trim()).filter(Boolean);
                nums.forEach(num => {
                    const cell = document.createElement('div');
                    cell.style.aspectRatio = '1';
                    cell.style.display = 'flex';
                    cell.style.alignItems = 'center';
                    cell.style.justifyContent = 'center';
                    cell.style.fontSize = '14pt';
                    cell.style.fontWeight = 'bold';
                    cell.style.border = '1px solid #000';
                    cell.style.borderRadius = '4px';
                    cell.style.backgroundColor = '#ffffff';
                    cell.style.color = '#000000';
                    cell.style.fontFamily = 'Helvetica, sans-serif';
                    cell.textContent = num;
                    
                    // Highlight if already played
                    const val = parseInt(num, 10);
                    if (typeof numerosSalidos !== 'undefined' && numerosSalidos.includes(val)) {
                        cell.style.backgroundColor = '#e0e0e0'; // Light grey for printed clarity
                        cell.style.color = '#000';
                    }
                    
                    miniBoard.appendChild(cell);
                });
                
                cardWrapper.appendChild(miniBoard);
                grid.appendChild(cardWrapper);
            }
        });

        if (addedCards === 0) {
            alert("No se encontraron cartones para exportar.");
            document.body.removeChild(loadingOverlay);
            links.forEach(l => l.textContent = originalText);
            return;
        }

        document.body.appendChild(tempContainer);

        const options = {
            margin:       10,
            filename:     'Bingo_Cartones.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                backgroundColor: '#ffffff'
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Delay to allow DOM layout
        await new Promise(resolve => setTimeout(resolve, 800));

        // Generate PDF
        await html2pdf().from(tempContainer).set(options).save();

        // Cleanup
        document.body.removeChild(tempContainer);
        document.body.removeChild(loadingOverlay);
        links.forEach(l => l.textContent = "¡PDF Guardado!");
        setTimeout(() => {
            links.forEach(l => l.textContent = originalText);
        }, 3000);

    } catch (error) {
        console.error("Error generating PDF:", error);
        if (document.getElementById('pdf-capture-container')) {
            document.body.removeChild(document.getElementById('pdf-capture-container'));
        }
        if (loadingOverlay && loadingOverlay.parentNode) {
            document.body.removeChild(loadingOverlay);
        }
        links.forEach(l => l.textContent = "Error al generar PDF");
        setTimeout(() => {
            links.forEach(l => l.textContent = originalText);
        }, 3000);
    }
}

// ---- Clear token on page unload (reload or navigate) ----
window.addEventListener('beforeunload', () => {
    window.location.hash = '';
    console.log('🧹 Token cleared from address bar');
});
