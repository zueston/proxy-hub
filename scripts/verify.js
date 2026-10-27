// 端到端验证：用 mihomo 自带 delay API 直接请求被墙站点，确认节点真能翻墙
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const BIN = process.env.MIHOMO_BIN || path.join(ROOT, 'bin', 'mihomo.exe');
const CTRL_PORT = 9096;
const CONCURRENCY = parseInt(process.env.CONC || '40', 10);
const TIMEOUT = parseInt(process.env.DELAY_TIMEOUT || '8000', 10);

// 逐级验证：能过 google 的才是真能翻墙
const TARGETS = [
  { key: 'gstatic', url: 'http://www.gstatic.com/generate_204' },
  { key: 'google', url: 'https://www.google.com/generate_204' },
  { key: 'yt', url: 'https://www.youtube.com/generate_204' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function apiGet(p, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: CTRL_PORT, path: p, method: 'GET', timeout: timeoutMs || TIMEOUT + 3000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

(async () => {
  const src = JSON.parse(fs.readFileSync(path.join(OUT, 'working.json'), 'utf8'));
  console.log('candidates:', src.length);

  const proxies = src.map((n, i) => {
    const p = { ...n };
    delete p._src; delete p._tcp; delete p._tcp_ms; delete p._delay; delete p._tested;
    for (const k of Object.keys(p)) if (k.startsWith('_')) delete p[k];
    p.name = `V${String(i).padStart(4, '0')}`;
    return p;
  });

  const names = proxies.map(p => p.name);
  const cfg = {
    'mixed-port': 7898,
    'allow-lan': false,
    mode: 'global',
    'log-level': 'silent',
    'external-controller': `127.0.0.1:${CTRL_PORT}`,
    'unified-delay': true,
    'tcp-concurrent': true,
    proxies,
    'proxy-groups': [{ name: 'PROXY', type: 'select', proxies: names }],
    rules: ['MATCH,PROXY'],
  };
  const dir = path.join(OUT, 'verify_home');
  fs.mkdirSync(dir, { recursive: true });
  const cfgPath = path.join(dir, 'config.yaml');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));

  const proc = spawn(BIN, ['-d', dir, '-f', cfgPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  let exited = false;
  proc.stdout.on('data', d => log += d.toString());
  proc.stderr.on('data', d => log += d.toString());
  proc.on('exit', c => { exited = true; if (c !== 0) console.log('[mihomo exit ' + c + ']', log.slice(-800)); });

  let up = false;
  for (let t = 0; t < 240; t++) {
    if (exited) break;
    await sleep(500);
    try { if ((await apiGet('/version', 3000)).status === 200) { up = true; break; } } catch (e) { }
  }
  if (!up) { console.log('mihomo failed to start', log.slice(-1500)); process.exit(1); }
  console.log('mihomo up');

  // 结果矩阵
  const res = proxies.map(() => ({}));
  const queue = proxies.map((p, i) => i);
  let idx = 0, done = 0;
  const t0 = Date.now();

  async function worker() {
    while (true) {
      const k = idx++;
      if (k >= proxies.length) return;
      const nm = proxies[k].name;
      for (const t of TARGETS) {
        try {
          const r = await apiGet(`/proxies/${encodeURIComponent(nm)}/delay?timeout=${TIMEOUT}&url=${encodeURIComponent(t.url)}`);
          if (r.status === 200) {
            const j = JSON.parse(r.body);
            if (j.delay && j.delay > 0) res[k][t.key] = j.delay;
          }
        } catch (e) { }
        // gstatic 不通就不用测后面了
        if (t.key === 'gstatic' && !res[k].gstatic) break;
      }
      done++;
      if (done % 20 === 0) {
        const g = res.filter(r => r.google).length, y = res.filter(r => r.yt).length;
        process.stderr.write(`  verify ${done}/${proxies.length} google=${g} yt=${y} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const out = src.map((n, i) => ({ ...n, _verify: res[i] }));
  fs.writeFileSync(path.join(OUT, 'working_verified.json'), JSON.stringify(out, null, 1));

  const tier = { gstatic: 0, google: 0, yt: 0 };
  for (const r of res) {
    if (r.gstatic) tier.gstatic++;
    if (r.google) tier.google++;
    if (r.yt) tier.yt++;
  }
  console.log(`\n=== VERIFY (${((Date.now() - t0) / 1000).toFixed(0)}s) ===`);
  console.log(tier);
  const byType = {};
  src.forEach((n, i) => { if (res[i].google) byType[n.type] = (byType[n.type] || 0) + 1; });
  console.log('google-pass by type:', byType);

  try { proc.kill('SIGKILL'); } catch (e) { }
  await sleep(400);
  process.exit(0);
})();
