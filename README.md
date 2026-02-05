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
- **Sincronización Multi-Dispositivo (P2P)**: Gracias a la integración con **PeerJS (WebRTC)**, puedes conectar tu PC (Host) con móviles (Invitados) de forma directa (Peer-to-Peer) sin necesidad de un servidor backend. ¡Ideal para GitHub Pages!
- **Tokens 2–4 Dígitos (progresivo)**: El sistema intentará reservar códigos cortos (2 dígitos) y, si están ocupados, escalará automáticamente a códigos más largos (3 o 4 dígitos) para reducir colisiones globales.
- **Modo Espectador**: Tus amigos pueden seguir el juego sincronizado desde sus propios dispositivos (`web3.html`).

## 🚀 Guía Rápida

1. **Jugar como Host (Máster)**:
   - Abre [https://boris8800.github.io/Bingo/](https://boris8800.github.io/Bingo/).
   - El sistema detectará automáticamente que eres el administrador.
   - Configura tus preferencias (voz, velocidad).
   - Pulsa **"Comenzar"** para iniciar el sorteo.
   - Usa **"Compartir"** para generar el código de juego (2–4 dígitos según disponibilidad).

2. **Jugar como Invitado (Móvil/Tablet)**:
   - Abre la web y ve a la sección **Web 3** o escanea el QR generado por el Host.
   -   - Ingresa el código de 2–4 dígitos o escanea el QR.
   -   - El dispositivo se conectará al canal del Host y recibirá los números en tiempo real conforme vayan saliendo.

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
- `web3.html`: **Vista de Cliente**. Interfaz simplificada para espectadores remotos.
- `js/script.js`: **Cerebro**. Contiene toda la lógica de estado, sorteo, PDF y sincronización.
- `css/style.css`: **Estilos**. Variables CSS modernas para temas y diseño responsive.

## 🔄 Sistema de Sincronización en Tiempo Real (Web3)

### Token Inteligente
El juego utiliza un sistema de token automático para sincronizar el estado entre el host (Web1) y los espectadores (Web3):

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
```

- Notas sobre la cobertura de pruebas:
   - `tests/run_p2p_sim.js` utiliza un stub (`PeerStub`) para emular la mensajería WebRTC dentro de JSDOM. Esto permite validar la lógica de difusión y recepción de estado (`broadcastState()` / `applySharedState()`), pero no sustituye pruebas E2E con navegadores reales para verificar WebRTC nativo.
   - Si quieres pruebas E2E reales de WebRTC, lo recomendado es usar Playwright/puppeteer para levantar dos contextos de navegador (Host + Viewer) y validar la conexión PeerJS en condiciones reales.

- Estado actual: los ajustes de conexión están comprometidos y empujados a la rama `main`.

Si quieres, puedo: añadir pruebas Playwright para verificación real de WebRTC, o limpiar/extraer los hooks de prueba antes de publicar una release. ¿Qué prefieres?
```