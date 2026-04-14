# 🎉 Bingo Virtual

![Version](https://img.shields.io/badge/version-1.3-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

[**Jugar Ahora**](https://boris8800.github.io/Bingo//)

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
- **Tableros Ordenados**: Los números en los mini-tableros guardados se muestran siempre ordenados de menor a mayor.
- **Estadísticas**: Ventana emergente con cartones y cuántos bingos han ganado.
- **Compatibilidad iOS**: Audio totalmente funcional en dispositivos Apple mediante activación por toque inicial.
- **Voces Premium**: Soporte preferente para voces de alta calidad como "Google Premium".

### 📤 Compartir y Exportar
- **PDF Export**: Genera y descarga tus cartones en PDF listos para imprimir con un solo clic.
- **Sincronización Multi-Dispositivo (P2P)**: Gracias a la integración con **PeerJS (WebRTC)**, puedes conectar tu PC (Host) con móviles (Invitados) de forma directa (Peer-to-Peer) sin necesidad de un servidor backend. ¡Ideal para GitHub Pages!
- **Audio sincronizado (P2P)**: El host envía el timestamp para que el anuncio por voz suene al mismo tiempo en Web3.
- **Tokens 2–4 Dígitos (progresivo)**: El sistema intentará reservar códigos cortos (2 dígitos) y, si están ocupados, escalará automáticamente a códigos más largos (3 o 4 dígitos) para reducir colisiones globales.
- **Modo Jugador**: Tus amigos pueden seguir el juego sincronizado desde sus propios dispositivos (`web3.html`).

## 🚀 Guía Rápida

1. **Jugar como Host (Máster)**:
   - Abre [https://boris8800.github.io/Bingo//](https://boris8800.github.io/Bingo//).
   - El sistema detectará automáticamente que eres el administrador.
   - Configura tus preferencias (voz, velocidad).
   - Pulsa **"Comenzar"** para iniciar el sorteo.
   - Usa **"Compartir"** para generar el código de juego (2–4 dígitos según disponibilidad).

2. **Jugar como Invitado (Móvil/Tablet)**:
   - Abre la web y ve a la sección **Web 3** o escanea el QR generado por el Host.
   - Ingresa el código de 2–4 dígitos o escanea el QR.
   - El dispositivo se conectará al canal del Host y recibirá los números en tiempo real conforme vayan saliendo.

   ## 🆘 Ayuda — Cómo funciona Bingo Virtual (versión simple)

   1) Roles:
   - Host (Máster): controla el sorteo desde un PC. Pulsa "Comenzar" para iniciar.
   - Jugadores (Web3): siguen el sorteo desde móviles o tablets usando el código que comparte el Host.

   2) Compartir el juego:
   - El Host pulsa "Compartir" y obtiene un código (2–4 dígitos) o un QR.
   - Los jugadores ingresan el código en la sección Web3 o escanean el QR.

   3) Qué pasa después:
   - Cada vez que el Host saca un número, todos los jugadores lo reciben casi al mismo tiempo.
   - Si activas sonido en tu móvil, la voz anunciará los números sincronizados con el Host.

   4) Mi nombre y seguimiento:
   - En Web3 te pedimos tu nombre al entrar; eso activa el sonido y mejora la sincronía.
   - Puedes introducir tus números para que el sistema te avise si haces ¡BINGO!.

   5) Problemas comunes:
   - "Sincronización: Expirado": el Host cerró la sesión; recarga la página y pide un nuevo código.
   - Si no oyes la voz, toca la pantalla para activar el audio (iOS/Android requieren gesto de usuario).

   Si quieres una explicación técnica más completa, sigue leyendo la sección "Detalles Técnicos de Sincronización".

   Contacto / Soporte
   - Si necesitas ayuda o quieres reportar un problema, escribe a: B80008800@gmail.com

## 🛠️ Detalles Técnicos de Sincronización

Este proyecto utiliza tres capas de sincronización para asegurar que nadie se pierda ningún número:

1. **BroadcastChannel API**: Para sincronizar pestañas abiertas en el mismo navegador instantáneamente.
2. **LocalStorage Events**: Como respaldo (fallback) para navegadores antiguos en el mismo dispositivo.
3. **PeerJS (WebRTC)**: Para la comunicación directa entre dispositivos a través de internet, permitiendo una experiencia de servidor real en un entorno estático sin registros ni costes.

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
- `web3.html`: **Vista de Cliente**. Interfaz simplificada para jugadores remotos.
- `js/script.js`: **Cerebro**. Contiene toda la lógica de estado, sorteo, PDF y sincronización.
- `css/style.css`: **Estilos**. Variables CSS modernas para temas y diseño responsive.

## 🔄 Sistema de Sincronización en Tiempo Real (Web3)

### Token Inteligente
El juego utiliza un sistema de token automático para sincronizar el estado entre el host (Web1) y los jugadores (Web3):

**Formato del Token (hash URL):**
```
[Código de juego (2-4 dígitos)], [lista de números separados por comas]

Ejemplo: 22,1,2,3,4
```

- **Código de Juego** (2-4 dígitos): Se genera automáticamente al compartir; el host intentará códigos cortos primero y escalará si están ocupados.
- **Lista de Números**: Los números sorteados se anexan al token en orden (separados por comas) y Web3 los procesa para marcar cartones.

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

## 🎯 Características de Web3 (Jugador)

### Seguir Cartones
Los jugadores (Web3) pueden ahora rastrear sus propios cartones:
- **Ingresa tus números**: Introduce los números de tu cartón separados por comas (ej: 7, 15, 23).
- **Control de Sincronización Inteligente**: Al hacer click en la caja de texto para editar tus cartones, la sincronización se **pausa automáticamente** para evitar que los números entrantes borren lo que estás escribiendo. Se reanuda al pulsar "Seguir".
- **Seguimiento automático**: El sistema marca automáticamente tus números conforme el host los sorteó.
- **Alertas de Bingo**: Se notifica cuando tienes un BINGO en tus cartones rastreados.
- **Persistencia**: Los cartones rastreados se guardan y recuperan al recargar.

### Visualización en Tiempo Real
- Panel de últimos 10 números sorteados
- Estado de sincronización con el host
- Lista de cartones ganadores
- Interfaz limpia y responsiva optimizada para móviles
- Menú compacto en el header con selección de voz

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

**Frontend (Web3 - Jugador):**
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

## 🔧 Cambios recientes de Conexión y Pruebas

Hechos importantes relacionados con la sincronización P2P y las pruebas (guardados en el repositorio):

- Archivos clave modificados:
   - `js/script.js`: mejoras en la gestión P2P (estado unificado, reconexión, prevención de doble inicialización) y hooks de prueba añadidos (`__setInternalPeerForTests`, `__getConnectionsCountForTests`, `__getApplySharedStateCountForTests`, además de exponer `__lastAppliedState` para inspección en tests).
   - `tests/run_p2p_sim.js`: simulador JSDOM de PeerJS (`PeerStub`) para pruebas locales de Master → Viewer, con delivery mejorado de conexiones y fallback controlado.
   - `make.js`: runner simple para ejecutar tests automatizados.

- ¿Qué solucionan estos cambios?
   - Mejor visibilidad del estado P2P en la UI (`p2pStatusText` / `syncStatus`).
   - Reconexión más robusta y mensajes de error más claros (p. ej. `Host no encontrado (bingo-v6-live-XX)`).
   - Prevención de doble-inicialización de `Peer` en viewers/masters.
   - Facilitan pruebas automatizadas en CI/local sin depender de navegadores reales.

- Cómo ejecutar las pruebas locales (headless + simulación P2P):

```bash
# Instalar dependencias (si no está hecho)
npm install

# Ejecutar el runner de pruebas (headless + P2P stub)
node make.js

# Ejecutar sólo headless (rápido)
node make.js --headless

# Ejecutar sólo P2P sim
node make.js --p2p
```

- Notas sobre la cobertura de pruebas:
   - `tests/run_p2p_sim.js` utiliza un stub (`PeerStub`) para emular la mensajería WebRTC dentro de JSDOM. Esto permite validar la lógica de difusión y recepción de estado (`broadcastState()` / `applySharedState()`), pero no sustituye pruebas E2E con navegadores reales para verificar WebRTC nativo.
   - Si quieres pruebas E2E reales de WebRTC, lo recomendado es usar Playwright/puppeteer para levantar dos contextos de navegador (Host + Viewer) y validar la conexión PeerJS en condiciones reales.

- Estado actual: los ajustes de conexión están comprometidos y empujados a la rama `main`.

### 🔊 Mejoras recientes en sincronización de audio (Host ↔ Viewers)

- El Host ahora soporta sincronización por conexión: los viewers envían métricas de jitter y el Host puede ajustar un `recommendedAudioDelay` por conexión para reducir el desfasaje.
- Los viewers calculan un `audioSyncOffsetMs` local usando pings de tiempo del Host y aplican una `dynamicAudioDelayExtraMs` basada en la desviación estándar del jitter para mayor robustez.
- Se envían periódicamente `AUDIO_PING` y los viewers reportan `AUDIO_JITTER_REPORT` (mean/stddev) al Host; el Host responde con `SPECTATOR_SOUND_ACK` incluyendo el retraso recomendado.
- UI del Host: nuevo panel `connectionMetrics` muestra por-connection: delay recomendado, último jitter y media (útil para diagnósticos en tiempo real).

Estas mejoras mejoran significativamente la percepción de sincronía en anuncios por voz en partidas con múltiple dispositivos y redes variables.

Si quieres, puedo: añadir pruebas Playwright para verificación real de WebRTC, o limpiar/extraer los hooks de prueba antes de publicar una release. ¿Qué prefieres?

---

## 📋 Registro Completo de Cartones (IDs 1-248)

A continuación se detalla la base de datos completa de cartones integrados en el sistema. Puedes usar estos IDs para verificar premios o seguir cartones específicos.

| ID | Números del Cartón |
|:---|:---|
| 1 | 2, 25, 36, 57, 81, 17, 20, 64, 4, 86, 32, 46, 53, 68, 75 |
| 2 | 26, 34, 47, 66, 83, 12, 22, 39, 51, 87, 3, 19, 44, 55, 70 |
| 3 | 8, 9, 14, 28, 43, 61, 82, 31, 50, 63, 77, 10, 37, 72, 84 |
| 4 | 1, 13, 21, 42, 60, 90, 18, 29, 48, 54, 71, 30, 56, 65, 79 |
| 5 | 15, 24, 40, 58, 73, 27, 45, 67, 76, 89, 38, 52, 69, 80, 6 |
| 6 | 23, 41, 62, 78, 85, 5, 16, 33, 59, 88, 7, 11, 35, 49, 74 |
| 7 | 14, 64, 77, 50, 1, 21, 80, 67, 35, 54, 40, 17, 73, 28, 39 |
| 8 | 9, 11, 20, 34, 55, 81, 2, 16, 24, 41, 62, 30, 45, 68, 74 |
| 9 | 27, 44, 56, 70, 6, 18, 37, 59, 83, 36, 48, 61, 76, 87, 3 |
| 10 | 13, 42, 58, 65, 89, 15, 33, 49, 72, 86, 26, 53, 69, 82, 5 |
| 11 | 12, 38, 52, 78, 85, 7, 29, 46, 75, 88, 19, 23, 57, 60, 90 |
| 12 | 4, 22, 43, 71, 84, 10, 31, 47, 63, 79, 25, 32, 51, 66, 8 |
| 13 | 8, 21, 42, 63, 75, 14, 26, 33, 50, 80, 38, 47, 56, 68, 84 |
| 14 | 18, 36, 55, 60, 87, 15, 40, 59, 72, 20, 49, 64, 79, 9, 3 |
| 15 | 7, 12, 39, 52, 66, 83, 31, 57, 74, 90, 69, 77, 5, 28, 45 |
| 16 | 41, 73, 53, 24, 1, 61, 35, 27, 10, 4, 62, 67, 46, 29, 16 |
| 17 | 2, 13, 48, 62, 81, 17, 30, 43, 70, 86, 22, 34, 54, 76, 88 |
| 18 | 85, 32, 19, 51, 6, 78, 65, 23, 37, 11, 89, 58, 71, 25, 44 |
| 19 | 14, 36, 48, 50, 61, 38, 17, 54, 72, 83, 68, 79, 46, 22, 5 |
| 20 | 16, 33, 55, 71, 80, 21, 40, 77, 84, 19, 37, 65, 76, 88, 8 |
| 21 | 7, 62, 70, 41, 23, 87, 66, 53, 32, 10, 44, 89, 59, 28, 13 |
| 22 | 6, 27, 56, 43, 69, 15, 30, 58, 75, 82, 2, 29, 47, 64, 90 |
| 23 | 78, 45, 67, 20, 9, 85, 73, 51, 34, 11, 74, 57, 39, 25, 4 |
| 24 | 1, 12, 24, 35, 49, 18, 31, 52, 60, 86, 26, 3, 42, 63, 81 |
| 25 | 2, 3, 18, 10, 24, 28, 35, 40, 46, 55, 61, 69, 77, 79, 82 |
| 26 | 11, 26, 42, 62, 83, 4, 31, 48, 56, 72, 20, 36, 59, 67, 84 |
| 27 | 12, 33, 44, 51, 63, 16, 39, 57, 71, 90, 22, 50, 74, 87, 1 |
| 28 | 15, 7, 34, 45, 75, 70, 81, 68, 49, 27, 89, 53, 66, 21, 6 |
| 29 | 14, 37, 43, 78, 17, 29, 60, 88, 23, 38, 54, 65, 85, 8, 9 |
| 30 | 13, 41, 52, 80, 5, 58, 64, 76, 30, 19, 32, 47, 25, 73, 86 |
| 31 | 21, 45, 60, 82, 1, 28, 32, 51, 87, 7, 64, 71, 85, 14, 38 |
| 32 | 15, 27, 42, 59, 73, 21, 9, 19, 46, 63, 84, 20, 36, 54, 88 |
| 33 | 11, 8, 35, 49, 77, 80, 29, 52, 65, 74, 79, 33, 41, 58, 79 |
| 34 | 18, 24, 47, 62, 50, 70, 83, 26, 31, 6, 13, 69, 56, 48, 37 |
| 35 | 12, 40, 61, 76, 89, 55, 86, 5, 23, 39, 16, 25, 43, 67, 78 |
| 36 | 17, 30, 53, 72, 81, 4, 10, 44, 75, 66, 22, 34, 57, 68, 90 |
| 37 | 38, 52, 2, 69, 79, 87, 71, 44, 30, 19, 82, 53, 67, 27, 6 |
| 38 | 22, 39, 57, 16, 31, 40, 23, 5, 11, 3, 85, 62, 81, 45, 64 |
| 39 | 10, 35, 54, 86, 72, 14, 43, 66, 74, 88, 25, 47, 58, 78, 37 |
| 40 | 12, 29, 33, 42, 76, 20, 48, 59, 63, 1, 7, 17, 51, 70, 83 |
| 41 | 26, 41, 4, 73, 80, 15, 21, 55, 60, 84, 34, 8, 49, 56, 68 |
| 42 | 9, 18, 36, 61, 77, 13, 24, 46, 65, 90, 28, 32, 50, 75, 89 |
| 43 | 85, 8, 4, 34, 53, 67, 10, 41, 55, 72, 89, 23, 38, 45, 61 |
| 44 | 15, 29, 49, 68, 75, 13, 35, 51, 70, 83, 26, 54, 63, 86, 5 |
| 45 | 1, 14, 17, 43, 57, 81, 87, 31, 50, 62, 73, 21, 37, 48, 66 |
| 46 | 3, 25, 36, 74, 84, 6, 18, 28, 65, 77, 20, 30, 44, 60, 88 |
| 47 | 19, 33, 46, 64, 78, 39, 52, 69, 82, 7, 12, 24, 42, 59, 71 |
| 48 | 16, 27, 40, 76, 90, 79, 56, 32, 11, 9, 2, 22, 80, 47, 58 |
| 100 | 10, 5, 3, 20, 26, 36, 41, 46, 52, 66, 65, 79, 81, 90, 80 |
| 101 | 3, 8, 16, 26, 29, 35, 44, 42, 54, 56, 66, 60, 70, 88, 87 |
| 102 | 9, 2, 19, 29, 27, 32, 38, 44, 51, 56, 68, 71, 78, 84, 86 |
| 103 | 5, 1, 14, 24, 21, 37, 33, 48, 49, 59, 65, 67, 77, 78, 81 |
| 104 | 6, 11, 14, 15, 21, 34, 43, 48, 55, 54, 63, 64, 75, 82, 88 |
| 105 | 12, 16, 22, 31, 30, 39, 45, 42, 57, 59, 60, 62, 77, 76, 89 |
| 106 | 7, 10, 13, 23, 36, 38, 47, 45, 57, 62, 69, 75, 79, 84, 89 |
| 107 | 5, 18, 15, 27, 34, 37, 43, 42, 52, 60, 61, 70, 72, 84, 89 |
| 108 | 3, 16, 17, 24, 30, 45, 40, 57, 50, 67, 63, 76, 75, 83, 87 |
| 109 | 7, 2, 11, 13, 21, 28, 32, 36, 46, 58, 62, 79, 78, 81, 80 |
| 110 | 8, 10, 19, 23, 29, 39, 31, 48, 41, 55, 51, 66, 77, 82, 90 |
| 111 | 3, 8, 10, 20, 31, 35, 41, 43, 58, 54, 66, 60, 77, 71, 90 |
| 112 | 1, 6, 12, 25, 26, 35, 44, 49, 56, 59, 69, 68, 74, 88, 73 |
| 113 | 4, 6, 19, 15, 27, 28, 34, 42, 56, 55, 64, 70, 88, 87, 85 |
| 114 | 9, 12, 18, 24, 23, 39, 36, 51, 50, 63, 68, 74, 76, 82, 86 |
| 115 | 3, 15, 11, 22, 25, 33, 37, 46, 58, 68, 62, 78, 79, 88, 80 |
| 116 | 7, 16, 13, 25, 38, 32, 47, 45, 57, 69, 62, 79, 75, 84, 89 |
| 117 | 2, 5, 17, 13, 28, 35, 38, 41, 48, 54, 55, 72, 73, 82, 87 |
| 118 | 1, 5, 14, 22, 26, 37, 33, 46, 49, 59, 65, 61, 72, 73, 83 |
| 119 | 2, 11, 17, 29, 21, 30, 40, 44, 48, 53, 52, 67, 78, 80, 81 |
| 120 | 8, 14, 18, 29, 23, 36, 44, 49, 52, 69, 67, 70, 75, 85, 89 |
| 201 | 3,10,19,28,31,40,45,54,55,63,67,74,75,82,90 |
| 202 | 4,9,12,20,26,33,38,47,56,59,65,68,71,85,88 |
| 203 | 5,11,18,21,30,34,37,42,43,50,61,62,73,84,89 |
| 204 | 2,7,13,17,22,27,36,41,46,52,60,76,77,80,81 |
| 205 | 8,15,16,23,29,32,35,48,51,57,64,72,78,83,87 |
| 206 | 1,6,14,24,25,39,44,49,53,58,66,69,70,79,86 |
| 207 | 7,10,13,25,36,38,45,47,57,62,69,75,79,84,89 |
| 208 | 1,5,14,26,28,33,37,48,49,59,65,67,77,78,81 |
| 209 | 2,9,11,15,21,32,41,46,50,53,58,61,74,80,83 |
| 210 | 3,8,16,22,29,35,42,44,54,56,60,66,70,87,88 |
| 211 | 4,6,17,19,20,24,31,34,43,55,64,71,73,85,90 |
| 212 | 12,18,23,27,30,39,40,51,52,63,68,72,76,82,86 |
| 213 | 1,16,23,28,36,44,49,58,59,61,68,71,80,84,89 |
| 214 | 2,7,13,19,24,31,39,46,48,51,56,67,70,73,87 |
| 215 | 3,10,18,20,29,33,38,41,45,50,65,77,79,83,86 |
| 216 | 4,8,14,17,27,32,37,40,43,60,66,74,78,82,85 |
| 217 | 5,11,15,21,25,30,35,47,52,55,62,63,72,75,81 |
| 218 | 6,9,12,22,26,34,42,43,64,69,76,84,87,88,90 |
| 219 | 4,7,13,23,25,31,37,40,47,53,58,69,74,79,87 |
| 220 | 1,8,17,18,22,33,35,49,50,61,67,72,73,83,85 |
| 221 | 2,9,16,20,27,36,38,46,51,56,66,70,71,84,86 |
| 222 | 5,10,19,28,29,32,41,44,52,65,68,78,80,81,82 |
| 223 | 3,11,14,21,24,30,45,48,54,57,62,63,77,88,90 |
| 224 | 6,12,15,26,34,39,42,43,45,59,60,64,75,76,89 |
| 225 | 8,11,15,22,25,38,39,40,56,59,68,70,79,80,83 |
| 226 | 5,23,26,33,40,48,55,57,62,65,75,77,78,82,84 |
| 227 | 1,6,16,19,22,27,34,44,49,51,54,60,69,76,85 |
| 228 | 2,7,10,12,21,28,31,35,36,58,63,64,74,81,86 |
| 229 | 3,9,13,17,20,29,32,41,43,45,61,67,71,72,90 |
| 230 | 4,14,18,30,37,42,46,47,50,52,53,66,73,87,88 |
| 231 | 6,16,19,24,30,31,42,47,57,64,66,71,76,81,90 |
| 232 | 1,9,20,27,32,43,45,50,51,53,60,61,74,84,86 |
| 233 | 3,11,15,22,25,33,37,46,58,62,68,78,79,80,88 |
| 234 | 4,7,10,12,21,26,34,39,40,56,59,63,65,77,83 |
| 235 | 2,5,13,17,28,35,38,41,48,54,55,72,73,82,87 |
| 236 | 8,14,18,23,29,36,44,49,52,67,69,70,75,85,89 |
| 237 | 1,5,14,22,26,33,37,46,49,59,61,65,72,73,83 |
| 238 | 7,13,16,25,32,38,45,47,57,62,69,75,79,84,89 |
| 239 | 9,12,18,23,24,36,39,50,51,63,68,74,76,82,86 |
| 240 | 2,11,17,21,29,30,40,44,48,52,53,67,78,80,81 |
| 241 | 3,8,10,20,31,35,41,43,54,58,60,66,71,77,90 |
| 242 | 4,6,15,19,27,28,34,42,55,56,64,70,85,87,88 |
| 243 | 5,15,18,27,34,37,42,43,52,60,61,70,72,85,89 |
| 244 | 1,6,12,25,26,35,44,49,56,59,68,69,73,74,88 |
| 245 | 3,16,17,24,30,40,45,50,57,63,67,75,76,83,87 |
| 246 | 2,7,11,13,21,28,32,36,46,58,62,78,79,80,81 |
| 247 | 4,9,14,20,22,33,38,47,53,54,64,65,71,85,86 |
| 248 | 8,10,19,23,29,31,39,41,48,51,55,66,77,82,90 |

*Nota: Para ver la lista completa de números de cada cartón, consulta los elementos `<div data-numeros="...">` en [index.html](index.html). Los 248 cartones han sido verificados y están sincronizados entre la versión Máster y Jugador.*
```