const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  const minimalHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body data-page="test">
      <div id="numerosContainer"></div>
      <select id="voiceSelect"></select>
      <div id="cartonesContainer"></div>
      <div id="listaCartonesBingo"></div>
    </body></html>`;
  const dom = new JSDOM(minimalHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
  const { window } = dom;
  window.Peer = function(id){ this.id=id; this._events={}; };
  window.Peer.prototype.on = function(ev, cb){ this._events[ev]=cb; if(ev==='open') setTimeout(()=>{ try{cb(this.id||'stub-id')}catch(e){} },0); };
  window.Peer.prototype.connect = function(){ return {on:()=>{}, send:()=>{}, open:true}; };
  // prepare saved state
  const savedState = { numerosSalidos: Array.from({length:15},(_,i)=>i+1), numerosDisponibles: Array.from({length:90},(_,i)=>i+1).filter(n=>n>15), cartonesConBingo: [], myTrackedCardNumbers: [], preferredVoiceURI: '', drawIntervalMs:3500, currentGameToken:null, gameCodeFixed:null, drawCounter:0, updatedAt: Date.now() };
  window.localStorage.setItem('bingoGameStateV1', JSON.stringify(savedState));
  const scriptPath = path.join(__dirname, '..', 'js', 'script.js');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  window.eval(scriptContent);
  await new Promise(r=>setTimeout(r,200));
  const container = window.document.getElementById('cartonesContainer');
  const c16 = window.document.createElement('div'); c16.id='carton16'; c16.setAttribute('data-numeros','1,2,3,4,5,6,7,8,9,10,11,12,13,14,15'); container.appendChild(c16);
  const c17 = window.document.createElement('div'); c17.id='carton17'; c17.setAttribute('data-numeros','1,2,3,4,5,90'); container.appendChild(c17);
  try { window.eval('cartonesConBingo = [];'); } catch(e){}
  if (typeof window.verificarTodosLosCartones !== 'function') { console.error('verificarTodos... missing'); process.exit(2); }
  window.verificarTodosLosCartones({ silent: true });
  await new Promise(r=>setTimeout(r,50));
  console.log('FINAL window.cartonesConBingo =', JSON.stringify(window.cartonesConBingo));
})();
