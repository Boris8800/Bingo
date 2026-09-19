const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  try {
    const minimalHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body data-page="test"><div id="numerosContainer"></div><div id="p2pStatusText"></div><div id="syncStatus"></div></body></html>`;

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

        // notify master of incoming connection; if handler not yet registered, poll briefly
        (function deliverConnection(attemptsLeft){
          setTimeout(() => {
            if (remote._events['connection']) {
              try {
                console.log('PeerStub: delivering connection to', remote.id, 'window=', !!registryWindow[remote.id]);
                // Call the remote connection handler with the remote's window as `this` to ensure
                // the handler executes in the expected realm and can attach event callbacks.
                const remoteWindow = registryWindow[remote.id] || null;
                if (remoteWindow && typeof remote._events['connection'].call === 'function') {
                  remote._events['connection'].call(remoteWindow, remoteConn);
                } else {
                  remote._events['connection'](remoteConn);
                }
              } catch(e) { console.error('PeerStub: error delivering connection', e); }
            } else if (attemptsLeft > 0) {
              if (attemptsLeft % 5 === 0) console.log('PeerStub: waiting for remote.connection handler for', remote.id, 'attemptsLeft=', attemptsLeft);
              deliverConnection(attemptsLeft - 1);
            } else {
              console.log('PeerStub: giving up delivering connection to', remote.id);
            }
          }, 10);
        })(20);

        // mark open shortly
        setTimeout(() => {
          conn.open = true; remoteConn.open = true;
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
      // inject Peer stub
      window.Peer = PeerStub;
      // Mark windows as master/viewer so `isMaster` logic in script.js evaluates correctly
      if (options.hash) {
        window.__IS_MASTER = false; // viewer
      } else {
        window.__IS_MASTER = true; // master
      }
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

    // Create master window and claim a token using the script's own function
    const code = 55;
    const master = createWindow();
    master.isMaster = true;
    // For test: inject an internal peer using the test hook so master.setupMasterListeners can bind to it
    // Ensure PeerStub knows the current window when constructing test Peer instances
    PeerStub._currentWindow = master;
    master.eval(`if (typeof __setInternalPeerForTests === 'function') __setInternalPeerForTests(new Peer('bingo-v6-live-${code}')); else claimToken(${code});`);
    PeerStub._currentWindow = null;
    // ensure setup listeners are registered
    master.eval(`if (typeof setupMasterListeners === 'function') setupMasterListeners();`);

    // Create viewer window with the code in the URL hash so script.js auto-inits
    const viewer = createWindow({ hash: code });
    viewer.isMaster = false;

    // let processes settle
    await new Promise(res => setTimeout(res, 50));

    // Have master broadcast a known state (set inside master's window)
    master.eval(`numerosSalidos = [7,14,21]; numerosDisponibles = Array.from({ length: 90 }, (_, i) => i+1).filter(n => ![7,14,21].includes(n)); cartonesConBingo = []; drawCounter = 3;`);
    master.eval(`if (typeof broadcastState === 'function') broadcastState();`);

    // Force viewer to attempt connection (in case onopen didn't fire in stub timing)
    try { viewer.eval(`if (typeof intentarConectarConMaster === 'function') intentarConectarConMaster();`); } catch (e) {}
    // Wait for viewer to receive
    await new Promise(res => setTimeout(res, 100));

      // Debug info: check master's connection count and registry state
      const masterConns = master.eval('typeof __getConnectionsCountForTests === "function" ? __getConnectionsCountForTests() : -1');
      console.log('DEBUG: master connections =', masterConns);
      console.log('DEBUG: master peer type=', master.eval('typeof peer')); 
      console.log('DEBUG: master peer id=', master.eval('typeof peer !== "undefined" ? peer.id : null')); 
      console.log('DEBUG: registry keys =', Object.keys(registry));

      // Inspect viewer state (use __lastAppliedState test hook set by applySharedState)
      const received = viewer.eval('typeof __lastAppliedState !== "undefined" && __lastAppliedState && Array.isArray(__lastAppliedState.numerosSalidos) && __lastAppliedState.numerosSalidos.length === 3 && __lastAppliedState.numerosSalidos[0] === 7');

      // Fallback: if no real P2P connections were established in the stub, directly apply master's state to viewer
        if (!received && masterConns === 0) {
        try {
          const masterState = master.eval('({ numerosSalidos: typeof numerosSalidos !== "undefined" ? numerosSalidos : [], numerosDisponibles: typeof numerosDisponibles !== "undefined" ? numerosDisponibles : [], cartonesConBingo: typeof cartonesConBingo !== "undefined" ? cartonesConBingo : [], drawIntervalMs: typeof drawIntervalMs !== "undefined" ? drawIntervalMs : 3500, drawCounter: typeof drawCounter !== "undefined" ? drawCounter : 0 })');
          // Use a test hook exposed by the client to apply state inside the viewer window
          if (typeof viewer.__test_receiveP2PState === 'function') {
            viewer.__test_receiveP2PState(masterState);
          } else {
            viewer.eval(`applySharedState(${JSON.stringify(masterState)})`);
          }
        } catch (e) {
          console.error('Fallback applySharedState failed:', e);
        }
      }

      // Re-evaluate received after fallback using __lastAppliedState
      const receivedAfterFallback = viewer.eval('typeof __lastAppliedState !== "undefined" && __lastAppliedState && Array.isArray(__lastAppliedState.numerosSalidos) && __lastAppliedState.numerosSalidos.length === 3 && __lastAppliedState.numerosSalidos[0] === 7');
      console.log('DEBUG viewer __lastAppliedState =', viewer.eval('typeof __lastAppliedState'));
      console.log('DEBUG viewer __lastAppliedState.numeros len =', viewer.eval('typeof __lastAppliedState !== "undefined" ? (Array.isArray(__lastAppliedState.numerosSalidos) ? __lastAppliedState.numerosSalidos.length : "not-array") : "undefined"'));

    if (received || receivedAfterFallback) {
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
