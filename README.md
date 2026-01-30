# 🎉 Bingo Virtual

![Version](https://img.shields.io/badge/version-1.2-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

[**Jugar Ahora**](https://boris8800.github.io/Bingo/)

Bienvenido al proyecto **Bingo Virtual**. Una aplicación web moderna, rápida y adaptable para jugar al Bingo en reuniones familiares o con amigos. Desarrollada con HTML5, CSS3 y JavaScript puro.

## ✨ Características Destacadas

### 🎮 Juego Principal
- **Sorteo Automático**: Sistema robusto de generación de números aleatorios con visualización clara.
- **Sintetizador de Voz**: Anuncio vocal de los números (compatible con voces del navegador).
- **Control Total**: Pausa, reanuda o reinicia el juego en cualquier momento.
- **Velocidad Ajustable**: Controla el ritmo del sorteo (intervalos de 1.5s a 7s).

### 📱 Experiencia de Usuario
- **Diseño Responsivo**: Optimizado para móviles, tablets y escritorio.
- **Modo Oscuro/Claro**: Interfaz adaptable a tus preferencias visuales.
- **Historial Visual**: Panel con los últimos 10 números y tablero completo.
- **Seguimiento Personal**: Añade tu cartón manual y el sistema te avisará si haces ¡BINGO!

### 📤 Compartir y Exportar
- **PDF Export**: Genera y descarga tus cartones en PDF listos para imprimir con un solo clic.
- **Live Share**: Comparte tu partida en tiempo real mediante un código simple de 1 dígito o un enlace QR.
- **Modo Espectador**: Tus amigos pueden seguir el juego sincronizado desde sus propios dispositivos (`web3.html`).

## 🚀 Guía Rápida

1. **Jugar como Host**:
   - Abre [https://boris8800.github.io/Bingo/](https://boris8800.github.io/Bingo/).
   - Configura tus preferencias (voz, velocidad).
   - Pulsa **"Comenzar"** para iniciar el sorteo.
   - Usa **"Compartir"** para generar un código y que otros se unan.

2. **Jugar como Invitado**:
   - Accede al enlace compartido o entra en la sección **Web 3**.
   - Ingresa el token/enlace proporcionado por el host.
   - ¡Sigue el juego en tu pantalla!

3. **Descargar Cartones**:
   - Ve a la sección de "Cartones".
   - Pulsa **"Descargar Cartones (PDF)"**.
   - Imprímelos y repártelos a los jugadores.

## 🛠️ Instalación Local

Si deseas ejecutar este proyecto en tu propia máquina:

```bash
# 1. Clona el repositorio
git clone https://github.com/Boris8800/Bingo.git

# 2. Navega al directorio
cd Bingo

# 3. Inicia un servidor local simple (requiere Python 3)
python3 -m http.server 8000

# 4. Abre tu navegador en:
# http://localhost:8000
```

## 📂 Estructura del Proyecto

- `index.html`: **Core del Juego**. Lógica principal, tablero y controles de host.
- `web3.html`: **Vista de Cliente**. Interfaz simplificada para espectadores remotos.
- `js/script.js`: **Cerebro**. Contiene toda la lógica de estado, sorteo, PDF y sincronización.
- `css/style.css`: **Estilos**. Variables CSS modernas para temas y diseño responsive.