const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const BIN = process.env.MIHOMO_BIN || path.join(ROOT, 'bin', 'mihomo.exe');

const CTRL_PORT = 9099;
const TEST_URL = process.env.TEST_URL || 'http://www.gstatic.com/generate_204';
const DELAY_TIMEOUT = parseInt(process.env.DELAY_TIMEOUT || '5000', 10);
const CONCURRENCY = parseInt(process.env.CONC || '60', 10);

const SUPPORTED = new Set(['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'anytls', 'http', 'socks5']);

// 递归清除字符串中的控制字符（YAML 不允许），保留 \t
function clean(v) {
  if (typeof v === 'string') {
    return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = clean(v[k]);
    return o;
  }
  return v;
}

const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
function hasCtrl(v) {
  if (typeof v === 'string') return CTRL_RE.test(v);
  if (Array.isArray(v)) return v.some(hasCtrl);
  if (v && typeof v === 'object') return Object.keys(v).some(k => hasCtrl(v[k]));
  return false;
}

// 解析产物里的坏值：字符串 "null"/"undefined"/空/含替换字符 U+FFFD
function badStr(s) {
  return typeof s !== 'string' || s === '' || s === 'null' || s === 'undefined' || s.includes('\uFFFD');
}

// mihomo 支持的 ss method 白名单
const SS_METHODS = new Set([
  'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm',
  'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb',
  'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr',
  'rc4-md5', 'chacha20', 'chacha20-ietf', 'xchacha20',
  'chacha20-ietf-poly1305', 'xchacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305',
  'none', 'dummy',
]);

function sanitize(n, i) {
  // 生成合法节点名，保留原始信息用于最终输出
  if (hasCtrl(n)) return null; // 解析产物乱码，直接丢弃
  if (badStr(n.server)) return null;
  const p = { ...n };
  delete p._src; delete p._tcp; delete p._tcp_ms;
  p.name = `N${String(i).padStart(5, '0')}`;
  // 移除 mihomo 不认的字段
  for (const k of Object.keys(p)) if (k.startsWith('_')) delete p[k];
  if (p.type === 'hysteria') return null; // v1 hysteria 需特殊字段，跳过
  if (!SUPPORTED.has(p.type)) return null;
  // reality 缺 pbk 的丢弃
  if (p['reality-opts']) {
    if (badStr(p['reality-opts']['public-key'])) return null;
    if (!p['reality-opts']['short-id']) p['reality-opts']['short-id'] = '';
  }
  // 各协议必备字段
  if (p.type === 'ss') {
    if (badStr(p.cipher) || badStr(p.password)) return null;
    if (!SS_METHODS.has(p.cipher)) return null;
  }
  if (p.type === 'ssr') {
    if (badStr(p.cipher) || badStr(p.password) || badStr(p.protocol)) return null;
  }
  if (p.type === 'vmess' && badStr(p.uuid)) return null;
  if (p.type === 'vless' && badStr(p.uuid)) return null;
  if (p.type === 'trojan' && badStr(p.password)) return null;
  if (p.type === 'hysteria2' && badStr(p.password)) return null;
  if (p.type === 'tuic' && badStr(p.uuid)) return null;
  // vless flow 白名单（mihomo 只认 xtls-rprx-vision）
  if (p.type === 'vless' && p.flow !== undefined) {
    if (!['', 'xtls-rprx-vision'].includes(String(p.flow))) delete p.flow;
  }
  // tls 相关字符串字段
  if (p.servername !== undefined && badStr(p.servername)) delete p.servername;
  if (p.sni !== undefined && badStr(p.sni)) delete p.sni;
  if (p['client-fingerprint'] !== undefined && badStr(p['client-fingerprint'])) delete p['client-fingerprint'];
  return p;
}

function genConfig(proxies) {
  const names = proxies.map(p => p.name);
  const cfg = {
    'mixed-port': 7899,
    'allow-lan': false,
    mode: 'global',
    'log-level': 'warning',
    'external-controller': `127.0.0.1:${CTRL_PORT}`,
    secret: '',
    'unified-delay': true,
    'tcp-concurrent': true,
    proxies,
    'proxy-groups': [{ name: 'PROXY', type: 'select', proxies: names }],
    rules: ['MATCH,PROXY'],
  };
  // 极简 YAML 输出（JSON 是合法 YAML）
  return JSON.stringify(cfg, null, 1);
}

function apiGet(p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: CTRL_PORT, path: p, method: 'GET', timeout: DELAY_TIMEOUT + 3000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const alive = JSON.parse(fs.readFileSync(path.join(OUT, 'validated.json'), 'utf8'));
  console.log(`input tcp-alive: ${alive.length}`);

  const proxies = [];
  const map = [];
  let i = 0;
  for (const n of alive) {
    const p = sanitize(n, i++);
    if (!p) continue;
    proxies.push(p);
    map.push(n);
  }
  console.log(`prepared proxies: ${proxies.length}`);

  const cfgPath = path.join(OUT, 'test_config.yaml');
  fs.writeFileSync(cfgPath, genConfig(proxies));

  const dir = path.join(OUT, 'mihomo_home');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.yaml'), genConfig(proxies));

  const proc = spawn(BIN, ['-d', dir, '-f', path.join(dir, 'config.yaml')], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', d => log += d.toString());
  proc.stderr.on('data', d => log += d.toString());
  let exited = false;
  proc.on('exit', c => { exited = true; if (c !== 0) { console.log(`[mihomo exited code=${c}]`); console.log(log.slice(-2000)); } });

  // 等待启动
  let up = false;
  for (let t = 0; t < 240; t++) {
    if (exited) break;
    await sleep(500);
    try {
      const r = await apiGet('/version');
      if (r.status === 200) { up = true; break; }
    } catch (e) { }
  }
  if (!up) {
    console.log('mihomo failed to start. log tail:');
    console.log(log.slice(-3000));
    try { proc.kill(); } catch (e) { }
    process.exit(1);
  }
  console.log('mihomo up:', (await apiGet('/version')).body);

  // 并发测延迟
  const results = new Array(proxies.length).fill(null);
  let idx = 0, done = 0;
  const t0 = Date.now();

  async function worker() {
    while (true) {
      const k = idx++;
      if (k >= proxies.length) return;
      const name = proxies[k].name;
      try {
        const r = await apiGet(`/proxies/${encodeURIComponent(name)}/delay?timeout=${DELAY_TIMEOUT}&url=${encodeURIComponent(TEST_URL)}`);
        if (r.status === 200) {
          const j = JSON.parse(r.body);
          if (j.delay && j.delay > 0) results[k] = j.delay;
        }
      } catch (e) { }
      done++;
      if (done % 100 === 0) process.stderr.write(`  delay ${done}/${proxies.length} alive=${results.filter(Boolean).length} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const ok = [];
  for (let k = 0; k < proxies.length; k++) {
    if (results[k]) ok.push({ ...map[k], _delay: results[k], _tested: TEST_URL });
  }
  ok.sort((a, b) => a._delay - b._delay);
  fs.writeFileSync(path.join(OUT, 'working.json'), JSON.stringify(ok, null, 1));

  const byType = {};
  for (const n of ok) byType[n.type] = (byType[n.type] || 0) + 1;
  console.log(`\n=== REAL WORKING: ${ok.length}/${proxies.length} (${((Date.now() - t0) / 1000).toFixed(0)}s) ===`);
  console.log(byType);
  console.log('fastest 15:');
  for (const n of ok.slice(0, 15)) console.log(`  ${String(n._delay).padStart(5)}ms  ${n.type.padEnd(9)} ${n.name.slice(0, 40)}`);

  proc.kill('SIGKILL');
  await sleep(500);
  process.exit(0);
})();
