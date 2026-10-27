// 冒烟测试：用线上拉下来的 clash.yaml 起 mihomo，随机抽节点验证能否打开 Google
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const BIN = process.env.MIHOMO_BIN || path.join(ROOT, 'bin', 'mihomo.exe');
const CTRL = 9095;
const FILE = process.env.CONFIG || path.join(OUT, 'clash.yaml');
const SAMPLE = parseInt(process.env.SAMPLE || '10', 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function api(p, t) {
  return new Promise((res, rej) => {
    const rq = http.request({ host: '127.0.0.1', port: CTRL, path: p, timeout: t || 12000 }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d }));
    });
    rq.on('error', rej); rq.on('timeout', () => rq.destroy(new Error('timeout'))); rq.end();
  });
}

(async () => {
  const cfg = yaml.load(fs.readFileSync(FILE, 'utf8'));
  cfg['external-controller'] = `127.0.0.1:${CTRL}`;
  cfg['mixed-port'] = 7897;
  cfg.mode = 'global';
  cfg['log-level'] = 'silent';
  const dir = path.join(OUT, 'smoke_home');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'config.yaml');
  fs.writeFileSync(p, yaml.dump(cfg));

  const names = cfg.proxies.map(x => x.name);
  console.log('config nodes:', names.length);

  const proc = spawn(BIN, ['-d', dir, '-f', p], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', dead = false;
  proc.stdout.on('data', d => log += d); proc.stderr.on('data', d => log += d);
  proc.on('exit', c => { dead = true; if (c !== 0) console.log('[exit ' + c + ']', log.slice(-500)); });

  let up = false;
  for (let i = 0; i < 60; i++) {
    if (dead) break;
    await sleep(500);
    try { if ((await api('/version', 3000)).status === 200) { up = true; break; } } catch (e) { }
  }
  if (!up) { console.log('FAILED TO START'); console.log(log.slice(-1200)); process.exit(1); }

  const pick = names.slice().sort(() => Math.random() - 0.5).slice(0, SAMPLE);
  let ok = 0;
  for (const n of pick) {
    let r = '-';
    try {
      const q = await api(`/proxies/${encodeURIComponent(n)}/delay?timeout=8000&url=${encodeURIComponent('https://www.google.com/generate_204')}`);
      if (q.status === 200) { const j = JSON.parse(q.body); if (j.delay) { r = j.delay + 'ms'; ok++; } }
    } catch (e) { }
    console.log(`  ${r.padStart(8)}  ${n}`);
  }
  console.log(`\nSMOKE: ${ok}/${pick.length} 节点成功访问 Google`);
  try { proc.kill('SIGKILL'); } catch (e) { }
  await sleep(300);
  process.exit(ok > 0 ? 0 : 2);
})();
