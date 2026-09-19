const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  try {
    const minimalHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body data-page="test"><div id="numerosContainer"></div><div id="p2pStatusText"></div><div id="syncStatus"></div><div id="connectedPlayersList"></div><div id="spectatorCountDisplay"></div></body></html>`;

    // Shared Peer registry and stub implementation so two windows can talk
    const registry = {};
    const registryWindow = {};
    function PeerStub(id) {
      this.id = id || `peer-${Math.random().toString(36).slice(2,8)}`;
      this._events = {};
      this.destroyed = false;
      registry[this.id] = this;
      registryWindow[this.id] = PeerStub._currentWindow || null;
      setTimeout(() => { if (this._events['open']) try { this._events['open'](this.id); } catch(e){} }, 0);
    }

    PeerStub.prototype.on = function(event, cb) { this._events[event] = cb; };
    PeerStub.prototype.reconnect = function() { /* noop */ };
    PeerStub.prototype.destroy = function() { delete registry[this.id]; this.destroyed = true; };

    PeerStub.prototype.connect = function(peerId) {
      const self = this;
      const remote = registry[peerId];
      const conn = {
        open: false,
        peer: peerId,
        _events: {},
        send(data) {
          if (conn._remote && conn._remote._events['data']) setTimeout(() => conn._remote._events['data'](data), 0);
        },
        on(evt, cb) {
          conn._events[evt] = cb;
          if (evt === 'open' && conn.open) cb();
        },
        close() {
          conn.open = false;
          if (conn._remote) conn._remote.open = false;
        }
      };

      if (remote) {
        const remoteConn = {
          open: false,
          peer: self.id,
          _events: {},
          send(data) { if (remoteConn._remote && remoteConn._remote._events['data']) setTimeout(() => remoteConn._remote._events['data'](data), 0); },
          on(evt, cb) { remoteConn._events[evt] = cb; if (evt === 'open' && remoteConn.open) cb(); }
        };
        conn._remote = remoteConn; remoteConn._remote = conn;

        // Mark both ends open before delivering the connection so the master's
        // handler can immediately send the initial state, like PeerJS does.
        setTimeout(() => {
          conn.open = true; remoteConn.open = true;
          conn._open = true; remoteConn._open = true;
          if (remote._events['connection'] && !remoteConn._delivered) {
            remoteConn._delivered = true;
            try {
              const remoteWindow = registryWindow[remote.id] || null;
              remote._events['connection'].call(remoteWindow, remoteConn);
            } catch (e) { console.error('PeerStub: error delivering open connection', e); }
          }
          if (conn._events['open']) try { conn._events['open'](); } catch(e){}
          if (remoteConn._events['open']) try { remoteConn._events['open'](); } catch(e){}
        }, 0);
      } else {
        // simulate peer-unavailable error on caller
        setTimeout(() => { if (self._events['error']) try { self._events['error']({ type: 'peer-unavailable' }); } catch(e){} }, 0);
      }

      return conn;
    };

    // Helper to create a window and load script.js with the PeerStub
    function createWindow(options = {}) {
      const url = options.hash ? `http://localhost/#${options.hash}` : 'http://localhost/';
      const dom = new JSDOM(minimalHtml, { runScripts: 'dangerously', resources: 'usable', url });
      const { window } = dom;
      window.__BINGO_TEST_MODE = true;
      window.__IS_MASTER = options.hash ? false : true;
      window.Peer = PeerStub;
      // tell the PeerStub which window is creating instances during eval
      PeerStub._currentWindow = window;
      // make a minimal setTimeout / console available
      window.console = console;
      const scriptPath = path.join(__dirname, '..', 'js', 'script.js');
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      // Evaluate the main script in the window
      window.eval(scriptContent);
      PeerStub._currentWindow = null;
      return window;
    }

    // Create master window and claim a token using the script's own function.
    const code = 55;
    const master = createWindow();
    PeerStub._currentWindow = master;
    master.eval(`gameCodeFixed = ${code}; __claimTokenForTests(${code});`);
    PeerStub._currentWindow = null;
    await new Promise(res => setTimeout(res, 20));

    // Create viewer window with the code in the URL hash so script.js auto-inits
    const viewer = createWindow({ hash: code });
    PeerStub._currentWindow = viewer;
    viewer.eval(`__setInternalPeerForTests(new Peer());`);
    PeerStub._currentWindow = null;
    viewer.eval(`__connectViewerForTests(${code});`);
    PeerStub._currentWindow = null;

    await new Promise(res => setTimeout(res, 20));

    // Force viewer to attempt connection after the replacement peer has opened.
    try { viewer.eval(`__connectToMasterForTests();`); } catch (e) {}
    // Wait for viewer to receive
    await new Promise(res => setTimeout(res, 100));

      // Verify that the viewer really connected to the master.
      console.log('DEBUG viewer sync=', viewer.eval('JSON.stringify(__getSyncStateForTests())'));
      const masterConns = master.eval('typeof __getConnectionsCountForTests === "function" ? __getConnectionsCountForTests() : -1');
      console.log('DEBUG: master connections =', masterConns);
      console.log('DEBUG: registry keys =', Object.keys(registry));
      if (masterConns < 1) throw new Error('Viewer did not register on the master');
      await new Promise(res => setTimeout(res, 50));
      const visiblePlayers = master.eval('document.getElementById("connectedPlayersList").textContent');
      if (!visiblePlayers || visiblePlayers.includes('No hay jugadores')) {
        throw new Error('Connected player list was not updated');
      }


        // Broadcast a known state only after the real connection is established.
          master.eval(`__setDrawStateForTests([7,14,21]); __broadcastStateForTests();`);
        await new Promise(res => setTimeout(res, 100));

      // Inspect viewer state (use __lastAppliedState test hook set by applySharedState)
      const received = viewer.eval('typeof __lastAppliedState !== "undefined" && __lastAppliedState && Array.isArray(__lastAppliedState.numerosSalidos) && __lastAppliedState.numerosSalidos.length === 3 && __lastAppliedState.numerosSalidos[0] === 7');

      console.log('DEBUG viewer __lastAppliedState =', viewer.eval('typeof __lastAppliedState'));
      console.log('DEBUG viewer __lastAppliedState.numeros len =', viewer.eval('typeof __lastAppliedState !== "undefined" ? (Array.isArray(__lastAppliedState.numerosSalidos) ? __lastAppliedState.numerosSalidos.length : "not-array") : "undefined"'));

    if (received) {
      console.log(JSON.stringify({ p2p: 'ok', masterId: master.peer && master.peer.id || `bingo-v6-live-${code}` }));
      process.exit(0);
    } else {
      console.error('P2P simulated test failed: viewer did not receive state');
      process.exit(2);
    }
  } catch (e) {
    console.error('run_p2p_sim.js failed:', e);
    process.exit(2);
  }
})();
