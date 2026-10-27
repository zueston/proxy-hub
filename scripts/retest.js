const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const BIN = process.env.MIHOMO_BIN || path.join(ROOT, 'bin', 'mihomo.exe');

const CTRL_PORT = 9098;
const URLS = (process.env.TEST_URLS || 'http://cp.cloudflare.com/generate_204,http://www.gstatic.com/generate_204,http://connectivitycheck.platform.hicloud.com/generate_204').split(',');
const DELAY_TIMEOUT = parseInt(process.env.DELAY_TIMEOUT || '10000', 10);
const CONCURRENCY = parseInt(process.env.CONC || '80', 10);
const ONLY_TYPES = process.env.ONLY_TYPES ? new Set(process.env.ONLY_TYPES.split(',')) : null;

function sanitize(n, i) {
  const p = { ...n };
  delete p._src; delete p._tcp; delete p._tcp_ms; delete p._delay; delete p._tested;
  p.name = `R${String(i).padStart(5, '0')}`;
  if (p.type === 'hysteria') return null;
  if (p['reality-opts'] && !p['reality-opts']['public-key']) return null;
  if (p.type === 'vless' && p['reality-opts'] && !p['reality-opts']['short-id']) p['reality-opts']['short-id'] = '';
  if (p.type === 'ss' && !p.cipher) return null;
  if ((p.type === 'vmess' || p.type === 'vless') && !p.uuid) return null;
  if (p.type === 'trojan' && !p.password) return null;
  return p;
}

function genConfig(proxies) {
  return JSON.stringify({
    'mixed-port': 7898, 'allow-lan': false, mode: 'global', 'log-level': 'warning',
    'external-controller': `127.0.0.1:${CTRL_PORT}`, secret: '', 'unified-delay': true, 'tcp-concurrent': true,
    proxies, 'proxy-groups': [{ name: 'PROXY', type: 'select', proxies: proxies.map(p => p.name) }],
    rules: ['MATCH,PROXY'],
  }, null, 1);
}

function apiGet(p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: CTRL_PORT, path: p, method: 'GET', timeout: DELAY_TIMEOUT + 5000 }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const working = JSON.parse(fs.readFileSync(path.join(OUT, 'working.json'), 'utf8'));
  const tcp = JSON.parse(fs.readFileSync(path.join(OUT, 'tcp_alive.json'), 'utf8'));
  const wt = new Set(working.map(n => n.type + ':' + n.server + ':' + n.port));
  let rest = tcp.filter(n => !wt.has(n.type + ':' + n.server + ':' + n.port));
  if (ONLY_TYPES) rest = rest.filter(n => ONLY_TYPES.has(n.type));
  console.log(`retest pool: ${rest.length}`);

  const proxies = []; const map = []; let i = 0;
  for (const n of rest) { const p = sanitize(n, i++); if (!p) continue; proxies.push(p); map.push(n); }
  console.log(`prepared: ${proxies.length}`);

  const dir = path.join(OUT, 'mihomo_home2');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.yaml'), genConfig(proxies));

  const proc = spawn(BIN, ['-d', dir, '-f', path.join(dir, 'config.yaml')], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', d => log += d); proc.stderr.on('data', d => log += d);
  proc.on('exit', c => console.log(`[mihomo exit ${c}]`));

  let up = false;
  for (let t = 0; t < 40; t++) { await sleep(500); try { const r = await apiGet('/version'); if (r.status === 200) { up = true; break; } } catch (e) { } }
  if (!up) { console.log('start failed:', log.slice(-2000)); proc.kill(); process.exit(1); }
  console.log('mihomo up');

  const results = new Array(proxies.length).fill(null);
  let idx = 0, done = 0; const t0 = Date.now();
  async function worker() {
    while (true) {
      const k = idx++; if (k >= proxies.length) return;
      const name = proxies[k].name;
      for (const url of URLS) {
        try {
          const r = await apiGet(`/proxies/${encodeURIComponent(name)}/delay?timeout=${DELAY_TIMEOUT}&url=${encodeURIComponent(url)}`);
          if (r.status === 200) { const j = JSON.parse(r.body); if (j.delay > 0) { results[k] = { delay: j.delay, url }; break; } }
        } catch (e) { }
      }
      done++;
      if (done % 100 === 0) process.stderr.write(`  ${done}/${proxies.length} ok=${results.filter(Boolean).length} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const ok = [];
  for (let k = 0; k < proxies.length; k++) if (results[k]) ok.push({ ...map[k], _delay: results[k].delay, _tested: results[k].url });
  const byType = {}; for (const n of ok) byType[n.type] = (byType[n.type] || 0) + 1;
  console.log(`\n=== RETEST OK: ${ok.length}/${proxies.length} (${((Date.now() - t0) / 1000).toFixed(0)}s) ===`);
  console.log(byType);
  for (const n of ok.slice(0, 20)) console.log(`  ${String(n._delay).padStart(6)}ms ${n.type.padEnd(9)} ${String(n.name).slice(0, 45)}`);

  // 合并
  const merged = [...working, ...ok];
  merged.sort((a, b) => a._delay - b._delay);
  fs.writeFileSync(path.join(OUT, 'working.json'), JSON.stringify(merged, null, 1));
  fs.writeFileSync(path.join(OUT, 'retest_ok.json'), JSON.stringify(ok, null, 1));
  console.log(`merged total: ${merged.length}`);

  proc.kill('SIGKILL'); await sleep(500); process.exit(0);
})();
