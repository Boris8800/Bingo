# Bingo
https://boris8800.github.io/Bingo/

¡Bienvenido al proyecto **Bingo**! Este juego de Bingo interactivo está desarrollado en HTML, CSS y JavaScript, diseñado para ser rápido, accesible y fácil de compartir.

## 🎲 Características Principales
- **Juego Automatizado**: Haz clic en **Comenzar** para iniciar el sorteo automático.
- **Velocidad Ajustable**: Controla el ritmo del juego desde 1.5s hasta 7.0s.
- **Local Storage**: El estado del juego se guarda automáticamente en tu navegador.
- **Modo Noche**: Cambia el tema para una mejor visualización en entornos oscuros.
- **Voz**: Anuncio automático de los números sorteados (opcional).
- **Seguimiento de Cartones**: Puedes ingresar tus números y el sistema te avisará si tienes Bingo.
- **Verificación de Números y Cartones**: Verifica si un número ha salido o si un cartón tiene Bingo.
- **Compartir Juego**: Comparte el estado del juego en tiempo real con otros usuarios.
- **Interfaz Mejorada**: Mensajes de confirmación, bolas más pequeñas para listas de Bingo, y efectos visuales en foco.

## 🚀 Cómo Usar
1. **Abrir el Juego**: Ve a [https://boris8800.github.io/Bingo/](https://boris8800.github.io/Bingo/) o abre `index.html` en tu navegador.
2. **Configurar**: Ajusta la velocidad, habilita voz si deseas, y cambia al modo noche.
3. **Jugar**: Haz clic en **Comenzar** para iniciar el sorteo.
4. **Seguimiento**: En "Seguir Cartones", ingresa tus números de cartón y presiona "Añadir" para recibir notificaciones.
5. **Verificar**: Usa las secciones de verificación para comprobar números o cartones.
6. **Compartir**: Comparte el enlace generado para que otros vean el juego en vivo.

## 🔗 Sistema de Compartir (Convención Interna)
Para el desarrollo, utilizamos la siguiente estructura:

- **Web 1**: El juego principal (`index.html`). Ahora incluye la funcionalidad de **Compartir** como una ventana modal integrada (anteriormente Web 2).
- **Web 3**: La **Vista de Juego Compartido** (`web3.html`), que permite a otros usuarios ver el estado exacto de tu tablero a través de un enlace o QR.

## 📁 Estructura del Proyecto
- `index.html`: Página principal del juego.
- `live_index.html`: Versión para transmisión en vivo.
- `web3.html`: Vista compartida del juego.
- `css/style.css`: Estilos CSS.
- `js/script.js`: Lógica del juego en JavaScript.
- `server.js`: Servidor Node.js para compartir (opcional).

## 🛠️ Desarrollo Local
1. Clona el repositorio: `git clone https://github.com/Boris8800/Bingo.git`
2. Abre `index.html` en tu navegador web.
3. Para el servidor de compartir: Instala Node.js, ejecuta `npm install`, luego `node server.js`.

## 📝 Notas de Versión Reciente
- **v1.x**: Agregado mensaje "Recordado" al añadir cartones en seguimiento.
- **v1.x**: Bolas más pequeñas en listas de Bingo para consistencia visual.
- **v1.x**: Efectos verdes en foco para inputs de verificación.
- **v1.x**: Aumento general de tamaño de fuente para mejor legibilidad.

---
© Boris8800 - 2026
