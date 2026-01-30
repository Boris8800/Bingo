const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const games = {}; // token -> { state: gameState, clients: [ws] }

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, token, state } = data;

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