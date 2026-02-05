const { exec } = require('child_process');
const path = require('path');

function run(cmd) {
  return new Promise((resolve) => {
    const p = exec(cmd, { cwd: path.resolve(__dirname) }, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
    p.stdout && p.stdout.pipe(process.stdout);
    p.stderr && p.stderr.pipe(process.stderr);
  });
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    headless: args.has('--headless'),
    p2p: args.has('--p2p'),
    help: args.has('--help') || args.has('-h'),
  };
}

function showHelp() {
  console.log('=== Bingo project test runner ===');
  console.log('Usage: node make.js [--headless] [--p2p]');
  console.log('');
  console.log('Options:');
  console.log('  --headless  Run only the headless token/load test');
  console.log('  --p2p       Run only the P2P simulation test');
}

(async () => {
  const args = parseArgs();
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const runHeadless = args.headless || (!args.headless && !args.p2p);
  const runP2P = args.p2p || (!args.headless && !args.p2p);

  console.log('=== Bingo project test runner ===');
  const results = [];
  const startAll = Date.now();

  if (runHeadless) {
    console.log('\n1) Running headless token/load validation test (tests/run_headless_test.js)');
    const t0 = Date.now();
    const res = await run('node tests/run_headless_test.js');
    const ok = !(res.err && res.err.code !== 0);
    results.push({ name: 'headless', ok, ms: Date.now() - t0, code: 2 });
    if (!ok) {
      console.error('Headless test failed.');
      process.exit(2);
    }
    console.log('Headless test completed.');
  }

  // Additional verification test for cartones logic
  if (runHeadless) {
    console.log('\n1.5) Running cartones verification test (tests/run_verify_cartones_test.js)');
    const t05 = Date.now();
    const res05 = await run('node tests/run_verify_cartones_test.js');
    const ok05 = !(res05.err && res05.err.code !== 0);
    results.push({ name: 'verify-cartones', ok: ok05, ms: Date.now() - t05, code: 25 });
    if (!ok05) {
      console.error('Cartones verification test failed.');
      process.exit(25);
    }
    console.log('Cartones verification test completed.');
  }

  if (runP2P) {
    console.log('\n2) Running P2P simulation test (tests/run_p2p_sim.js)');
    const t0 = Date.now();
    const res = await run('node tests/run_p2p_sim.js');
    const ok = !(res.err && res.err.code !== 0);
    results.push({ name: 'p2p', ok, ms: Date.now() - t0, code: 3 });
    if (!ok) {
      console.error('P2P simulation test failed.');
      process.exit(3);
    }
    console.log('P2P simulation completed.');
  }

  const totalMs = Date.now() - startAll;
  const summary = results.map(r => `${r.name}: ${r.ok ? 'ok' : 'fail'} (${r.ms}ms)`).join(' | ');
  console.log(`\nSummary: ${summary}`);
  console.log(`Total: ${totalMs}ms`);
  console.log('\nAll checks passed. If you need browser-based WebRTC checks, run the project in two real browsers and verify PeerJS connection.');
  process.exit(0);
})();
