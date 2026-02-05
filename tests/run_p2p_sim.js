const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  try {
    const minimalHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body data-page="test"><div id="numerosContainer"></div><div id="p2pStatusText"></div><div id="syncStatus"></div></body></html>`;

    // Shared Peer registry and stub implementation so two windows can talk
    const registry = {};
    function PeerStub(id) {
      this.id = id || `peer-${Math.random().toString(36).slice(2,8)}`;
      this._events = {};
      this.destroyed = false;
      registry[this.id] = this;
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

        // notify master of incoming connection
        setTimeout(() => {
          if (remote._events['connection']) {
            try { remote._events['connection'](remoteConn); } catch(e){}
          }
        }, 0);

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
    function createWindow() {
      const dom = new JSDOM(minimalHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
      const { window } = dom;
      // inject Peer stub
      window.Peer = PeerStub;
      // make a minimal setTimeout / console available
      window.console = console;
      const scriptPath = path.join(__dirname, '..', 'js', 'script.js');
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      // Evaluate the main script in the window
      window.eval(scriptContent);
      return window;
    }

    // Create master window and claim a token
    const master = createWindow();
    // ensure master context treats as Master
    master.isMaster = true;
    // pick a code
    const code = 55;
    await master.claimToken(code);

    // Create viewer window
    const viewer = createWindow();
    viewer.isMaster = false;
    viewer.gameCodeFixed = code;
    // start viewer P2P logic
    viewer.initCrossDeviceSync();

    // let processes settle
    await new Promise(res => setTimeout(res, 50));

    // Have master broadcast a known state
    master.numerosSalidos = [7, 14, 21];
    master.drawCounter = 3;
    master.broadcastState();

    // Wait for viewer to receive
    await new Promise(res => setTimeout(res, 50));

    const received = viewer.numerosSalidos && viewer.numerosSalidos.length === 3 && viewer.numerosSalidos[0] === 7;

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
