const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  try {
    const minimalHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body data-page="test">
      <div id="numerosContainer"></div>
      <select id="voiceSelect"></select>
      <div id="cartonesContainer"></div>
      <div id="listaCartonesBingo"></div>
    </body></html>`;

    const dom = new JSDOM(minimalHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
    const { window } = dom;

    // Minimal Peer stub (compatible with functions used in script.js)
    window.Peer = function(id){
      this.id = id;
      this.options = {};
      this._events = {};
      this.destroyed = false;
    };
    window.Peer.prototype.on = function(event, cb){
      this._events[event] = cb;
      if (event === 'open') setTimeout(() => { try { cb(this.id || 'stub-id'); } catch(e){} }, 0);
    };
    window.Peer.prototype.connect = function(peerId){
      const conn = {
        peer: peerId,
        open: true,
        _events: {},
        send: function(){},
        close: function(){ this.open = false; },
        on: function(ev, cb){ this._events[ev] = cb; if (ev === 'open') setTimeout(() => { try { cb(); } catch(e){} }, 0); }
      };
      return conn;
    };
    window.Peer.prototype.reconnect = function(){};
    window.Peer.prototype.destroy = function(){ this.destroyed = true; };

    // Prepare persisted game state so the script loads the numbers into its lexical scope
    const savedState = {
      numerosSalidos: Array.from({ length: 15 }, (_, i) => i + 1),
      numerosDisponibles: Array.from({ length: 90 }, (_, i) => i + 1).filter(n => n > 15),
      cartonesConBingo: [],
      myTrackedCardNumbers: [],
      preferredVoiceURI: '',
      drawIntervalMs: 3500,
      currentGameToken: null,
      gameCodeFixed: null,
      drawCounter: 0,
      updatedAt: Date.now()
    };
    window.localStorage.setItem('bingoGameStateV1', JSON.stringify(savedState));

    const scriptPath = path.join(__dirname, '..', 'js', 'script.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    window.eval(scriptContent);

    // Wait for init and loadGameState
    await new Promise(r => setTimeout(r, 200));
    // Create two cartones: 16 (all numbers drawn) and 17 (missing numbers)
    const container = window.document.getElementById('cartonesContainer');
    const c16 = window.document.createElement('div');
    c16.id = 'carton16';
    c16.setAttribute('data-numeros', '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15');
    container.appendChild(c16);

    const c17 = window.document.createElement('div');
    c17.id = 'carton17';
    c17.setAttribute('data-numeros', '1,2,3,4,5,90');
    container.appendChild(c17);

    // Ensure cartonesConBingo starts empty in persisted state and in-memory
    window.localStorage.setItem('bingoGameStateV1', JSON.stringify(Object.assign(savedState, { cartonesConBingo: [] })));
    try { window.eval('cartonesConBingo = [];'); } catch (e) { /* best-effort */ }

    // Call verification (with debug)
    if (typeof window.verificarTodosLosCartones !== 'function') throw new Error('verificarTodosLosCartones not found');
    // Dump cartones present
    const elems = Array.from(window.document.querySelectorAll('#cartonesContainer > div'));
    console.log('DEBUG: cartones found in DOM:', elems.map(e => e.id));
    const sel = window.document.querySelectorAll('#cartonesContainer > div[id^="carton"]');
    // console.log('DEBUG: selector #cartonesContainer > div[id^="carton"] length=', sel.length);
    // Instrument Array.prototype.push to detect pushes
    const _origPush = Array.prototype.push;
    // Array.prototype.push = function(...a) { try { console.log('DEBUG: Array.push called on', this === window.cartonesConBingo ? 'cartonesConBingo' : this, 'args=', a); } catch(e){}; return _origPush.apply(this, a); };
    window.verificarTodosLosCartones({ silent: true });
    // restore push
    Array.prototype.push = _origPush;

    // Debug: inspect which cartones were evaluated
    const currentNumeros = savedState.numerosSalidos;
    elems.forEach(cartonElement => {
      const id = cartonElement.id;
      const nums = cartonElement.getAttribute('data-numeros');
      const arr = nums.split(',').map(Number).filter(n => !isNaN(n));
      const faltantes = arr.filter(n => !currentNumeros.includes(n));
      console.log(`DEBUG: ${id} nums=${nums} faltantes=${faltantes}`);
    });

    // Give it a tick
    await new Promise(r => setTimeout(r, 50));

    const result = {
      cartonesConBingo: Array.isArray(window.cartonesConBingo) ? window.cartonesConBingo.slice().sort((a,b)=>a-b) : null
    };

    // Expect only carton16 to be included
    if (!Array.isArray(result.cartonesConBingo) || result.cartonesConBingo.length !== 1 || result.cartonesConBingo[0] !== 16) {
      console.error('Verify cartones test failed:', JSON.stringify(result));
      process.exit(2);
    }

    console.log('Verify cartones test passed.');
    process.exit(0);
  } catch (e) {
    console.error('Verify cartones test error:', e);
    process.exit(2);
  }
})();
