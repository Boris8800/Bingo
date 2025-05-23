// --- INICIO FUNCIONES DE VOZ ---
function populateVoiceList() {
    if (typeof speechSynthesis === 'undefined') {
        console.log("API de Voz no soportada por este navegador.");
        const voiceSelectContainer = document.getElementById('voiceSettingsContainer');
        if(voiceSelectContainer) voiceSelectContainer.style.display = 'none';
        return;
    }

    voices = speechSynthesis.getVoices();
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;
    voiceSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.textContent = 'Voz por defecto';
    defaultOption.value = ''; // Para indicar que se use la voz por defecto del navegador
    voiceSelect.appendChild(defaultOption);

    voices.forEach((voice, index) => {
        // Opcional: filtrar por idioma, ej. if (voice.lang.startsWith('es'))
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.setAttribute('data-voice-uri', voice.voiceURI);
        option.setAttribute('data-voice-index', index.toString()); // Guardamos el índice por si URI no es único o fiable
        voiceSelect.appendChild(option);
    });

    // Intentar reseleccionar la voz previamente guardada (si existe)
    if (selectedVoice && selectedVoice.voiceURI) {
        const previousSelectedOption = Array.from(voiceSelect.options).find(opt => opt.getAttribute('data-voice-uri') === selectedVoice.voiceURI);
        if (previousSelectedOption) {
            previousSelectedOption.selected = true;
        }
    } else if (selectedVoice === null && voiceSelect.options.length > 0) {
        voiceSelect.options[0].selected = true; // Seleccionar la opción por defecto
    }
}

function setVoice() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect || voiceSelect.selectedOptions.length === 0) {
        selectedVoice = null;
        return;
    }
    const selectedOptionValue = voiceSelect.selectedOptions[0].getAttribute('data-voice-uri');
    if (!selectedOptionValue) { // Opción "Voz por defecto"
        selectedVoice = null;
    } else {
        selectedVoice = voices.find(voice => voice.voiceURI === selectedOptionValue);
    }
}
// --- FIN FUNCIONES DE VOZ ---







let numerosSalidos = [];
        let numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
        let intervalo;
        let enEjecucion = false;
        let juegoPausado = false;

        // Generar los círculos de números
        const numerosContainer = document.getElementById('numerosContainer');
        for (let i = 1; i <= 90; i++) {
            const circulo = document.createElement('div');
            circulo.classList.add('numeroCirculo');
            circulo.textContent = i;
            circulo.id = `numero${i}`;
            numerosContainer.appendChild(circulo);
        }

        // Función para iniciar/detener el juego
        function startStop() {
            if (enEjecucion) {
                clearInterval(intervalo);
                document.getElementById('startStopBtn').textContent = 'Comenzar';
                enEjecucion = false;
                actualizarEstadoJuego("pausado");
            } else {
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
                }, 100); // Esperar 0.1 segundo antes de comenzar
            }
        }

        // Función para generar el siguiente número
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
        }

        // Función para anunciar el número
        function anunciarNumero(numero) {
            if (window.speechSynthesis) {
                const mensaje = new SpeechSynthesisUtterance(numero.toString());
                mensaje.lang = 'es-ES';
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(mensaje);
            }
        }

        // Función para marcar un número como salido
        function marcarNumero(numero) {
            const circulo = document.getElementById(`numero${numero}`);
            if (circulo) {
                circulo.classList.add('marcado');
            }
        }

        // Función para reiniciar el juego
        function reiniciarJuego() {
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

        // Función para actualizar los últimos 5 números
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

         // Función para verificar un número
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

        // Función para verificar un cartón
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
                mensajeVerificacionCarton.innerHTML = `❌ En el cartón ${numeroCarton}:<br>
                    Faltan: ` + numerosFaltantes.map(num => `<span class="numeroFaltante">${num}</span>`).join(' ') + `<br>
                    Salieron: ` + numerosSalidosCarton.map(num => `<span class="numeroVerificado">${num}</span>`).join(' ');
                mensajeVerificacionCarton.style.color = "red";
            }

            document.getElementById('cartonVerificar').value = "";
            document.getElementById('cartonVerificar').focus();

        }

        // Añadir evento blur al campo de verificación de cartón
        document.getElementById('cartonVerificar').addEventListener('blur', () => {
            if (juegoPausado) {
                intervalo = setInterval(siguienteNumero, 3000);
                enEjecucion = true;
                juegoPausado = false;
                document.getElementById('startStopBtn').textContent = 'Detener';
                actualizarEstadoJuego("enMarcha");
            }
            // Limpiar el mensaje de verificación al perder el foco
            document.getElementById('mensajeVerificacionCarton').textContent = "";
        });

        // Añadir eventos para pausar/reanudar con inputs
        document.getElementById('numeroVerificar').addEventListener('focus', () => {
            if (enEjecucion) {
                clearInterval(intervalo);
                juegoPausado = true;
                document.getElementById('startStopBtn').textContent = 'Comenzar';
                enEjecucion = false;
                actualizarEstadoJuego("pausado");
            }
        });

        document.getElementById('cartonVerificar').addEventListener('focus', () => {
            if (enEjecucion) {
                clearInterval(intervalo);
                juegoPausado = true;
                document.getElementById('startStopBtn').textContent = 'Comenzar';
                enEjecucion = false;
                actualizarEstadoJuego("pausado");
            }
        });

        document.getElementById('numeroVerificar').addEventListener('blur', function() {
            // Limpiar el mensaje inmediatamente al perder el foco
            limpiarMensajeVerificacion();
            
            // Reanudar el juego si estaba pausado
            if (juegoPausado) {
                intervalo = setInterval(siguienteNumero, 3000);
                enEjecucion = true;
                juegoPausado = false;
                document.getElementById('startStopBtn').textContent = 'Detener';
                actualizarEstadoJuego("enMarcha");
            }
        });

        document.getElementById('cartonVerificar').addEventListener('blur', function() {
            // Limpiar el mensaje inmediatamente al perder el foco
            document.getElementById('mensajeVerificacionCarton').textContent = "";
            
            // Reanudar el juego si estaba pausado
            if (juegoPausado) {
                intervalo = setInterval(siguienteNumero, 3000);
                enEjecucion = true;
                juegoPausado = false;
                document.getElementById('startStopBtn').textContent = 'Detener';
                actualizarEstadoJuego("enMarcha");
            }
        });

        // Limpiar mensajes al hacer clic en cualquier parte del documento
        document.addEventListener('click', function(event) {
            // Si el clic NO fue en el campo de verificación número ni en su botón
            if (!event.target.closest('#verificarNumeroContainer')) {
                limpiarMensajeVerificacion();
            }
            
            // Si el clic NO fue en el campo de verificación cartón ni en su botón
            if (!event.target.closest('#verificarCartonContainer')) {
                document.getElementById('mensajeVerificacionCarton').textContent = "";
            }
        });

        // Función para actualizar el estado del juego (MANTENIDA)
        function actualizarEstadoJuego(estado) {
            const estadoJuego = document.getElementById('estadoJuego');
            estadoJuego.style.display = 'block';
            estadoJuego.textContent = estado === "enMarcha" ? "✅Juego en marcha✅" : "❌Juego pausado❌";
            estadoJuego.className = estado === "enMarcha" ? "enMarcha" : "pausado";
        }

        // Función mejorada para limpiar el mensaje de verificación
        function limpiarMensajeVerificacion() {
            const mensajeVerificacion = document.getElementById('mensajeVerificacion');
            mensajeVerificacion.innerHTML = '';
            mensajeVerificacion.style.color = '';
        }

        // Función verificarNumero (actualizada para mantener estilos)
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

        // Función verificarCarton (actualizada para mantener estilos)
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

// Modificar la función siguienteNumero() - añadir al final:
verificarTodosLosCartones();

// Modificar reiniciarJuego() - añadir al inicio:
cartonesConBingo = [];
actualizarListaBingos();

   
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
    
    // AÑADE ESTA LÍNEA si no está:
    verificarTodosLosCartones();
}
