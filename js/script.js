// ---- Variables Globales del Juego ----
let numerosSalidos = [];
let numerosDisponibles = []; // Se inicializa en reiniciarJuego
let intervalo;
let enEjecucion = false;
let juegoPausado = false;
var cartonesConBingo = [];
if (typeof window !== 'undefined') try { window.cartonesConBingo = cartonesConBingo; } catch (e) {}
let lastActivityTime = Date.now(); // Rastreo de inactividad
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutos en ms
let currentGameToken = null;

// ---- Sistema de Sindicación y Sincronización (No-Server) ----
// Permite que múltiples pestañas y múltiples dispositivos se mantengan sincronizados
// sin necesidad de un backend propio, ideal para hosting estático (GitHub Pages).

// 1. BroadcastChannel: Sincronización instantánea entre pestañas del mismo navegador.
const syncChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('bingo_sync') : null;

// 2. Variables de Control de Estado de Red (P2P via PeerJS)
let isMaster = (typeof window !== 'undefined' && window.__IS_MASTER === false) ? false : true;
let peer = null;
// Test hook: allows tests to inject an internal Peer instance (only used in tests)
function __setInternalPeerForTests(p) {
    try { peer = p; } catch (e) { console.warn('Could not set internal peer for tests:', e); }
}
// Test helper: return number of active connections (for test harness)
function __getConnectionsCountForTests() {
    try { return Array.isArray(connections) ? connections.length : 0; } catch (e) { return 0; }
}
// Test hook: count how many times applySharedState was invoked
let __applySharedStateCallCount = 0;
function __getApplySharedStateCountForTests() { try { return __applySharedStateCallCount; } catch (e) { return 0; } }
function __resetApplySharedStateCountForTests() { __applySharedStateCallCount = 0; }
// Expose test hooks on window for JSDOM test harness
if (typeof window !== 'undefined') {
    try {
        window.__getApplySharedStateCountForTests = __getApplySharedStateCountForTests;
        window.__resetApplySharedStateCountForTests = __resetApplySharedStateCountForTests;
        window.__setInternalPeerForTests = __setInternalPeerForTests;
        window.__getConnectionsCountForTests = __getConnectionsCountForTests;
        // Test hook: allow harness to inject a P2P-like state directly into this window
        window.__test_receiveP2PState = function(state) {
            try { console.log('TESTHOOK viewer __test_receiveP2PState called', state && (state.numerosSalidos ? state.numerosSalidos.length : 'no-numeros')); } catch (e) {}
            try { applySharedState(state); } catch (e) { console.error('TESTHOOK viewer applySharedState error', e); }
            try { window.__lastAppliedState = state; } catch (e) {}
        };
        window.__getLastAppliedStateForTests = function() { try { return window.__lastAppliedState || null; } catch (e) { return null; } };
    } catch (e) {}
}
let connections = [];         // Solo para Master: lista de conexiones activas
let connToMaster = null;      // Para Viewer: conexión activa al Master
const PEER_PREFIX = 'bingo-v6-live'; // Prefijo actualizado para forzar limpieza de sesiones
// Flag para pausar la sincronización cuando el usuario edita "Seguir mis Cartones"
let syncPausedByTracking = false;

// --- Función UI Status Master ---
function updateP2PStatus(status, color = "inherit") {
    const el = document.getElementById('p2pStatusText') || document.getElementById('syncStatus');
    if (el) {
        el.textContent = status;
        if (color) el.style.color = color;
    }
    updateSpectatorCount();
}

/**
 * Actualiza el contador de espectadores en el Master
 */
function updateSpectatorCount() {
    if (!isMaster) return;
    const el = document.getElementById('spectatorCountDisplay');
    if (el) {
        const activeConns = connections.filter(c => c && c.open).length;
        el.textContent = `Espectadores: ${activeConns}`;
    }
}

// --- Función UI Toast Compartida ---
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'connection-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 500);
    }, 3000);
}
let lastDrawCounterReceived = -1; 
let drawCounter = 0;
let gameCodeFixed = null;
let lastConnectedGameCode = null; // Para detectar cambio de token en espectadores
const AUDIO_SYNC_DELAY_MS = 500;
let lastAnnounceIdSent = -1;
let lastAnnounceNumber = null;
let lastAnnounceAt = 0;
let lastAnnounceIdApplied = -1;

/**
 * Verifica si un código de juego está siendo usado por un Master.
 * Intenta conectar al PeerID correspondiente.
 */
function checkTokenInUse(code, timeout = 1200) {
    return new Promise((resolve) => {
        if (!code) return resolve(false);
        // Usar un ID temporal aleatorio para no colisionar
        const tempPeer = new Peer(`check-${Math.floor(Math.random()*100000)}`);
        let finished = false;
        
        const cleanup = () => {
            if (finished) return;
            finished = true;
            try { tempPeer.destroy(); } catch (e) {}
        };

        const timer = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeout);

        tempPeer.on('open', () => {
            const peerId = `${PEER_PREFIX}-${code}`;
            const conn = tempPeer.connect(peerId);
            conn.on('open', () => {
                clearTimeout(timer);
                cleanup();
                resolve(true); // Alguien respondió, ID ocupado
            });
            conn.on('error', () => {
                clearTimeout(timer);
                cleanup();
                resolve(false);
            });
        });

        tempPeer.on('error', () => {
            clearTimeout(timer);
            cleanup();
            resolve(false);
        });
    });
}

// Reserve a free game code (starting from 2 digits up to 4 if needed)
async function reserveGameCode() {
    updateP2PStatus("Buscando canal libre...", "#ffc107");
    
    // Definir rangos de búsqueda progresiva (2 dígitos, luego 3)
    const ranges = [[10, 99], [100, 999]];
    
    for (const [min, max] of ranges) {
        let candidates = [];
        for (let i = min; i <= max; i++) candidates.push(i);
        
        // Barajar candidatos del rango actual
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // Probar Systematicamente un subconjunto de candidatos para no tardar una eternidad
        // Si el rango es pequeño (2 dígitos), probar todos. Si es grande, probar una muestra.
        const maxTries = (max - min > 150) ? 100 : (max - min + 1);
        const testSubset = candidates.slice(0, maxTries);

        for (const candidate of testSubset) {
            if (candidate === gameCodeFixed) continue;
            const inUse = await checkTokenInUse(candidate, 1200); 
            if (!inUse) {
                gameCodeFixed = candidate;
                lastActivityTime = Date.now();
                console.log(`🎯 Canal libre encontrado y reservado: ${gameCodeFixed}`);
                return gameCodeFixed;
            }
        }
    }

    // fallback final
    gameCodeFixed = Math.floor(Math.random() * 9000) + 1000;
    lastActivityTime = Date.now();
    return gameCodeFixed;
}

// --- Liberación por Inactividad ---
function checkInactivity() {
    if (!isMaster || !gameCodeFixed) return;
    
    const now = Date.now();
    if (now - lastActivityTime > INACTIVITY_LIMIT_MS) {
        console.warn("⚠️ Sesión expirada por inactividad de 15 minutos.");
        
        // Detener si estaba en marcha
        if (enEjecucion) {
            clearInterval(intervalo);
            enEjecucion = false;
        }

        const expiredCode = gameCodeFixed;
        gameCodeFixed = null;
        releaseClaim(); // Liberar el peer
        
        showToast(`Sesión ${expiredCode} cerrada por inactividad`);
        updateP2PStatus(`Expirado (${expiredCode})`, "#dc3545");
        
        const startStopBtn = document.getElementById('startStopBtn');
        if (startStopBtn) startStopBtn.textContent = 'Empezar';
        
        saveGameState();
    }
}

// Iniciar vigilante
setInterval(checkInactivity, 30000);

// --- Claiming protocol (P2P using PeerJS) ---
/**
 * Lógica de PeerJS para Sincronización P2P
 */
function claimToken(code) {
    if (!code) return Promise.resolve(false);
    updateP2PStatus("Conectando...", "#ffc107");
    
    return new Promise((resolve) => {
        if (peer) { try { peer.destroy(); } catch (e) {} }
        
        const peerId = `${PEER_PREFIX}-${code}`;
        console.log(`📡 Intentando reclamar ID P2P: ${peerId}`);
        
        peer = new Peer(peerId);
        
        peer.on('open', (id) => {
            console.log('✅ Master Peer activo:', id);
            gameCodeFixed = code;
            setupMasterListeners();
            updateP2PStatus("✅ Activo (Host)", "#28a745");
            resolve(true);
        });

        peer.on('disconnected', () => {
            console.warn('Pelado del servidor de señalización. Reconectando...');
            updateP2PStatus("Reconectando...", "#ffc107");
            peer.reconnect();
        });
        
        peer.on('error', (err) => {
            console.error('Error Peer Master:', err.type, err);
            if (err.type === 'unavailable-id') {
                updateP2PStatus("ID Ocupado", "#dc3545");
                resolve(false);
            } else if (err.type === 'network' || err.type === 'server-error') {
                updateP2PStatus("Error de Red", "#dc3545");
                setTimeout(() => peer.reconnect(), 5000);
                resolve(false);
            } else {
                updateP2PStatus("Error P2P", "#dc3545");
                resolve(false);
            }
        });
    });
}

function setupMasterListeners() {
    peer.on('connection', (conn) => {
        console.log('🤝 Espectador conectado:', conn.peer);
        connections.push(conn);
        
        // Notify Master UI if possible
        if (typeof onSpectatorJoined === 'function') {
            onSpectatorJoined();
        }
        
        updateSpectatorCount();
        
        // Enviar estado actual inmediatamente
        if (conn.open) {
            broadcastState();
        } else {
            conn.on('open', () => {
                broadcastState();
                updateSpectatorCount();
            });
        }
        
        conn.on('close', () => {
            connections = connections.filter(c => c !== conn);
            updateSpectatorCount();
        });
        conn.on('error', () => {
            connections = connections.filter(c => c !== conn);
            updateSpectatorCount();
        });
    });
}

function releaseClaim() {
    if (peer) {
        try { peer.destroy(); } catch (e) {}
        peer = null;
    }
    connections = [];
    console.log('🧹 Peer liberado');
}

window.addEventListener('beforeunload', () => {
    try { releaseClaim(); } catch (e) {}
});

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
        try {
            const state = JSON.parse(event.newValue);
            applySharedState(state);
        } catch (e) {}
    }
});

/**
 * Inicializa la escucha de eventos desde otros dispositivos (P2P).
 */
function initCrossDeviceSync() {
    if (isMaster || !gameCodeFixed) return;
    // Si el espectador está intentando conectarse a un token distinto, limpiar historial local
    if (lastConnectedGameCode !== gameCodeFixed) {
        clearLocalHistory();
        lastConnectedGameCode = gameCodeFixed;
    }
    if (peer && !peer.destroyed) { try { peer.destroy(); } catch (e) {} }
    
    console.log("🚀 Iniciando conexión de espectador...");
    updateP2PStatus("Iniciando P2P...", "#ffc107");
    
    peer = new Peer();
    
    peer.on('open', (id) => {
        console.log('📡 Mi ID de Espectador:', id);
        intentarConectarConMaster();
    });

    peer.on('disconnected', () => {
        console.warn('Espectador desconectado del servidor. Reconectando...');
        updateP2PStatus("Reconectando...", "#ffc107");
        peer.reconnect();
    });

    peer.on('error', (err) => {
        console.error('❌ Error Peer Espectador:', err.type, err);
        if (err.type === 'peer-unavailable') {
            const attemptedId = `${PEER_PREFIX}-${gameCodeFixed}`;
            updateP2PStatus(`Host no encontrado (${attemptedId})`, "#dc3545");
            // Reintentar en un momento por si el host está tardando en subir
            setTimeout(intentarConectarConMaster, 6000);
        } else {
            updateP2PStatus("Error de Conexión", "#dc3545");
        }
    });
}

function clearLocalHistory() {
    // Limpiar números y UI locales para evitar mezclar partidas
    numerosSalidos = [];
    numerosDisponibles = Array.from({ length: 90 }, (_, i) => i + 1);
    drawCounter = 0;
    // Limpiar UI
    const numerosContainer = document.getElementById('numerosContainer');
    if (numerosContainer) numerosContainer.innerHTML = '';
    // Recrear los círculos 1..90 para mantener la UI consistente
    if (numerosContainer) {
        for (let i = 1; i <= 90; i++) {
            const circulo = document.createElement('div');
            circulo.classList.add('numeroCirculo');
            circulo.textContent = i;
            circulo.id = `numero${i}`;
            numerosContainer.appendChild(circulo);
        }
        // pequeña animación para indicar recreación
        numerosContainer.classList.add('recreated');
        setTimeout(() => { try { numerosContainer.classList.remove('recreated'); } catch (e) {} }, 800);
    }
    const ultimos = document.getElementById('ultimosNumerosContainer');
    if (ultimos) ultimos.innerHTML = '';
    // quitar marcas en tablero principal si existe
    for (let i = 1; i <= 90; i++) {
        const el = document.getElementById(`numero${i}`);
        if (el) el.classList.remove('marcado');
    }
    const estadoJuegoDiv = document.getElementById('estadoJuego');
    if (estadoJuegoDiv) { estadoJuegoDiv.textContent = ''; estadoJuegoDiv.style.display = 'none'; }
}

function intentarConectarConMaster() {
    if (isMaster) return;
    if (!gameCodeFixed) {
        updateP2PStatus("Sin Código", "#dc3545");
        return;
    }

    if (!peer || peer.destroyed) {
        console.warn("Peer no inicializado. Re-intentando init...");
        initCrossDeviceSync();
        return;
    }

    if (peer.disconnected) {
        updateP2PStatus("Reconectando a Servidor...", "#ffc107");
        peer.reconnect();
        setTimeout(intentarConectarConMaster, 3000);
        return;
    }

    const masterId = `${PEER_PREFIX}-${gameCodeFixed}`;
    console.log(`🔗 Intentando conectar al Master ID: ${masterId}`);
    
    // Si ya existe una conexión abierta o en proceso, no hacemos nada
    if (connToMaster && (connToMaster.open || connToMaster._open)) {
        console.log("Conexión ya abierta o en proceso.");
        return;
    }
    
    updateP2PStatus(`Buscando Host (${gameCodeFixed})...`, "#ffc107");

    connToMaster = peer.connect(masterId);
    
    // Safety timeout for connection (increased to 15s for slow networks)
    const connectionTimeout = setTimeout(() => {
        if (connToMaster && !connToMaster.open) {
            console.warn('⌛ Tiempo de espera agotado conectando al Master.');
            updateP2PStatus("Host no responde (reintentando)", "#dc3545");
            connToMaster.close();
            setTimeout(intentarConectarConMaster, 5000);
        }
    }, 15000);

    connToMaster.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('✅ Conexión establecida con el Master');
        updateP2PStatus("Conectado", "#28a745");
        
        // Notify web3.html if function exists
        if (typeof onConnectionCompleted === 'function') {
            onConnectionCompleted();
        }
    });
    
    connToMaster.on('data', (data) => {
        console.log('📲 Actualización P2P recibida');
        applySharedState(data);
    });
    
    connToMaster.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error('❌ Error en conexión con Master:', err);
        updateP2PStatus('Error de conexión', '#dc3545');
        setTimeout(intentarConectarConMaster, 8000);
    });

    connToMaster.on('close', () => {
        clearTimeout(connectionTimeout);
        console.warn('Conexión cerrada. Reintentando...');
        updateP2PStatus('Reconectando...', '#ffc107');
        setTimeout(intentarConectarConMaster, 4000);
    });
}

/**
 * Difunde el estado actual del juego vía P2P.
 */
async function broadcastState() {
    const state = {
        numerosSalidos,
        numerosDisponibles,
        cartonesConBingo,
        bingoStats, // Sincronizar estadísticas globales
        drawIntervalMs,
        drawCounter,
        juegoPausado,
        enEjecucion,
        gameCodeFixed,
        myTrackedCardNumbers,
        preferredVoiceURI: preferredVoiceURI || '',
        announceId: lastAnnounceIdSent,
        announceNumber: lastAnnounceNumber,
        announceAt: lastAnnounceAt
    };

    // Include saved cartones (if present in DOM) so viewers can render the same cards
    try {
        const cartDivs = document.querySelectorAll('#cartonesContainer > div[data-numeros]');
        if (cartDivs && cartDivs.length > 0) {
            state.savedCartones = Array.from(cartDivs).map(d => ({ id: d.id || null, numeros: d.getAttribute('data-numeros') || '' }));
        } else {
            // fallback: include from persisted savedCards in localStorage
            const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('bingo_savedCardsV1') : null;
            if (raw) {
                try { state.savedCartones = JSON.parse(raw); } catch (e) {}
            }
        }
    } catch (e) {}

    if (isMaster && peer) {
        connections.forEach(conn => {
            if (conn && conn.open) {
                conn.send(state);
            }
        });
    }

    // Sincronización Local (BroadcastChannel)
    if (syncChannel) {
        syncChannel.postMessage(state);
    }
    
    saveGameState();
}

/**
 * Aplica un estado de juego recibido externamente.
 */
function applySharedState(state) {
    __applySharedStateCallCount++;
    try { console.log('TESTHOOK applySharedState called', {count: __applySharedStateCallCount, drawCounter: state && state.drawCounter, numerosSalidos_len: state && (state.numerosSalidos ? state.numerosSalidos.length : 'undefined')}); } catch (e) {}
    try { if (typeof window !== 'undefined') window.__lastAppliedState = state; } catch (e) {}
    if (!state) return;
    
    // Si somos Master, no aplicamos estados de otros (evita conflictos)
    if (isMaster) return;

    // Control de versión del estado (drawCounter)
    if (typeof state.drawCounter === 'number') {
        // Ignoramos si es un estado antiguo, EXCEPTO si el contador vuelve a 0 (reinicio del Master)
        const isReset = state.drawCounter === 0 && drawCounter > 0;
        if (!isReset && state.drawCounter < drawCounter) return;
        // Si es el mismo contador y ya lo procesamos, lo ignoramos (evita loops o doble procesamiento)
        if (state.drawCounter === drawCounter && lastDrawCounterReceived === state.drawCounter) return;
    }
    
    lastDrawCounterReceived = state.drawCounter;
    
    // Guardamos los bingos y números anteriores para detectar nuevos en Web3
    const oldBingos = [...cartonesConBingo];
    const oldNumeros = [...numerosSalidos];

    numerosSalidos = state.numerosSalidos || [];
    numerosDisponibles = state.numerosDisponibles || [];
    cartonesConBingo = state.cartonesConBingo || [];
    if (typeof window !== 'undefined') try { window.cartonesConBingo = cartonesConBingo; } catch (e) {}

    // Sincronizar estadísticas globales (bingoStats)
    if (state.bingoStats) {
        bingoStats = state.bingoStats;
        saveBingoStats(); // Persistir en el espectador
        // Refrescar lista si está abierta
        const modal = document.getElementById('statsModal');
        if (modal && modal.style.display === 'block') {
            renderBingoStatsList();
        }
    }

    // Detectar si hay un nuevo bingo en nuestros cartones seguidos (Para Web3)
    if (!isMaster) {
        const nuevosBingos = cartonesConBingo.filter(id => !oldBingos.includes(id));
        if (nuevosBingos.length > 0) {
            // Ya no hace falta llamar a incrementBingoStat localmente porque el Master
            // nos envía el estado actualizado de bingoStats, pero lo mantenemos por si acaso
            // o para asegurar que se cuente incluso si el broadcast tarda.
            // Para evitar duplicado, incrementBingoStat debería ser inteligente.
        }
        const trackedBingoGanador = nuevosBingos.find(id => myTrackedCardNumbers.includes(id));
        
        if (trackedBingoGanador) {
            console.log("🔊 ¡BINGO detectado en Web3 para cartón seguido:", trackedBingoGanador);
            playBingoSoundEffect();
            speakText(`¡Bingo en tu cartón número ${trackedBingoGanador}!`);
        }
    }
    
    drawIntervalMs = state.drawIntervalMs || 3500;
    // Aseguramos que drawCounter avance al mayor conocido
    if (typeof state.drawCounter === 'number') {
        drawCounter = Math.max(drawCounter, state.drawCounter);
    }
    gameCodeFixed = state.gameCodeFixed || gameCodeFixed;
    // Si el Master envía preferencia de voz, intentar aplicarla en Web3
    if (!isMaster && state.preferredVoiceURI) {
        tryApplyRemoteVoice(state.preferredVoiceURI);
    }
    
    // Actualizamos la interfaz con los nuevos datos
    applyGameStateToUI();

    // If the master provided saved cartones (cards), ensure viewer renders the same
    try {
        if (!isMaster && state.savedCartones && Array.isArray(state.savedCartones)) {
            // persist into localStorage for later loads
            try { localStorage.setItem('bingo_savedCardsV1', JSON.stringify(state.savedCartones)); } catch (e) {}

            // recreate cartonesContainer entries to match master
            const container = document.getElementById('cartonesContainer');
            if (container) {
                // remove existing generated cartones
                const existing = container.querySelectorAll('div[data-numeros]');
                existing.forEach(n => n.parentNode && n.parentNode.removeChild(n));

                state.savedCartones.forEach(s => {
                    const el = document.createElement('div');
                    if (s.id) el.id = s.id;
                    el.setAttribute('data-numeros', (s.numeros || '').toString());
                    container.appendChild(el);
                });
            }

            // Refresh saved cartones UI
            try { mostrarCartonesGuardados(); } catch (e) {}
        }
    } catch (e) {}
    
    // Guardamos estado para persistencia en refresh
    saveGameState();
    
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

    // Después de aplicar UI, si somos espectador y tiene activado sonido, leer nuevos números
    if (!isMaster) {
        const speakPref = (localStorage.getItem('web3Speak') === 'true');
        let usedAnnounce = false;

        if (speakPref && typeof state.announceId === 'number' && state.announceNumber && typeof state.announceAt === 'number') {
            if (state.announceId > lastAnnounceIdApplied) {
                lastAnnounceIdApplied = state.announceId;
                scheduleSpeakAt(state.announceNumber, state.announceAt);
                usedAnnounce = true;
            }
        }

        // Fallback: legacy local announcement if no synced announce was used
        if (!usedAnnounce) {
            const nuevosNumeros = numerosSalidos.filter(n => !oldNumeros.includes(n));
            if (nuevosNumeros && nuevosNumeros.length > 0) {
                if (speakPref) {
                    nuevosNumeros.forEach(n => speakText(n.toString()));
                }
            }
        }
    }
}

/**
 * Intentar aplicar la voz preferida enviada por el Master.
 * Si no existe exactamente, elegir la mejor voz en español disponible.
 */
function tryApplyRemoteVoice(preferredURI) {
    if (!preferredURI) return;
    // Guardamos la preferencia remota temporalmente
    preferredVoiceURI = preferredURI;

    // Asegurarnos de tener la lista de voces cargada
    if (typeof speechSynthesis !== 'undefined') {
        voices = speechSynthesis.getVoices();
        if (!voices || voices.length === 0) {
            // Esperar al evento voiceschanged
            window.speechSynthesis.onvoiceschanged = () => {
                voices = speechSynthesis.getVoices();
                _matchAndApplyVoice(preferredURI);
            };
            return;
        }
    }

    _matchAndApplyVoice(preferredURI);
}

function _matchAndApplyVoice(preferredURI) {
    // 1) Intentar match exacto por voiceURI
    let found = voices.find(v => v.voiceURI === preferredURI);

    // 2) Si no exacto, intentar match por nombre (substring)
    if (!found && preferredURI) {
        found = voices.find(v => v.name && preferredURI && v.name.toLowerCase().includes(preferredURI.toLowerCase().split('/').pop()));
    }

    // 3) Si no hay match, buscar la mejor voz en español
    if (!found) {
        const spanish = voices.filter(v => v.lang && v.lang.startsWith('es'));
        if (spanish.length > 0) {
            // Priorizar Google/Natural/Premium por nombre
            spanish.sort((a, b) => {
                const aIsBetter = /Natural|Google|Premium|Neural/i.test(a.name);
                const bIsBetter = /Natural|Google|Premium|Neural/i.test(b.name);
                if (aIsBetter && !bIsBetter) return -1;
                if (!aIsBetter && bIsBetter) return 1;
                return a.name.localeCompare(b.name);
            });
            found = spanish[0];
        }
    }

    if (found) {
        selectedVoice = found;
        preferredVoiceURI = found.voiceURI || preferredVoiceURI;
        // Actualizar UI si existe el select
        const voiceSelect = document.getElementById('voiceSelect');
        if (voiceSelect) {
            Array.from(voiceSelect.options).forEach(opt => {
                try { opt.selected = (opt.value === preferredVoiceURI); } catch (e) {}
            });
        }
        console.log('🗣️ Voz seleccionada localmente:', found.name || preferredVoiceURI);
        updateVoiceIndicator();
    } else {
        console.log('🗣️ No se encontró voz local exacta; se mantiene preferencia:', preferredURI);
    }
}

/** Actualiza el indicador visual de voz en Web3 si existe */
function updateVoiceIndicator() {
    try {
        const el = document.getElementById('voiceIndicator');
        if (!el) return;
        if (selectedVoice && selectedVoice.name) {
            el.textContent = `Voz: ${selectedVoice.name}`;
        } else if (preferredVoiceURI === 'google-premium') {
            el.textContent = 'Voz: Google Premium';
        } else if (preferredVoiceURI) {
            el.textContent = `Voz: ${preferredVoiceURI}`;
        } else {
            el.textContent = 'Voz: —';
        }
    } catch (e) {
        console.warn('updateVoiceIndicator error:', e);
    }
}

// Inicializar UI de voz en carga
function initVoiceUI() {
    try {
        if (typeof populateVoiceList === 'function') populateVoiceList();
        updateVoiceIndicator();

        const voiceSelect = document.getElementById('voiceSelect');
        if (voiceSelect) {
            voiceSelect.addEventListener('change', () => {
                try { setVoice(); } catch (e) { console.warn('setVoice error:', e); }
                updateVoiceIndicator();
            });
        }

        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.onvoiceschanged = () => {
                try { populateVoiceList(); updateVoiceIndicator(); } catch (e) { console.warn('voiceschanged handler error:', e); }
            };
        }
    } catch (e) {
        console.warn('initVoiceUI error:', e);
    }
}

/**
 * Choose the best local voice for this browser (prefer Spanish; prefer Natural/Google/Premium/Neural)
 * This is intended for Web3 viewers so they hear the best available local voice by default.
 */
function chooseBestLocalVoice() {
    try {
        if (!voices || voices.length === 0) return;

        // Prefer Spanish voices and prioritize names that look premium/natural
        let found = voices.find(v => v.lang && v.lang.startsWith('es') && /Natural|Google|Premium|Neural/i.test(v.name));
        if (!found) found = voices.find(v => v.lang && v.lang.startsWith('es'));
        if (!found) found = voices.find(v => /Natural|Google|Premium|Neural/i.test(v.name));
        if (!found) found = voices[0];

        if (found) {
            selectedVoice = found;
            preferredVoiceURI = found.voiceURI || found.name || '';
            // reflect in the select if present
            const voiceSelect = document.getElementById('voiceSelect');
            if (voiceSelect) {
                const opt = Array.from(voiceSelect.options).find(o => o.value === preferredVoiceURI || o.textContent.includes(found.name));
                if (opt) opt.selected = true;
            }
            updateVoiceIndicator();
        }
    } catch (e) {
        console.warn('chooseBestLocalVoice error:', e);
    }
}

/**
 * Toggle the compact header menu in Web3 (opens/closes the small header menu)
 */
function toggleHeaderMenu() {
    try {
        const menu = document.getElementById('headerMenu');
        const toggle = document.getElementById('headerMenuToggle');
        if (!menu || !toggle) return;
        const isOpen = menu.style.display && menu.style.display !== 'none';
        if (isOpen) {
            menu.style.display = 'none';
            menu.setAttribute('aria-hidden', 'true');
            toggle.setAttribute('aria-expanded', 'false');
            document.removeEventListener('click', _closeHeaderOnDocClick);
        } else {
            menu.style.display = 'block';
            menu.setAttribute('aria-hidden', 'false');
            toggle.setAttribute('aria-expanded', 'true');
            // Close when clicking outside
            setTimeout(() => document.addEventListener('click', _closeHeaderOnDocClick), 50);
        }
    } catch (e) { console.warn('toggleHeaderMenu error', e); }
}

function _closeHeaderOnDocClick(ev) {
    try {
        const menu = document.getElementById('headerMenu');
        const toggle = document.getElementById('headerMenuToggle');
        if (!menu || !toggle) return;
        if (ev.target && (menu.contains(ev.target) || toggle.contains(ev.target))) return;
        menu.style.display = 'none';
        menu.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', _closeHeaderOnDocClick);
    } catch (e) {}
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initVoiceUI, 0);
} else {
    document.addEventListener('DOMContentLoaded', initVoiceUI);
}

// ---- Velocidad del juego (ms) ----
let drawIntervalMs = 3500;

/// ---- Variables para Selección de Voz ----
let voices = [];
let selectedVoice = null;

// Preferencia de sonido para espectadores (Web3)
let spectatorSpeakEnabled = (localStorage.getItem('web3Speak') === 'true');

function toggleSpectatorSound() {
    spectatorSpeakEnabled = !spectatorSpeakEnabled;
    localStorage.setItem('web3Speak', spectatorSpeakEnabled ? 'true' : 'false');
    
    // Resume audio context on user gesture for iOS support
    try { initAudioContext(); } catch(e) {}

    const btn = document.getElementById('spectatorSoundToggle');
    if (btn) {
        btn.setAttribute('aria-pressed', spectatorSpeakEnabled ? 'true' : 'false');
        btn.textContent = spectatorSpeakEnabled ? 'sonido activado' : 'sonido desactivado';
    }
}

// ---- Persistencia (localStorage) ----
const STORAGE_KEY = 'bingoGameStateV1';
// Por defecto intentamos usar Google Premium (mejor TTS) salvo que el navegador/plataforma lo impida
let preferredVoiceURI = 'google-premium';

// ---- Variables para Nuevas Funcionalidades ----
let myTrackedCardNumbers = [];
let audioCtx = null;
const STATS_KEY = 'bingo_stats_counts_v1';
let bingoStats = null;

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

/**
 * Announce bingo: show banner, try Notifications API, vibrate if mobile, and play sound.
 */
function announceBingo(cartonId) {
    try {
        // 4) Tono/voz
        try {
            playBingoSoundEffect();
            speakText(`¡Bingo! Cartón ${cartonId}.`);
        } catch (e) {
            console.warn('Error announcing bingo:', e);
        }
    } catch (e) {
        console.warn('announceBingo failed:', e);
    }
}

function loadBingoStats() {
    if (bingoStats) return bingoStats;
    try {
        const raw = localStorage.getItem(STATS_KEY);
        bingoStats = raw ? JSON.parse(raw) : {};
    } catch (e) {
        bingoStats = {};
    }
    return bingoStats;
}

function saveBingoStats() {
    try {
        if (!bingoStats) return;
        localStorage.setItem(STATS_KEY, JSON.stringify(bingoStats));
    } catch (e) {}
}

function incrementBingoStat(cartonId) {
    if (!cartonId) return;
    const stats = loadBingoStats();
    const key = String(cartonId);
    stats[key] = (stats[key] || 0) + 1;
    saveBingoStats();

    const modal = document.getElementById('statsModal');
    if (modal && modal.style.display === 'block') {
        renderBingoStatsList();
    }
}

function getSortedBingoStats() {
    const stats = loadBingoStats();
    return Object.keys(stats)
        .map((k) => ({ carton: k, wins: stats[k] }))
        .sort((a, b) => b.wins - a.wins || Number(a.carton) - Number(b.carton));
}

function renderBingoStatsList() {
    const container = document.getElementById('statsList');
    if (!container) return;
    const stats = getSortedBingoStats();
    container.innerHTML = '';

    if (stats.length === 0) {
        container.textContent = 'Sin estadisticas aun.';
        return;
    }

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';

    stats.forEach((item) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '6px 10px';
        row.style.borderRadius = '8px';
        row.style.border = '1px solid var(--border-color)';
        row.style.background = 'var(--bg-secondary)';

        const label = document.createElement('span');
        label.textContent = `Carton ${item.carton}`;
        label.style.fontWeight = '600';

        const count = document.createElement('span');
        count.textContent = `${item.wins} bingo${item.wins === 1 ? '' : 's'}`;
        count.style.opacity = '0.8';

        row.appendChild(label);
        row.appendChild(count);
        list.appendChild(row);
    });

    container.appendChild(list);
}

function openStatsModal() {
    const modal = document.getElementById('statsModal');
    if (!modal) return;
    renderBingoStatsList();
    modal.style.display = 'block';
}

function closeStatsModal() {
    const modal = document.getElementById('statsModal');
    if (modal) modal.style.display = 'none';
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

    // Opción premium gratuita (Google Translate TTS)
    const googleOption = document.createElement('option');
    googleOption.textContent = '🌟 Google Premium (Voz fluida)';
    googleOption.value = 'google-premium';
    voiceSelect.appendChild(googleOption);

    // Filtrar y ordenar voces en español
    const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
    const otherVoices = voices.filter(v => !v.lang.startsWith('es'));

    // Ordenar: Naturales/Google primero
    spanishVoices.sort((a, b) => {
        const aIsBetter = /Natural|Google|Premium/i.test(a.name);
        const bIsBetter = /Natural|Google|Premium/i.test(b.name);
        if (aIsBetter && !bIsBetter) return -1;
        if (!aIsBetter && bIsBetter) return 1;
        return a.name.localeCompare(b.name);
    });

    spanishVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} ${/Natural/i.test(voice.name) ? '✨' : ''} (${voice.lang})`;
        option.value = voice.voiceURI;
        voiceSelect.appendChild(option);
    });

    // Añadir el resto al final por si acaso
    if (otherVoices.length > 0) {
        const separator = document.createElement('option');
        separator.textContent = '--- Otras Voces ---';
        separator.disabled = true;
        voiceSelect.appendChild(separator);
        otherVoices.forEach((voice) => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.value = voice.voiceURI;
            voiceSelect.appendChild(option);
        });
    }

    // Lógica de auto-selección mejorada
    if (previouslySelectedURI) {
        const optionToSelect = Array.from(voiceSelect.options).find(opt => opt.value === previouslySelectedURI);
        if (optionToSelect) {
            optionToSelect.selected = true;
            if (previouslySelectedURI === 'google-premium') {
                selectedVoice = { voiceURI: 'google-premium', name: 'Google Premium', lang: 'es-ES' };
            } else {
                selectedVoice = voices.find(voice => voice.voiceURI === previouslySelectedURI) || null;
            }
        }
    } else {
        // Preferir Google Premium por defecto incluso en iOS si está disponible
        const googlePremiumOpt = Array.from(voiceSelect.options).find(opt => opt.value === 'google-premium');
        if (googlePremiumOpt) {
            googlePremiumOpt.selected = true;
            selectedVoice = { voiceURI: 'google-premium', name: 'Google Premium', lang: 'es-ES' };
            preferredVoiceURI = 'google-premium';
        } else {
            // Fallback a la mejor voz local si Google Premium no está disponible
            chooseBestLocalVoice();
        }
    }
    // If a selectedVoice was pre-assigned (e.g., by chooseBestLocalVoice), reflect it in the select
    if (!previouslySelectedURI && selectedVoice && selectedVoice.voiceURI) {
        const opt = Array.from(voiceSelect.options).find(o => o.value === selectedVoice.voiceURI);
        if (opt) opt.selected = true;
    }

    // Actualizar indicador visual (si existe)
    updateVoiceIndicator();
}

let backgroundAudio = null;

function scheduleSpeakAt(text, whenMs) {
    if (!text) return;
    const delay = Math.max(0, (whenMs || 0) - Date.now());
    setTimeout(() => {
        try { speakText(String(text)); } catch (e) { console.warn('scheduleSpeakAt error:', e); }
    }, delay);
}

function speakText(text) {
    if (!text) return;

    if (preferredVoiceURI === 'google-premium') {
        // Cancelar audio anterior si existe
        if (backgroundAudio) {
            backgroundAudio.pause();
            backgroundAudio = null;
        }
        
        // Usar el truco de Google Translate TTS (Voz de muy alta calidad)
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=es&client=tw-ob`;
        backgroundAudio = new Audio(url);
        backgroundAudio.play().catch(e => {
            console.warn("Error con Google Premium TTS, reintentando con voz normal:", e);
            speakWithWebSpeechInternal(text);
        });
    } else {
        speakWithWebSpeechInternal(text);
    }
}

function speakWithWebSpeechInternal(text) {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        if (selectedVoice && selectedVoice.voiceURI !== 'google-premium') {
            msg.voice = selectedVoice;
            msg.lang = selectedVoice.lang;
        } else {
            msg.lang = 'es-ES';
        }
        window.speechSynthesis.speak(msg);
    }
}

function setVoice(options) {
    const silent = (options && options.silent === true);

    // Resume audio context on user gesture for iOS support
    try { initAudioContext(); } catch(e) {}

    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect || !voiceSelect.value) {
        selectedVoice = null;
        preferredVoiceURI = '';
        saveGameState();
        return;
    }
    
    preferredVoiceURI = voiceSelect.value;
    if (preferredVoiceURI === 'google-premium') {
        selectedVoice = { voiceURI: 'google-premium', name: 'Google Premium', lang: 'es-ES' };
    } else {
        selectedVoice = voices.find(voice => voice.voiceURI === preferredVoiceURI) || null;
    }
    
    // Probar la voz seleccionada solo si no es silencioso y somos el Host
    if (!silent && isMaster) {
        setTimeout(() => {
            speakText("Voz seleccionada correctamente");
        }, 150);
    }
    
    saveGameState();
    // Notificar a los espectadores la nueva preferencia de voz
    try {
        if (isMaster) {
            broadcastState();
        }
    } catch (e) {
        console.warn('No se pudo broadcastState después de setVoice:', e);
    }
    updateVoiceIndicator();
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

    // Permitir añadir incluso en marcha: verificamos estado actual
    verificarTodosLosCartones({ silent: true });
    
    actualizarMisCartonesBingoDisplay();
    inputEl.value = myTrackedCardNumbers.join(', ');
    saveGameState();

    // Notificación de guardado
    showToast("¡Guardado y Verificado!");
    
    const msgEl = document.getElementById('trackerMsg');
    if (msgEl) {
        msgEl.textContent = "✓ Guardado";
        msgEl.style.color = "#28a745";
        msgEl.style.fontSize = "0.8em";
        setTimeout(() => {
            msgEl.textContent = "";
        }, 2000);
    }

    // Después de guardar los cartones, reanudar la sincronización si estaba pausada.
    try { resumeCrossDeviceSyncAfterTracking(); } catch (e) { console.warn('No se pudo reanudar sincronización:', e); }
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


// Pausar / Reanudar sincronización cuando el usuario edita "Seguir mis Cartones"
function pauseCrossDeviceSyncForTracking() {
    if (isMaster) return; // solo tiene sentido para espectadores
    if (syncPausedByTracking) return;
    syncPausedByTracking = true;
    try {
        if (connToMaster && connToMaster.open) {
            try { connToMaster.close(); } catch (e) {}
        }
    } catch (e) {}
    try {
        if (peer && !peer.destroyed) {
            try { peer.destroy(); } catch (e) {}
        }
    } catch (e) {}
    updateP2PStatus('Pausado (Editando Cartones)', '#6c757d');
}

function resumeCrossDeviceSyncAfterTracking() {
    if (isMaster) return;
    if (!syncPausedByTracking) return;
    syncPausedByTracking = false;
    updateP2PStatus('Reanudando sincronización...', '#ffc107');
    // Reiniciar el proceso de conexión
    if (typeof initCrossDeviceSync === 'function') {
        // pequeño retardo para que UI muestre cambio
        setTimeout(() => { try { initCrossDeviceSync(); } catch (e) { console.warn(e); } }, 250);
    }
}

function attachTrackingInputHandlers() {
    const inputEl = document.getElementById('myCardNumbersInput');
    if (!inputEl) return;
    // Cuando el usuario pone el foco, pausamos la sincronización
    inputEl.addEventListener('focus', () => {
        try { pauseCrossDeviceSyncForTracking(); } catch (e) { console.warn(e); }
    });
    // No reanudamos en blur: reanudamos explícitamente cuando presionan "Seguir"
}

// Registrar handlers cuando el DOM esté listo
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', attachTrackingInputHandlers);
    // También intentar registrar inmediatamente si el elemento ya existe
    setTimeout(attachTrackingInputHandlers, 200);
}
    if (myTrackedCardNumbers.length === 0) {
        myTrackedListDiv.textContent = "---";
        return;
    }

    const container = document.createElement('div');
    container.className = 'tracked-cards-container';
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.justifyContent = 'center';
    container.style.gap = '8px';
    container.style.marginTop = '10px';

    myTrackedCardNumbers.forEach(cartonId => {
        const cartonElement = document.getElementById(`carton${cartonId}`);
        let hits = 0;
        let total = 15;
        let isBingo = cartonesConBingo.includes(cartonId);

        if (cartonElement) {
            const numerosEnCartonAttr = cartonElement.getAttribute('data-numeros');
            if (numerosEnCartonAttr) {
                const nums = numerosEnCartonAttr.split(',').map(Number);
                total = nums.length;
                hits = nums.filter(n => numerosSalidos.includes(n)).length;
            }
        }

        const pill = document.createElement('div');
        pill.className = 'tracked-card-pill';
        pill.style.padding = '5px 12px';
        pill.style.borderRadius = '20px';
        pill.style.fontSize = '0.9rem';
        pill.style.fontWeight = 'bold';
        pill.style.display = 'flex';
        pill.style.flexDirection = 'column';
        pill.style.alignItems = 'center';
        pill.style.minWidth = '60px';
        pill.style.transition = 'all 0.3s ease';

        if (isBingo) {
            pill.style.background = 'var(--bingo-success)';
            pill.style.color = 'white';
            pill.style.boxShadow = '0 0 10px rgba(40, 167, 69, 0.5)';
        } else {
            pill.style.background = 'var(--bg-secondary)';
            pill.style.color = 'var(--text-primary)';
            pill.style.border = '1px solid var(--border-color)';
        }

        const idSpan = document.createElement('span');
        idSpan.textContent = `Nº ${cartonId}`;
        idSpan.style.fontSize = '0.7rem';
        idSpan.style.opacity = '0.8';

        const progressSpan = document.createElement('span');
        progressSpan.textContent = isBingo ? "¡BINGO!" : `${hits}/${total}`;

        pill.appendChild(idSpan);
        pill.appendChild(progressSpan);
        // Make pill interactive: clicking shows the same cartón in the "verificar cartón" area
        try {
            pill.style.cursor = 'pointer';
            pill.title = `Verificar cartón ${cartonId}`;
            pill.addEventListener('click', () => {
                try {
                    const input = document.getElementById('cartonVerificar');
                    if (input) {
                        input.value = String(cartonId);
                    }
                    // Animate pill to give feedback
                    try { pill.classList.add('pulse-on-click'); } catch (e) {}
                    setTimeout(() => { try { pill.classList.remove('pulse-on-click'); } catch (e) {} }, 800);

                    // Run the verification flow which also renders the mini-card
                    verificarCarton();

                    // Focus the verification area for clarity and add highlight
                    const display = document.getElementById('cartonDisplayContainer');
                    if (display) {
                        display.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // add a brief highlight class to the container
                        try { display.classList.add('reveal-card'); } catch (e) {}
                        setTimeout(() => { try { display.classList.remove('reveal-card'); } catch (e) {} }, 900);
                    }
                } catch (e) { console.warn('Error handling tracked-pill click', e); }
            });
        } catch (e) {}
        container.appendChild(pill);
    });
    
    myTrackedListDiv.appendChild(container);
}
// ---- FIN FUNCIONES "MIS CARTONES" ----

// ---- FUNCIONES PRINCIPALES DEL JUEGO ----
/**
 * Reinicia el estado completo del juego.
 * Solo el Master tiene permiso para realizar un reinicio global.
 */
async function reiniciarJuego(options = {}) {
    const { allowNewToken = false } = options;
    lastActivityTime = Date.now(); // Resetear reloj de actividad
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
    if (typeof window !== 'undefined') try { window.cartonesConBingo = cartonesConBingo; } catch (e) {}
    // Ensure UI list for "Cartones con Bingo" is cleared immediately
    const listaBingos = document.getElementById('listaCartonesBingo');
    if (listaBingos) {
        listaBingos.innerHTML = '';
        listaBingos.textContent = 'Ningún cartón tiene bingo todavía';
    }

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
    
    // Si somos el Host Y se permite generar token (solo en carga de página), generamos un nuevo token único
    if (isMaster && allowNewToken) {
        // Liberar cualquier peer anterior
        try { releaseClaim(); } catch (e) {}
        window.location.hash = '';
        
        // Reservar un código (busca uno libre en PeerJS)
        await reserveGameCode();

        // Reclamar el código en PeerJS
        let claimed = await claimToken(gameCodeFixed);

        if (!claimed) {
            console.warn('Initial claim failed for', gameCodeFixed, '— trying reserve again');
            await reserveGameCode();
            claimed = await claimToken(gameCodeFixed);
        }

        const newToken = generateGameToken();
        // Solo actualizamos el hash en la carga inicial cuando se solicita
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
    lastActivityTime = Date.now(); // Resetear reloj de actividad
    // Resume audio context on user gesture for iOS support
    try { initAudioContext(); } catch(e) {}
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
        speakText("Empezamos");

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
    lastActivityTime = Date.now(); // Actualizar pulso de actividad
    
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
    
    // NOTE: No actualizar el hash en cada sorteo — el token base solo cambia en recarga.

    const numeroDisplay = document.getElementById('numero');
    if (numeroDisplay) numeroDisplay.textContent = numero;

    marcarNumero(numero);
    actualizarUltimosNumeros();
    const announceAt = Date.now() + AUDIO_SYNC_DELAY_MS;
    lastAnnounceIdSent = drawCounter;
    lastAnnounceNumber = numero;
    lastAnnounceAt = announceAt;
    anunciarNumero(numero, announceAt);
    verificarTodosLosCartones(); // This will now handle sound for tracked bingos
    saveGameState();
    broadcastState();
}

function anunciarNumero(numero, announceAt) {
    if (!numero) return;
    if (typeof announceAt === 'number') {
        scheduleSpeakAt(numero, announceAt);
    } else {
        speakText(numero.toString());
    }
}

function marcarNumero(numero, animate = true) {
    const circulo = document.getElementById(`numero${numero}`);
    if (circulo) circulo.classList.add('marcado');
    if (circulo && animate) {
        circulo.classList.add('highlight');
        setTimeout(() => {
            try { circulo.classList.remove('highlight'); } catch (e) {}
        }, 800);
    }
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
                // reveal animation for the displayed card
                try { card.classList.add('reveal-card'); } catch (e) {}
                setTimeout(() => { try { card.classList.remove('reveal-card'); } catch (e) {} }, 1200);
                const title = document.createElement('strong');
                title.className = 'saved-card-title';
                title.textContent = `Cartón ${numeroCarton}`;
                card.appendChild(title);
                card.appendChild(generarMiniTableroParaCarton(numerosEnCartonAttr));
                cartonDisplayContainer.appendChild(card);

                // temporary highlight the saved-card element
                try {
                    card.classList.add('highlight');
                    setTimeout(() => { try { card.classList.remove('highlight'); } catch (e) {} }, 1400);
                } catch (e) {}

                    if (numerosEnCarton.length > 0 && faltantes.length === 0) { // ¡Bingo detectado!
                    mensajeVerificacionCarton.textContent = "¡BINGO!";
                    mensajeVerificacionCarton.style.color = "green";
                    
                    // Anuncio vocal y sonoro del resultado (siempre en verificación manual)
                    playBingoSoundEffect();
                    speakText(`¡Bingo! El cartón número ${numeroCarton} tiene bingo`);
                    announceBingo(numeroCarton);
                    
                    // Agregar a la lista global de Bingos si es nuevo (lógica interna)
                    if (!cartonesConBingo.includes(numeroCarton)) {
                        cartonesConBingo.push(numeroCarton);
                        incrementBingoStat(numeroCarton);
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
        case "listo":
            // No mostrar el mensaje de 'Juego listo' en vistas que no sean Master (Web 3 espectador)
            if (typeof window !== 'undefined' && window.__IS_MASTER) {
                estadoJuegoDiv.style.display = 'block';
                estadoJuegoDiv.textContent = "ℹ️ Juego listo. ¡Presiona Empezar! ℹ️";
                estadoJuegoDiv.className = "listo";
            } else {
                // Espectadores no ven este aviso
                estadoJuegoDiv.textContent = "";
                estadoJuegoDiv.className = "";
                estadoJuegoDiv.style.display = 'none';
            }
            break;
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
    try { console.log('DEBUG: verificarTodos - numerosSalidos length=', Array.isArray(numerosSalidos)?numerosSalidos.length:'(no numerosSalidos)', 'elementosCartones=', elementosCartones.length); } catch (e) {}
    let algunBingoTrackeadoNuevo = false;

    elementosCartones.forEach(cartonElement => {
        const idCompleto = cartonElement.id;
        const match = idCompleto.match(/^carton(\d+)$/);
        if (!match || !match[1]) return;
        const numeroCarton = parseInt(match[1]);

        

        const numerosEnCartonAttr = cartonElement.getAttribute('data-numeros');
        if (numerosEnCartonAttr && numerosEnCartonAttr.trim() !== "") {
            const numerosEnCarton = numerosEnCartonAttr.split(',').map(Number).filter(n => n > 0 && !isNaN(n));
            if (numerosEnCarton.length > 0) {
                const faltantes = numerosEnCarton.filter(num => !numerosSalidos.includes(num));
                if (faltantes.length === 0) { // Bingo detected
                    // Ensure we mutate the same array instance observed by tests (window.cartonesConBingo)
                    const targetBingos = (typeof window !== 'undefined' && Array.isArray(window.cartonesConBingo)) ? window.cartonesConBingo : cartonesConBingo;
                    if (!targetBingos.includes(numeroCarton)) {
                        try { console.log('DEBUG: verificarTodos - bingo detected for', numeroCarton); } catch (e) {}
                        targetBingos.push(numeroCarton);
                        try { console.log('DEBUG: verificarTodos - pushed into targetBingos'); } catch (e) {}
                        // keep internal reference in sync
                        try { cartonesConBingo = targetBingos; } catch (e) {}
                        if (typeof window !== 'undefined') try { window.cartonesConBingo = targetBingos; } catch (e) {}

                        // Incrementamos estadísticas de este cartón
                        incrementBingoStat(numeroCarton);

                        // Si el cartón está en la lista de seguimiento, activamos sonido
                        if (myTrackedCardNumbers.includes(numeroCarton)) {
                            algunBingoTrackeadoNuevo = true;
                        }

                        // If we are master, broadcast new bingo
                        if (isMaster) {
                            broadcastState();
                        }
                    }
                }
            }
        }
    });

    if (algunBingoTrackeadoNuevo && !silent) {
        playBingoSoundEffect();
        speakText("¡Bingo detectado en uno de tus cartones!");
    }

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
        // Also persist the saved cartones (if present in DOM) so Web3 can load them
        try {
            const cartDivs = document.querySelectorAll('#cartonesContainer > div[data-numeros]');
            if (cartDivs && cartDivs.length > 0) {
                const toSave = Array.from(cartDivs).map(d => ({ id: d.id || null, numeros: d.getAttribute('data-numeros') || '' }));
                localStorage.setItem('bingo_savedCardsV1', JSON.stringify(toSave));
            }
        } catch (e) {
            console.warn('Could not persist saved cartones:', e);
        }
    } catch (e) {
        // localStorage puede fallar (modo privado / cuota / permisos)
        console.warn('No se pudo guardar el estado del juego:', e);
    }
}

function loadGameState() {
    try {
        if (typeof localStorage === 'undefined') return false;
        const raw = localStorage.getItem(STORAGE_KEY);
        try { console.log('DEBUG: loadGameState raw present=', !!raw, 'raw_preview=', String(raw).slice(0,200)); } catch (e) {}
        if (!raw) return false;

        const state = JSON.parse(raw);
        try { console.log('DEBUG: loadGameState parsed state keys=', state && Object.keys(state)); } catch (e) {}
        if (!state || typeof state !== 'object') return false;

        const salidos = Array.isArray(state.numerosSalidos) ? state.numerosSalidos : null;
        const disponibles = Array.isArray(state.numerosDisponibles) ? state.numerosDisponibles : null;
        try { console.log('DEBUG: loadGameState salidos_len=', salidos ? salidos.length : 'null', 'disponibles_len=', disponibles ? disponibles.length : 'null'); } catch (e) {}
        if (!salidos || !disponibles) return false;

        numerosSalidos = salidos.filter(n => Number.isInteger(n) && n >= 1 && n <= 90);
        numerosDisponibles = disponibles.filter(n => Number.isInteger(n) && n >= 1 && n <= 90);
        // If both saved arrays are empty, treat this as no valid saved state
        // (prevents showing "all numbers called" on a fresh/new session with empty storage)
        if (numerosSalidos.length === 0 && numerosDisponibles.length === 0) return false;
        cartonesConBingo = Array.isArray(state.cartonesConBingo)
            ? state.cartonesConBingo.filter(n => Number.isInteger(n) && n > 0)
            : [];
        if (typeof window !== 'undefined') try { window.cartonesConBingo = cartonesConBingo; } catch (e) {}
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

function applyGameStateToUI(options = {}) {
    const skipAnimations = options.skipAnimations === true;

    // Reset visual marks
    const circulos = document.querySelectorAll('#numerosContainer .numeroCirculo');
    circulos.forEach(circulo => {
        circulo.classList.remove('marcado');
        // También quitamos highlight si existiera de una animación previa
        circulo.classList.remove('highlight');
    });

    // Mark drawn numbers
    numerosSalidos.forEach((numero, index) => {
        // En Web3 / actualizaciones de estado, solo animamos el número más reciente
        // (el último de la lista) para evitar que todos los círculos parpadeen.
        const isLatest = (index === numerosSalidos.length - 1);
        const shouldAnimate = !skipAnimations && isLatest;
        marcarNumero(numero, shouldAnimate);
    });

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
            setVoice({ silent: true });
        }
    }

    actualizarUltimosNumeros();
    setDrawSpeed(drawIntervalMs, { persist: false });
    verificarTodosLosCartones({ silent: true });
    limpiarMensajeVerificacion();
    const msgCarton = document.getElementById('mensajeVerificacionCarton');
    if (msgCarton) msgCarton.textContent = '';
    actualizarEstadoJuego('listo');

    // Update saved cards if visible
    const savedCardsContainer = document.getElementById('cartonesGuardadosContainer');
    if (savedCardsContainer && !savedCardsContainer.hasAttribute('hidden')) {
        mostrarCartonesGuardados();
    }

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

// ---- iOS: Banner para activar voz (solo iPhone/iPad/iPod) ----
function createIOSActivateBannerIfNeeded() {
    try {
        const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        if (!isIOS) return;
        if (typeof window.speechSynthesis === 'undefined') return;
        if (localStorage.getItem('voiceActivatedOnIOS') === 'true') return;

        // Don't show if voice UI isn't present at all
        const voiceContainer = document.getElementById('voiceSettingsContainer') || document.body;

        const overlay = document.createElement('div');
        overlay.id = 'iosVoiceActivateBanner';
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.zIndex = '2147483647';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(0,0,0,0.35)';

        const card = document.createElement('div');
        card.style.background = 'white';
        card.style.color = '#111';
        card.style.padding = '18px 20px';
        card.style.borderRadius = '12px';
        card.style.boxShadow = '0 8px 30px rgba(0,0,0,0.25)';
        card.style.maxWidth = '92%';
        card.style.width = '420px';
        card.style.textAlign = 'center';
        card.style.fontSize = '16px';

        const title = document.createElement('div');
        title.textContent = 'Toca para activar la voz';
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';
        card.appendChild(title);

        const desc = document.createElement('div');
        desc.textContent = 'En iPhone es necesario un toque para habilitar la reproducción de voz. Toca aquí para activarla.';
        desc.style.fontSize = '14px';
        desc.style.opacity = '0.95';
        desc.style.marginBottom = '14px';
        card.appendChild(desc);

        const btn = document.createElement('button');
        btn.textContent = 'Activar voz';
        btn.style.background = 'var(--bingo-success)';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.padding = '10px 16px';
        btn.style.borderRadius = '8px';
        btn.style.fontSize = '15px';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
            try {
                activateVoiceOnIOS();
            } catch (e) { console.warn('activateVoiceOnIOS error', e); }
        });
        card.appendChild(btn);

        const small = document.createElement('div');
        small.textContent = 'Puedes cambiar la voz luego en Ajustes.';
        small.style.fontSize = '12px';
        small.style.opacity = '0.8';
        small.style.marginTop = '10px';
        card.appendChild(small);

        overlay.appendChild(card);
        document.body.appendChild(overlay);
    } catch (e) {
        console.warn('createIOSActivateBannerIfNeeded error', e);
    }
}

function activateVoiceOnIOS() {
    try {
        // Try to initialize/resume AudioContext
        try {
            if (!audioCtx) initAudioContext();
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }
        } catch (e) {}

        // Unlock HTML5 Audio pipeline (needed for Google Premium)
        try {
            const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
            silentAudio.play().catch(() => {});
        } catch (e) {}

        // Force load voices and speak a test phrase to unlock speech on iOS
        if (typeof speechSynthesis !== 'undefined') {
            // ensure voices are loaded and pick a good local voice on iOS
            const v = speechSynthesis.getVoices();
            if (!v || v.length === 0) {
                speechSynthesis.onvoiceschanged = () => {
                    try {
                        populateVoiceList();
                        chooseBestLocalVoice();
                        speakText('Voz activada');
                    } catch (e) { console.warn(e); }
                };
            } else {
                try {
                    populateVoiceList();
                    chooseBestLocalVoice();
                    speakText('Voz activada');
                } catch (e) { console.warn(e); }
            }
        }

        localStorage.setItem('voiceActivatedOnIOS', 'true');
        const el = document.getElementById('iosVoiceActivateBanner');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (e) {
        console.warn('activateVoiceOnIOS overall error', e);
    }
}

function mostrarCartonesGuardados() {
    const contenedor = document.getElementById('listaCartonesGuardados');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    // First try to read cartones present in the DOM (index.html embeds them)
    let cartonesNodeList = document.querySelectorAll('#cartonesContainer > div[data-numeros]');
    let cartonesArray = Array.from(cartonesNodeList);

    // If none in DOM (web3 on some deployments), fall back to saved cartones in localStorage
    if (cartonesArray.length === 0) {
        try {
            const raw = localStorage.getItem('bingo_savedCardsV1');
            if (raw) {
                const saved = JSON.parse(raw);
                if (Array.isArray(saved) && saved.length > 0) {
                    cartonesArray = saved.map(s => {
                        const el = document.createElement('div');
                        el.id = s.id || ('carton_saved_' + (s.id || Math.random().toString(36).slice(2,7)));
                        el.setAttribute('data-numeros', (s.numeros || '').toString());
                        return el;
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load saved cartones from localStorage:', e);
        }
    }

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
    // If container or button are missing in the DOM, create sensible defaults so the feature always works
    let targetContainer = container;
    if (!targetContainer) {
        targetContainer = document.createElement('div');
        targetContainer.id = 'cartonesGuardadosContainer';
        targetContainer.setAttribute('hidden', '');
        // Basic styling to avoid breaking layout
        targetContainer.style.position = 'relative';
        document.body.appendChild(targetContainer);
    }

    let toggleBtn = btn;
    if (!toggleBtn) {
        // Try to place near share button if available
        const shareBtn = document.getElementById('shareGameBtn');
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggleCartonesBtn';
        toggleBtn.textContent = 'Ver Cartones Guardados';
        toggleBtn.className = 'small-button';
        if (shareBtn && shareBtn.parentNode) {
            shareBtn.parentNode.insertBefore(toggleBtn, shareBtn.nextSibling);
        } else {
            document.body.insertBefore(toggleBtn, document.body.firstChild);
        }
    }

    toggleBtn.addEventListener('click', () => {
        const isHidden = targetContainer.hasAttribute('hidden');
        if (isHidden) {
            mostrarCartonesGuardados();
            targetContainer.removeAttribute('hidden');
            toggleBtn.textContent = 'Ocultar Cartones Guardados';
        } else {
            targetContainer.setAttribute('hidden', '');
            toggleBtn.textContent = 'Ver Cartones Guardados';
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
    // If no game code exists, we create one. But ideally we should use reserveGameCode() 
    // to be safer about collisions, but for a quick share, a random one works for now.
    if (!gameCodeFixed) {
        gameCodeFixed = Math.floor(Math.random() * 90) + 10; // 10-99
        console.log(`🎲 New game code generated: ${gameCodeFixed}`);
        // If we are master, we SHOULD try to claim it immediately
        if (isMaster) claimToken(gameCodeFixed);
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
        // Extract the 2-digit game code for display
        const gameCode = gameCodeFixed || '--';
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
        
        // Display 2-digit game code
        if (tokenDisplay) tokenDisplay.textContent = gameCodeFixed || '--';
        if (shareUrlDisplay) shareUrlDisplay.textContent = shareUrl;
        if (fullTokenDisplay) fullTokenDisplay.textContent = token; // Show token like "21,1,2,3"
        
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
    const statsModal = document.getElementById('statsModal');
    if (event.target == statsModal) {
        statsModal.style.display = "none";
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
        if (typeof window !== 'undefined') try { window.cartonesConBingo = cartonesConBingo; } catch (e) {}
        currentGameToken = encoded;

        applyGameStateToUI({ skipAnimations: true });
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
    const page = document.body.getAttribute('data-page');
    const isExplicitWeb3 = (typeof window !== 'undefined' && window.__IS_MASTER === false);
    
    if (page === 'web3' || isExplicitWeb3) {
        isMaster = false;
        // Inicializar estado del botón de sonido para espectadores
        try {
            const btn = document.getElementById('spectatorSoundToggle');
            if (btn) {
                const pref = (localStorage.getItem('web3Speak') === 'true');
                btn.setAttribute('aria-pressed', pref ? 'true' : 'false');
                btn.textContent = pref ? 'sonido activado' : 'sonido desactivado';
            }
        } catch (e) {}

        // Compact header: ensure header menu toggle exists and wire closing
        try {
            const toggle = document.getElementById('headerMenuToggle');
            const menu = document.getElementById('headerMenu');
            if (toggle && menu) {
                // Ensure menu is hidden initially
                menu.style.display = 'none';
                menu.setAttribute('aria-hidden', 'true');
                toggle.setAttribute('aria-expanded', 'false');
            }
        } catch (e) {}

        // Ensure we pick the best available voice locally for Web3 viewers by default
        try {
            if (typeof speechSynthesis !== 'undefined') {
                if (speechSynthesis.getVoices().length === 0) {
                    speechSynthesis.onvoiceschanged = () => {
                        populateVoiceList();
                    };
                } else {
                    populateVoiceList();
                }
            }
        } catch (e) {}

    } else {
        isMaster = true; // Por defecto Master (index.html, live_index.html, etc.)
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
                    voiceSelectElement.addEventListener('change', () => setVoice({ silent: false }));
                }
            };
        } else {
            populateVoiceList();
            const voiceSelectElement = document.getElementById('voiceSelect');
            if (voiceSelectElement) {
                voiceSelectElement.addEventListener('change', () => setVoice({ silent: false }));
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

    // Default UI - Set to 3.5 seconds as default (don't persist until after load)
    setDrawSpeed(3500, { persist: false });

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

    // prioritize hash over restored state for viewers
    const hash = window.location.hash.substring(1);
    const restored = loadGameState();

    // Persist current DOM cartones so web3 viewers can load them only if
    // there was no restored state. Previously this code ran before
    // `restored` was defined which caused an immediate overwrite of the
    // persisted STORAGE_KEY with an empty state. Save only after load.
    try { if (isMaster && !restored) saveGameState(); } catch (e) {}

    if (hash) {
        // Check if it's the numeric format (XX,num1,num2...)
        if (/^\d{2,5}(?:,\d+)*$/.test(hash)) {
            console.log("Loading numeric token from hash:", hash);
            const parts = hash.split(',');
            gameCodeFixed = parseInt(parts[0]);
            numerosSalidos = parts.slice(1).map(Number);
            numerosDisponibles = Array.from({ length: 90 }, (_, i) => i + 1).filter(n => !numerosSalidos.includes(n));
            applyGameStateToUI({ skipAnimations: true });
            if (!isMaster) {
                initCrossDeviceSync();
            } else if (gameCodeFixed) {
                claimToken(gameCodeFixed);
            }
        } else if (loadSharedGame(hash)) {
            // Shared game loaded via Base64
            if (!isMaster) {
                initCrossDeviceSync();
            } else if (gameCodeFixed) {
                claimToken(gameCodeFixed);
            }
        } else {
            reiniciarJuego({ allowNewToken: true });
        }
    } else if (restored) {
        applyGameStateToUI({ skipAnimations: true });
        if (!isMaster) {
            // Solo sincronizamos si tenemos un código válido restaurado
            if (gameCodeFixed) {
                initCrossDeviceSync();
            } else {
                updateP2PStatus("Inactivo (Sin Código)");
            }
        } else if (gameCodeFixed) {
            // Si somos el Master y tenemos un código, reclamarlo de nuevo
            claimToken(gameCodeFixed);
        }
    } else {
        // No hash, no restored state
        if (!isMaster) {
            updateP2PStatus("Inactivo");
            reiniciarJuego({ allowNewToken: true });
        } else {
            reiniciarJuego({ allowNewToken: true });
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

    // Mostrar banner de activación de voz en iPhone si hace falta
    try { createIOSActivateBannerIfNeeded(); } catch (e) { console.warn('createIOSActivateBannerIfNeeded call failed', e); }
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

// ---- Clear token on page unload: DISABLED to allow persistent connection on refresh ----
// window.addEventListener('beforeunload', () => {
//     window.location.hash = '';
//     console.log('🧹 Token cleared from address bar');
// });
