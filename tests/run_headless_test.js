const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  try {
    // Build a minimal HTML shell with required elements to avoid external resource loading
    const minimalHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body data-page="test">
      <div id="numerosContainer"></div>
      <select id="voiceSelect"></select>
      <input id="speedSlider" type="range" />
      <button id="startStopBtn"></button>
      <div id="listaCartonesBingo"></div>
      <div id="estadoJuego"></div>
      <div id="cartonesContainer"></div>
      <div id="p2pDiagnostics"></div>
      <div id="p2pStatusText"></div>
      <div id="syncStatus"></div>
      <div id="tokenMessage"></div>
      <div id="myTrackedBingosList"></div>
      <div id="cartonDisplayContainer"></div>
    </body></html>`;

    const dom = new JSDOM(minimalHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
    const { window } = dom;

    // Provide a minimal Peer stub so PeerJS usage in script.js doesn't throw
    window.Peer = function(peerId){
      this.id = peerId;
      this.options = {};
      this._events = {};
      this.destroyed = false;
    };
    window.Peer.prototype.on = function(event, cb){
      this._events[event] = cb;
      // auto-trigger open shortly for stubs
      if (event === 'open') setTimeout(() => { try { cb(this.id || 'stub-id'); } catch(e){} }, 0);
    };
    window.Peer.prototype.reconnect = function(){ /* no-op stub */ };
    window.Peer.prototype.destroy = function(){ this.destroyed = true; };

    // Load the main script file and evaluate in the JSDOM window
    const scriptPath = path.join(__dirname, '..', 'js', 'script.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    window.eval(scriptContent);

    // Give a microtask delay for onload handlers to run
    await new Promise((res) => setTimeout(res, 200));

    const results = {};
    results.validateExists = typeof window.validateSharedToken === 'function';
    results.loadExists = typeof window.loadSharedGame === 'function';

    function makeSnapshot(){
      const snapshot = {
        numerosSalidos: [1,2,3,5,8,13],
        drawIntervalMs: 3500,
        myTrackedCardNumbers: [16,42],
        cartonesConBingo: [16]
      };
      return Buffer.from(JSON.stringify(snapshot)).toString('base64');
    }

    const token = makeSnapshot();
    results.validation = window.validateSharedToken(token);
    results.loadCall = window.loadSharedGame(token);
    results.invalidValidation = window.validateSharedToken('not-base64!!!');
    results.nullValidation = window.validateSharedToken(Buffer.from('null').toString('base64'));

    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Headless test failed:', e);
    process.exit(2);
  }
})();
