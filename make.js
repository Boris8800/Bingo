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

(async () => {
  console.log('=== Bingo project test runner ===');

  console.log('\n1) Running headless token/load validation test (tests/run_headless_test.js)');
  let res = await run('node tests/run_headless_test.js');
  if (res.err && res.err.code !== 0) {
    console.error('Headless test failed.');
    process.exit(2);
  }
  console.log('Headless test completed.');

  console.log('\n2) Running P2P simulation test (tests/run_p2p_sim.js)');
  res = await run('node tests/run_p2p_sim.js');
  if (res.err && res.err.code !== 0) {
    console.error('P2P simulation test failed.');
    process.exit(3);
  }
  console.log('P2P simulation completed.');

  console.log('\nAll checks passed. If you need browser-based WebRTC checks, run the project in two real browsers and verify PeerJS connection.');
  process.exit(0);
})();
