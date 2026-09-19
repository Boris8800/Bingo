const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const games = {}; // token -> { state: gameState, clients: [ws] }
const presence = new Map(); // sessionId -> { sessionId, playerName, trackedCards, gameCode, page, updatedAt }

function buildPresenceSnapshot() {
    return Array.from(presence.values())
        .map((player) => ({
            sessionId: player.sessionId,
            playerName: player.playerName || '',
            trackedCards: Array.isArray(player.trackedCards) ? player.trackedCards : [],
            gameCode: player.gameCode || null,
            page: player.page || null,
            updatedAt: player.updatedAt || Date.now(),
        }))
        .sort((a, b) => String(a.playerName).localeCompare(String(b.playerName), 'es'));
}

function broadcastPresenceSnapshot() {
    const payload = JSON.stringify({ type: 'presence-snapshot', players: buildPresenceSnapshot() });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client._presenceSubscribed) {
            client.send(payload);
        }
    });
}

function upsertPresence(data, ws) {
    if (!data || !data.sessionId) return;
    const normalized = {
        sessionId: String(data.sessionId),
        playerName: typeof data.playerName === 'string' ? data.playerName.trim() : '',
        trackedCards: Array.isArray(data.trackedCards)
            ? data.trackedCards.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
            : [],
        gameCode: data.gameCode == null ? null : String(data.gameCode),
        page: typeof data.page === 'string' ? data.page : null,
        updatedAt: Date.now(),
    };

    presence.set(normalized.sessionId, normalized);
    if (ws) ws._presenceSessionId = normalized.sessionId;
    broadcastPresenceSnapshot();
}

function removePresence(sessionId) {
    if (!sessionId) return;
    presence.delete(String(sessionId));
    broadcastPresenceSnapshot();
}

setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [sessionId, player] of presence.entries()) {
        if (!player.updatedAt || now - player.updatedAt > 15000) {
            presence.delete(sessionId);
            changed = true;
        }
    }
    if (changed) broadcastPresenceSnapshot();
}, 5000).unref();

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, token, state } = data;

            if (type === 'presence-subscribe') {
                ws._presenceSubscribed = true;
                ws.send(JSON.stringify({ type: 'presence-snapshot', players: buildPresenceSnapshot() }));
                return;
            }

            if (type === 'presence-upsert' || type === 'presence-heartbeat') {
                upsertPresence(data, ws);
                return;
            }

            if (type === 'presence-remove') {
                removePresence(data.sessionId || ws._presenceSessionId);
                return;
            }

            if (type === 'join') {
                if (!games[token]) {
                    games[token] = { state: null, clients: [] };
                }
                games[token].clients.push(ws);
                if (games[token].state) {
                    ws.send(JSON.stringify({ type: 'update', state: games[token].state }));
                }
            } else if (type === 'update') {
                if (games[token]) {
                    games[token].state = state;
                    // Broadcast to all clients in the game except sender
                    games[token].clients.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'update', state }));
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Invalid message', e);
        }
    });

    ws.on('close', () => {
        removePresence(ws._presenceSessionId);

        // Remove from games
        for (const token in games) {
            games[token].clients = games[token].clients.filter(client => client !== ws);
            if (games[token].clients.length === 0) {
                delete games[token];
            }
        }
    });
});

console.log('WebSocket server running on ws://localhost:8080');