const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RAW = path.join(__dirname, '..', 'raw');
const OUT = path.join(__dirname, '..', 'out');

function b64decode(s) {
  s = s.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

function isBase64ish(txt) {
  const t = txt.trim();
  if (!t || t.length < 32) return false;
  if (/^[a-z0-9+/\r\n=_-]+$/i.test(t) && !/:\s/.test(t) && !/^[a-z]+:\/\//im.test(t)) return true;
  return false;
}

// ---------- URI parsers ----------
function parseSS(u) {
  // ss://base64(method:pass)@host:port#name  OR  ss://base64(all)#name
  let body = u.slice(5);
  let tag = '';
  const h = body.indexOf('#');
  if (h >= 0) { tag = decodeURIComponent(body.slice(h + 1)); body = body.slice(0, h); }
  let q = '';
  const qi = body.indexOf('?');
  if (qi >= 0) { q = body.slice(qi + 1); body = body.slice(0, qi); }
  let method, password, host, port;
  if (body.includes('@')) {
    const at = body.lastIndexOf('@');
    let cred = body.slice(0, at);
    const hp = body.slice(at + 1);
    if (!cred.includes(':')) cred = b64decode(cred);
    const ci = cred.indexOf(':');
    method = cred.slice(0, ci); password = cred.slice(ci + 1);
    const li = hp.lastIndexOf(':');
    host = hp.slice(0, li); port = parseInt(hp.slice(li + 1));
  } else {
    const dec = b64decode(body);
    const at = dec.lastIndexOf('@');
    const cred = dec.slice(0, at); const hp = dec.slice(at + 1);
    const ci = cred.indexOf(':');
    method = cred.slice(0, ci); password = cred.slice(ci + 1);
    const li = hp.lastIndexOf(':');
    host = hp.slice(0, li); port = parseInt(hp.slice(li + 1));
  }
  if (!host || !port) return null;
  const p = { name: tag || `${host}:${port}`, type: 'ss', server: host, port, cipher: method, password, udp: true };
  return p;
}

function parseSSR(u) {
  const dec = b64decode(u.slice(6));
  const h = dec.indexOf('#');
  const tag = h >= 0 ? dec.slice(h + 1) : '';
  const main = h >= 0 ? dec.slice(0, h) : dec;
  const parts = main.split(':');
  if (parts.length < 6) return null;
  const [server, port, protocol, cipher, obfs, pwdB64] = parts;
  const password = b64decode(pwdB64);
  const tail = parts.slice(6).join(':');
  const params = {};
  if (tail) tail.split('&').forEach(kv => { const [k, v] = kv.split('='); if (k) params[k] = v ? b64decode(v) : ''; });
  return { name: tag || `${server}:${port}`, type: 'ssr', server, port: parseInt(port), cipher, password, protocol, obfs, 'protocol-param': params.protoparam || '', 'obfs-param': params.obfsparam || '', udp: true };
}

function parseVmess(u) {
  let raw = u.slice(8);
  let tag = '';
  const h = raw.indexOf('#');
  if (h >= 0) { tag = decodeURIComponent(raw.slice(h + 1)); raw = raw.slice(0, h); }
  let j;
  try { j = JSON.parse(b64decode(raw)); } catch (e) { return null; }
  const p = {
    name: tag || j.ps || `${j.add}:${j.port}`,
    type: 'vmess', server: j.add, port: parseInt(j.port),
    uuid: j.id, alterId: parseInt(j.aid || 0), cipher: j.scy || 'auto', udp: true,
  };
  const net = j.net || 'tcp';
  p.network = net;
  if (j.tls === 'tls') { p.tls = true; if (j.sni) p.servername = j.sni; if (j.host) p.servername = p.servername || j.host; }
  if (j.fp) p['client-fingerprint'] = j.fp;
  if (net === 'ws') p['ws-opts'] = { path: j.path || '/', headers: j.host ? { Host: j.host } : {} };
  else if (net === 'grpc') p['grpc-opts'] = { 'grpc-service-name': j.path || '' };
  else if (net === 'h2') { p['h2-opts'] = { path: j.path || '/', host: j.host ? [j.host] : [] }; p.tls = true; }
  else if (net === 'http') p['http-opts'] = { path: [j.path || '/'], headers: j.host ? { Host: [j.host] } : {} };
  return p;
}

function parseVless(u) {
  const url = new URL(u.replace(/^vless:\/\//, 'http://'));
  const q = url.searchParams;
  const p = {
    name: decodeURIComponent(url.hash.slice(1)) || `${url.hostname}:${url.port}`,
    type: 'vless', server: url.hostname, port: parseInt(url.port || 443),
    uuid: decodeURIComponent(url.username), udp: true,
  };
  const sec = q.get('security');
  if (sec === 'tls' || sec === 'reality') { p.tls = true; p.servername = q.get('sni') || q.get('host') || ''; }
  if (sec === 'reality') {
    p['reality-opts'] = { 'public-key': q.get('pbk') || '', 'short-id': q.get('sid') || '' };
  }
  if (q.get('fp')) p['client-fingerprint'] = q.get('fp');
  if (q.get('flow')) p.flow = q.get('flow');
  const net = q.get('type') || 'tcp';
  p.network = net;
  if (net === 'ws') p['ws-opts'] = { path: q.get('path') || '/', headers: q.get('host') ? { Host: q.get('host') } : {} };
  else if (net === 'grpc') p['grpc-opts'] = { 'grpc-service-name': q.get('serviceName') || q.get('path') || '' };
  else if (net === 'tcp' && q.get('headerType') === 'http') p['http-opts'] = { path: [q.get('path') || '/'], headers: q.get('host') ? { Host: [q.get('host')] } : {} };
  else if (net === 'h2') { p['h2-opts'] = { path: q.get('path') || '/', host: q.get('host') ? [q.get('host')] : [] }; }
  if (!p.servername) delete p.servername;
  return p;
}

function parseTrojan(u) {
  const url = new URL(u.replace(/^trojan:\/\//, 'http://'));
  const q = url.searchParams;
  const p = {
    name: decodeURIComponent(url.hash.slice(1)) || `${url.hostname}:${url.port}`,
    type: 'trojan', server: url.hostname, port: parseInt(url.port || 443),
    password: decodeURIComponent(url.username), udp: true, sni: q.get('sni') || q.get('peer') || '',
  };
  if (q.get('allowInsecure') === '1') p['skip-cert-verify'] = true;
  if (q.get('fp')) p['client-fingerprint'] = q.get('fp');
  const net = q.get('type') || 'tcp';
  if (net === 'ws') p.network = 'ws', p['ws-opts'] = { path: q.get('path') || '/', headers: q.get('host') ? { Host: q.get('host') } : {} };
  else if (net === 'grpc') p.network = 'grpc', p['grpc-opts'] = { 'grpc-service-name': q.get('serviceName') || '' };
  return p;
}

function parseHy2(u) {
  const url = new URL(u.replace(/^(hysteria2|hy2):\/\//, 'http://'));
  const q = url.searchParams;
  return {
    name: decodeURIComponent(url.hash.slice(1)) || `${url.hostname}:${url.port}`,
    type: 'hysteria2', server: url.hostname, port: parseInt(url.port || 443),
    password: decodeURIComponent(url.username) + (url.password ? ':' + decodeURIComponent(url.password) : ''),
    sni: q.get('sni') || '', 'skip-cert-verify': q.get('insecure') === '1', obfs: q.get('obfs') || undefined,
    'obfs-password': q.get('obfs-password') || undefined, udp: true,
  };
}

function parseTuic(u) {
  const url = new URL(u.replace(/^tuic:\/\//, 'http://'));
  const q = url.searchParams;
  return {
    name: decodeURIComponent(url.hash.slice(1)) || `${url.hostname}:${url.port}`,
    type: 'tuic', server: url.hostname, port: parseInt(url.port || 443),
    uuid: decodeURIComponent(url.username), password: decodeURIComponent(url.password || ''),
    sni: q.get('sni') || '', 'skip-cert-verify': q.get('allow_insecure') === '1' || q.get('insecure') === '1',
    'congestion-controller': 'bbr', udp: true,
  };
}

const SCHEMES = {
  'ss://': parseSS, 'ssr://': parseSSR, 'vmess://': parseVmess, 'vless://': parseVless,
  'trojan://': parseTrojan, 'hysteria2://': parseHy2, 'hy2://': parseHy2, 'tuic://': parseTuic,
};

function parseUri(line) {
  line = line.trim();
  for (const [scheme, fn] of Object.entries(SCHEMES)) {
    if (line.toLowerCase().startsWith(scheme)) {
      try {
        const p = fn(line);
        if (!p || !p.server || !p.port || isNaN(p.port) || p.port <= 0 || p.port > 65535) return null;
        return clean(p);
      } catch (e) { return null; }
    }
  }
  return null;
}

function clean(p) {
  for (const k of Object.keys(p)) {
    if (p[k] === undefined || p[k] === '' || p[k] === null) delete p[k];
  }
  // 去掉不可用字段
  if (p['reality-opts'] && !p['reality-opts']['public-key']) { delete p['reality-opts']; delete p.tls; }
  return p;
}

// ---------- 主流程 ----------
const seen = new Set();
const nodes = [];
const stats = [];

function keyOf(p) {
  return [p.type, p.server, p.port, p.uuid || p.password || '', p.network || ''].join('|');
}

function addNode(p, src) {
  if (!p) return false;
  const k = keyOf(p);
  if (seen.has(k)) return false;
  seen.add(k);
  p._src = src;
  nodes.push(p);
  return true;
}

const files = fs.readdirSync(RAW).filter(f => !f.startsWith('.'));
for (const f of files) {
  const full = path.join(RAW, f);
  const txt = fs.readFileSync(full, 'utf8');
  let before = nodes.length;
  let kind = 'unknown';

  // 1) YAML 订阅
  if (/^\s*proxies\s*:/m.test(txt) || /^\s*proxy-groups\s*:/m.test(txt)) {
    kind = 'clash-yaml';
    try {
      const doc = yaml.load(txt);
      if (doc && Array.isArray(doc.proxies)) {
        for (const p of doc.proxies) {
          if (!p || !p.server || !p.port) continue;
          const np = clean({ ...p });
          if (!np.name) np.name = `${np.server}:${np.port}`;
          addNode(np, f);
        }
      }
    } catch (e) { kind = 'clash-yaml-parse-error: ' + e.message.slice(0, 60); }
  } else {
    // 2) base64 订阅 or 明文 URI 列表
    let content = txt;
    if (isBase64ish(txt)) {
      kind = 'base64-sub';
      try { content = b64decode(txt); } catch (e) { content = txt; }
    } else if (/^[a-z0-9]+:\/\//im.test(txt)) {
      kind = 'plain-uri';
    }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const p = parseUri(line);
      if (p) addNode(p, f);
    }
  }
  stats.push({ file: f, kind, added: nodes.length - before });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'candidates.json'), JSON.stringify(nodes, null, 1));
console.log('=== per-source ===');
for (const s of stats) console.log(`${String(s.added).padStart(5)}  ${s.kind.padEnd(28)} ${s.file}`);
const byType = {};
for (const n of nodes) byType[n.type] = (byType[n.type] || 0) + 1;
console.log('=== total unique:', nodes.length, '===');
console.log(byType);
