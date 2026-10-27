// 用 mihomo -t 逐轮剔除非法节点，直到整份配置可解析
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const BIN = process.env.MIHOMO_BIN || path.join(ROOT, 'bin', 'mihomo.exe');
const DIR = path.join(OUT, 'validate_home');
fs.mkdirSync(DIR, { recursive: true });

const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
function hasCtrl(v) {
  if (typeof v === 'string') return CTRL_RE.test(v);
  if (Array.isArray(v)) return v.some(hasCtrl);
  if (v && typeof v === 'object') return Object.keys(v).some(k => hasCtrl(v[k]));
  return false;
}
function badStr(s) {
  return typeof s !== 'string' || s === '' || s === 'null' || s === 'undefined' || s.includes('\uFFFD');
}
const SS_METHODS = new Set([
  'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm',
  'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb',
  'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr',
  'rc4-md5', 'chacha20', 'chacha20-ietf', 'xchacha20',
  'chacha20-ietf-poly1305', 'xchacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305',
  'none', 'dummy',
]);
const SUPPORTED = new Set(['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'anytls', 'http', 'socks5']);
const VLESS_FLOWS = new Set(['', 'xtls-rprx-vision']);

function sanitize(n, i) {
  if (hasCtrl(n)) return null;
  if (badStr(n.server)) return null;
  const p = { ...n };
  delete p._src; delete p._tcp; delete p._tcp_ms;
  p.name = `N${String(i).padStart(5, '0')}`;
  for (const k of Object.keys(p)) if (k.startsWith('_')) delete p[k];
  if (!SUPPORTED.has(p.type)) return null;
  if (p['reality-opts']) {
    if (badStr(p['reality-opts']['public-key'])) return null;
    if (!p['reality-opts']['short-id']) p['reality-opts']['short-id'] = '';
  }
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
  // vless flow 白名单
  if (p.type === 'vless') {
    if (p.flow === undefined || p.flow === null) delete p.flow;
    else if (!VLESS_FLOWS.has(String(p.flow))) delete p.flow;
  }
  if (p.servername !== undefined && badStr(p.servername)) delete p.servername;
  if (p.sni !== undefined && badStr(p.sni)) delete p.sni;
  if (p['client-fingerprint'] !== undefined && badStr(p['client-fingerprint'])) delete p['client-fingerprint'];
  if (p.network !== undefined && badStr(p.network)) p.network = 'tcp';
  return p;
}

function genConfig(proxies) {
  const names = proxies.map(p => p.name);
  return JSON.stringify({
    'mixed-port': 7899,
    'allow-lan': false,
    mode: 'global',
    'log-level': 'silent',
    'external-controller': '127.0.0.1:9097',
    'unified-delay': true,
    'tcp-concurrent': true,
    proxies,
    'proxy-groups': [{ name: 'PROXY', type: 'select', proxies: names }],
    rules: ['MATCH,PROXY'],
  });
}

function tryConfig(proxies) {
  const f = path.join(DIR, 'config.yaml');
  fs.writeFileSync(f, genConfig(proxies));
  try {
    execFileSync(BIN, ['-t', '-d', DIR, '-f', f], { stdio: 'pipe', timeout: 120000 });
    return { ok: true };
  } catch (e) {
    const txt = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
    return { ok: false, text: txt };
  }
}

const alive = JSON.parse(fs.readFileSync(path.join(OUT, 'tcp_alive.json'), 'utf8'));
let list = [];
for (let i = 0; i < alive.length; i++) {
  const p = sanitize(alive[i], i);
  if (p) list.push({ p, src: alive[i] });
}
console.log('after pre-sanitize:', list.length);

const dropped = [];
for (let round = 0; round < 500; round++) {
  const r = tryConfig(list.map(o => o.p));
  if (r.ok) { console.log(`OK after ${round} rounds, ${list.length} proxies`); break; }
  const m = r.text.match(/proxy (\d+):\s*([^\n"]+)/);
  if (!m) { console.log('UNPARSED ERROR:', r.text.slice(0, 800)); break; }
  const idx = parseInt(m[1], 10);
  const reason = m[2].trim();
  if (idx >= list.length) { console.log('index out of range', idx, reason); break; }
  dropped.push({ idx, reason, type: list[idx].p.type, server: list[idx].p.server });
  list.splice(idx, 1);
  if (round % 10 === 0) console.log(`round ${round}: drop #${idx} ${list[idx] ? list[idx].p.type : ''} :: ${reason.slice(0, 90)}  (left ${list.length})`);
}
console.log('dropped:', dropped.length);
const rc = {};
for (const d of dropped) rc[d.reason.slice(0, 60)] = (rc[d.reason.slice(0, 60)] || 0) + 1;
console.log(rc);

fs.writeFileSync(path.join(OUT, 'validated.json'), JSON.stringify(list.map(o => o.src), null, 1));
fs.writeFileSync(path.join(OUT, 'dropped.json'), JSON.stringify(dropped, null, 1));
console.log('wrote out/validated.json', list.length);
