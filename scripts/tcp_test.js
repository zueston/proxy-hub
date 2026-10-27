const fs = require('fs');
const path = require('path');
const net = require('net');

const OUT = path.join(__dirname, '..', 'out');
const nodes = JSON.parse(fs.readFileSync(path.join(OUT, 'candidates.json'), 'utf8'));

const TIMEOUT = parseInt(process.env.TCP_TIMEOUT || '3000', 10);
const CONCURRENCY = parseInt(process.env.TCP_CONC || '300', 10);

function tcpTest(server, port, timeout) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const sock = new net.Socket();
    let done = false;
    const finish = ok => {
      if (done) return; done = true;
      const ms = Date.now() - t0;
      sock.destroy();
      resolve({ ok, ms });
    };
    sock.setTimeout(timeout);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    try { sock.connect(port, server); } catch (e) { finish(false); }
  });
}

(async () => {
  const results = new Array(nodes.length);
  let idx = 0, finished = 0;
  const t0 = Date.now();
  const total = nodes.length;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= total) return;
      const n = nodes[i];
      const r = await tcpTest(n.server, n.port, TIMEOUT);
      results[i] = { ...n, _tcp: r.ok, _tcp_ms: r.ms };
      finished++;
      if (finished % 500 === 0) {
        process.stderr.write(`  tcp ${finished}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const alive = results.filter(r => r._tcp);
  fs.writeFileSync(path.join(OUT, 'tcp_alive.json'), JSON.stringify(alive, null, 1));
  const byType = {};
  for (const n of alive) byType[n.type] = (byType[n.type] || 0) + 1;
  console.log(`TCP alive: ${alive.length}/${total} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(byType);
})();
