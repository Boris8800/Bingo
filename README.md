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

## 🔄 Sistema de Sincronización en Tiempo Real (Web3)

### Token Inteligente
El juego utiliza un sistema de token automático para sincronizar el estado entre el host (Web1) y los espectadores (Web3):

**Formato del Token:**
```
[2-dígit código de juego] + [contador de sorteo]

Ejemplo: 22+1+2+3+4
```

- **Código de Juego** (2 dígitos, 10-99): Se genera automáticamente al compartir y permanece constante durante toda la sesión de juego.
- **Contador de Sorteo**: Se incrementa automáticamente (+1, +2, +3...) cada vez que el host sorteó un número.

### Cómo Funciona la Sincronización
1. El host (Web1) **genera un token** que contiene el código de juego + el contador actual.
2. El token se comparte mediante:
   - **Código QR**: Escaneado para acceso rápido
   - **Enlace directo**: `web3.html#22+1+2+3...`
   - **Token texto**: Copiable manualmente
3. El cliente (Web3) **valida el formato** del token y verifica que comience con un código de 2 dígitos.
4. Cada **1 segundo**, Web3 verifica si hay un nuevo número en el servidor:
   - Si detecta `+1`, marca el primer número
   - Si detecta `+2`, marca el segundo número
   - Y así sucesivamente...
5. Los cartones se **sincronizan automáticamente** mostrando los números en tiempo real.

### Ventajas
- ✅ **Sin necesidad de servidor**: Funciona con sincronización basada en URL
- ✅ **Sincronización rápida**: Verificación cada 1 segundo
- ✅ **Código simple**: Fácil de recordar y compartir (ej: "22")
- ✅ **Persistencia**: El token se preserva al recargar la página
- ✅ **Múltiples partidas**: Cada "Nueva Partida" genera un nuevo código (10-99)

### Ejemplo de Flujo
```
Host (Web1) inicio:        Cliente (Web3):
Código: 22                 Espera "22+1"
Sortea número 1 → Token: 22+1   ✅ Detecta +1, marca número 1
Sortea número 2 → Token: 22+1+2   ✅ Detecta +2, marca número 2
Sortea número 3 → Token: 22+1+2+3   ✅ Detecta +3, marca número 3
...
```

## 🎯 Características de Web3 (Espectador)

### Seguir Cartones
Los espectadores (Web3) pueden ahora rastrear sus propios cartones:
- **Ingresa tus números**: Introduce los números de tu cartón separados por comas (ej: 7, 15, 23)
- **Seguimiento automático**: El sistema marca automáticamente tus números conforme el host los sorteó
- **Alertas de Bingo**: Se notifica cuando tienes un BINGO en tus cartones rastreados
- **Sincronización**: Tu tracker se sincroniza en tiempo real con el juego del host
- **Persistencia**: Los cartones rastreados se guardan y recuperan al recargar

### Visualización en Tiempo Real
- Panel de últimos 10 números sorteados
- Estado de sincronización con el host
- Lista de cartones ganadores
- Interfaz limpia y responsiva optimizada para móviles

### Cómo Funciona la Lógica +1+2+3+4+5...

**Backend (Web1 - Host):**
1. Al compartir, genera código de 2 dígitos: `22`
2. Cada número sorteado incrementa un contador: `drawCounter++`
3. Token se construye: `baseCode + "+1+2+3+..."`
4. URL se actualiza automáticamente: `web3.html#22+1` → `web3.html#22+1+2` → etc.
5. Ejemplo de secuencia:
   - Sortea #1 → Token: `22+1`
   - Sortea #2 → Token: `22+1+2`
   - Sortea #3 → Token: `22+1+2+3`

**Frontend (Web3 - Espectador):**
1. Se carga con URL hash: `web3.html#22+1+2+3`
2. Extrae código base: `22`
3. Espera por el siguiente: `+4`
4. Cada 1 segundo verifica la URL
5. Cuando detecta nuevo número → marca los números en los cartones
6. Muestra estado: `✅ Detectado | Código: 22 | Números: 3`

### Persistencia del Token
- Al recargar Web1: Código y contador se restauran desde `localStorage`
- URL hash se mantiene actualizado
- Si desactivas compartir y reinicias: Nuevo código (10-99) y contador reset a 0

### Debugging
Para ver el progreso de sincronización:
1. Abre DevTools: `F12`
2. Ve a la pestaña "Console"
3. Verás logs como:
   - `🎲 New game code generated: 22`
   - `📡 Token updated: 22+1`
   - `🔍 Check: URL="22+1" | Expected="22+1"`
   - `✅ Detected +1 | Now waiting for +2`

## 🎯 Características Avanzadas

### Persistencia de Estado
- El juego guarda automáticamente:
  - Cartones seleccionados
  - Números sorteados
  - Preferencias (voz, velocidad, tema)
  - Partidas ganadas
- Todo se recupera al recargar la página (incluso en Web3)

### Detección de Bingo
- **Automática**: Línea completa o cartón completo (siguiendo reglas tradicionales)
- **Manual**: Verifica un número específico ingresando su valor
- **Sonido**: Chime sintetizado al detectar un BINGO
- **Historial**: Almacena todas las partidas ganadas
```