
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
