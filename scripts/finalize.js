const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');

function b64(s) { return Buffer.from(s, 'utf8').toString('base64'); }
function b64url(s) { return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

const REGION_RULES = [
  [/香港|HK|Hong ?Kong|🇭🇰/i, 'HK'],
  [/台湾|台灣|TW|Taiwan|🇹🇼/i, 'TW'],
  [/日本|JP|Japan|东京|大阪|🇯🇵/i, 'JP'],
  [/新加坡|狮城|SG|Singapore|🇸🇬/i, 'SG'],
  [/美国|US|United ?States|洛杉矶|圣何塞|西雅图|🇺🇸/i, 'US'],
  [/韩国|韓國|KR|Korea|首尔|🇰🇷/i, 'KR'],
  [/英国|UK|GB|Britain|伦敦|🇬🇧/i, 'UK'],
  [/德国|DE|Germany|法兰克福|🇩🇪/i, 'DE'],
  [/荷兰|NL|Netherlands|🇳🇱/i, 'NL'],
  [/法国|FR|France|🇫🇷/i, 'FR'],
  [/俄罗斯|RU|Russia|🇷🇺/i, 'RU'],
  [/加拿大|CA|Canada|🇨🇦/i, 'CA'],
  [/澳大利亚|澳洲|AU|Australia|🇦🇺/i, 'AU'],
  [/印度|IN|India|🇮🇳/i, 'IN'],
  [/土耳其|TR|Turkey|🇹🇷/i, 'TR'],
  [/巴西|BR|Brazil|🇧🇷/i, 'BR'],
  [/阿根廷|AR|Argentina|🇦🇷/i, 'AR'],
  [/越南|VN|Vietnam|🇻🇳/i, 'VN'],
  [/马来|MY|Malaysia|🇲🇾/i, 'MY'],
  [/泰国|TH|Thailand|🇹🇭/i, 'TH'],
  [/菲律宾|PH|Philippines|🇵🇭/i, 'PH'],
  [/印尼|ID|Indonesia|🇮🇩/i, 'ID'],
  [/阿联酋|迪拜|AE|Emirates|🇦🇪/i, 'AE'],
  [/瑞士|CH|Switzerland|🇨🇭/i, 'CH'],
  [/瑞典|SE|Sweden|🇸🇪/i, 'SE'],
  [/波兰|PL|Poland|🇵🇱/i, 'PL'],
  [/意大利|IT|Italy|🇮🇹/i, 'IT'],
  [/西班牙|ES|Spain|🇪🇸/i, 'ES'],
];

function detectRegion(name) {
  for (const [re, code] of REGION_RULES) if (re.test(name)) return code;
  return 'XX';
}

function cleanName(name) {
  // 去掉 emoji 与特殊字符，保证 YAML/URL 安全
  let s = String(name || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[|,"'`\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) s = 'node';
  return s.slice(0, 60);
}

// ---------- clash proxy -> URI ----------
function toUri(p) {
  const t = p.type;
  if (t === 'ss') {
    const cred = b64url(`${p.cipher}:${p.password}`);
    return `ss://${cred}@${p.server}:${p.port}#${encodeURIComponent(p.name)}`;
  }
  if (t === 'ssr') {
    const pw = b64url(p.password || '');
    const obfsparam = b64url(p['obfs-param'] || '');
    const protoparam = b64url(p['protocol-param'] || '');
    const raw = `${p.server}:${p.port}:${p.protocol}:${p.cipher}:${p.obfs}:${pw}/?obfsparam=${obfsparam}&protoparam=${protoparam}&remarks=${b64url(p.name)}`;
    return `ssr://${b64url(raw)}`;
  }
  if (t === 'vmess') {
    const j = {
      v: '2', ps: p.name, add: p.server, port: String(p.port), id: p.uuid,
      aid: String(p.alterId || 0), scy: p.cipher || 'auto', net: p.network || 'tcp',
      type: 'none', host: (p['ws-opts']?.headers?.Host) || p.servername || '',
      path: (p['ws-opts']?.path) || (p['grpc-opts']?.['grpc-service-name']) || '',
      tls: p.tls ? 'tls' : '', sni: p.servername || '', alpn: '',
    };
    return `vmess://${b64(JSON.stringify(j))}`;
  }
  if (t === 'vless') {
    const q = new URLSearchParams();
    q.set('encryption', 'none');
    q.set('security', p['reality-opts'] ? 'reality' : (p.tls ? 'tls' : 'none'));
    if (p.servername) q.set('sni', p.servername);
    if (p['client-fingerprint']) q.set('fp', p['client-fingerprint']);
    if (p.flow) q.set('flow', p.flow);
    if (p['reality-opts']) { q.set('pbk', p['reality-opts']['public-key']); q.set('sid', p['reality-opts']['short-id'] || ''); }
    q.set('type', p.network || 'tcp');
    if (p.network === 'ws') { q.set('path', p['ws-opts']?.path || '/'); if (p['ws-opts']?.headers?.Host) q.set('host', p['ws-opts'].headers.Host); }
    if (p.network === 'grpc') q.set('serviceName', p['grpc-opts']?.['grpc-service-name'] || '');
    return `vless://${p.uuid}@${p.server}:${p.port}?${q.toString()}#${encodeURIComponent(p.name)}`;
  }
  if (t === 'trojan') {
    const q = new URLSearchParams();
    if (p.sni) q.set('sni', p.sni);
    if (p['skip-cert-verify']) q.set('allowInsecure', '1');
    if (p['client-fingerprint']) q.set('fp', p['client-fingerprint']);
    if (p.network === 'ws') { q.set('type', 'ws'); q.set('path', p['ws-opts']?.path || '/'); if (p['ws-opts']?.headers?.Host) q.set('host', p['ws-opts'].headers.Host); }
    if (p.network === 'grpc') { q.set('type', 'grpc'); q.set('serviceName', p['grpc-opts']?.['grpc-service-name'] || ''); }
    const qs = q.toString();
    return `trojan://${encodeURIComponent(p.password)}@${p.server}:${p.port}${qs ? '?' + qs : ''}#${encodeURIComponent(p.name)}`;
  }
  if (t === 'hysteria2') {
    const q = new URLSearchParams();
    if (p.sni) q.set('sni', p.sni);
    if (p['skip-cert-verify']) q.set('insecure', '1');
    if (p.obfs) q.set('obfs', p.obfs);
    if (p['obfs-password']) q.set('obfs-password', p['obfs-password']);
    const qs = q.toString();
    return `hysteria2://${encodeURIComponent(p.password)}@${p.server}:${p.port}${qs ? '?' + qs : ''}#${encodeURIComponent(p.name)}`;
  }
  if (t === 'tuic') {
    const q = new URLSearchParams();
    if (p.sni) q.set('sni', p.sni);
    if (p['skip-cert-verify']) q.set('allow_insecure', '1');
    q.set('congestion_control', p['congestion-controller'] || 'bbr');
    return `tuic://${p.uuid}:${encodeURIComponent(p.password)}@${p.server}:${p.port}?${q.toString()}#${encodeURIComponent(p.name)}`;
  }
  if (t === 'anytls') {
    return `anytls://${encodeURIComponent(p.password)}@${p.server}:${p.port}#${encodeURIComponent(p.name)}`;
  }
  return null;
}

// ---------- 主流程 ----------
const working = JSON.parse(fs.readFileSync(path.join(OUT, 'working.json'), 'utf8'));
const MIN = parseInt(process.env.MIN_DELAY || '0', 10);
const MAX = parseInt(process.env.MAX_DELAY || '4000', 10);
const LIMIT = parseInt(process.env.LIMIT || '600', 10);

const picked = working
  .filter(n => n._delay >= MIN && n._delay <= MAX)
  .slice(0, LIMIT);

// 命名：REGION-类型-序号 [原始名]
const counters = {};
const finalNodes = picked.map(n => {
  const region = detectRegion(n.name);
  const k = region;
  counters[k] = (counters[k] || 0) + 1;
  const raw = cleanName(n.name);
  const name = `${region}-${String(counters[k]).padStart(3, '0')} ${raw}`.slice(0, 80);
  const p = { ...n };
  delete p._src; delete p._tcp; delete p._tcp_ms; delete p._delay; delete p._tested;
  p.name = name;
  return { proxy: p, meta: { delay: n._delay, region, raw_name: n.name, type: n.type } };
});

const proxies = finalNodes.map(f => f.proxy);
console.log(`selected: ${proxies.length}`);

// --- clash 配置 ---
const REGION_ORDER = ['HK', 'TW', 'JP', 'SG', 'US', 'KR', 'UK', 'DE', 'NL', 'FR', 'CA', 'AU', 'RU', 'TR', 'IN', 'BR', 'VN', 'MY', 'TH', 'PH', 'ID', 'AE', 'CH', 'SE', 'PL', 'IT', 'ES', 'XX'];
const byRegion = {};
for (const f of finalNodes) {
  const r = f.meta.region;
  (byRegion[r] = byRegion[r] || []).push(f.proxy.name);
}

const groups = [
  { name: '🚀 节点选择', type: 'select', proxies: ['♻️ 自动选择', '🔯 故障转移', ...REGION_ORDER.filter(r => byRegion[r]).map(r => `${r} 地区`), 'DIRECT', ...proxies.map(p => p.name)] },
  { name: '♻️ 自动选择', type: 'url-test', proxies: [...proxies.map(p => p.name)], url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
  { name: '🔯 故障转移', type: 'fallback', proxies: [...proxies.map(p => p.name)], url: 'http://www.gstatic.com/generate_204', interval: 300 },
];
for (const r of REGION_ORDER) {
  if (!byRegion[r]) continue;
  groups.push({ name: `${r} 地区`, type: 'url-test', proxies: byRegion[r], url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 });
}
groups.push({ name: '🎯 全球直连', type: 'select', proxies: ['DIRECT', '🚀 节点选择'] });
groups.push({ name: '🛑 广告拦截', type: 'select', proxies: ['REJECT', 'DIRECT'] });
groups.push({ name: '🐟 漏网之鱼', type: 'select', proxies: ['🚀 节点选择', 'DIRECT', '♻️ 自动选择'] });

const rules = [
  'GEOIP,LAN,DIRECT,no-resolve',
  'GEOIP,CN,DIRECT',
  'GEOSITE,category-ads-all,🛑 广告拦截',
  'GEOSITE,private,🎯 全球直连',
  'GEOSITE,apple-cn,🎯 全球直连',
  'GEOSITE,microsoft@cn,🎯 全球直连',
  'GEOSITE,cn,🎯 全球直连',
  'GEOSITE,geolocation-!cn,🚀 节点选择',
  'MATCH,🐟 漏网之鱼',
];

const clashCfg = {
  'mixed-port': 7890,
  'allow-lan': true,
  'bind-address': '*',
  mode: 'rule',
  'log-level': 'info',
  ipv6: true,
  'unified-delay': true,
  'tcp-concurrent': true,
  'find-process-mode': 'off',
  'global-client-fingerprint': 'chrome',
  'external-controller': '127.0.0.1:9090',
  'geodata-mode': true,
  'geo-auto-update': true,
  'geo-update-interval': 24,
  profile: { 'store-selected': true, 'store-fake-ip': true },
  dns: {
    enable: true, ipv6: false, 'enhanced-mode': 'fake-ip', 'fake-ip-range': '198.18.0.1/16',
    'default-nameserver': ['223.5.5.5', '119.29.29.29'],
    nameserver: ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
    'proxy-server-nameserver': ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
    fallback: ['https://1.1.1.1/dns-query', 'https://dns.google/dns-query'],
    'fallback-filter': { geoip: true, 'geoip-code': 'CN' },
  },
  proxies,
  'proxy-groups': groups,
  rules,
};

fs.writeFileSync(path.join(OUT, 'clash.yaml'), JSON.stringify(clashCfg, null, 1));

// --- 纯节点配置（只有 proxies，可被 clash 作为 proxy-provider 使用）---
fs.writeFileSync(path.join(OUT, 'proxies_only.yaml'), JSON.stringify({ proxies }, null, 1));

// --- URI 列表 ---
const uris = [];
for (const p of proxies) {
  const u = toUri(p);
  if (u) uris.push(u);
}
fs.writeFileSync(path.join(OUT, 'plain.txt'), uris.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'base64.txt'), b64(uris.join('\n')));
fs.writeFileSync(path.join(OUT, 'base64url.txt'), b64url(uris.join('\n')));

// --- 元数据 ---
const meta = {
  generated_at: new Date().toISOString(),
  total_candidates: JSON.parse(fs.readFileSync(path.join(OUT, 'candidates.json'), 'utf8')).length,
  tcp_alive: JSON.parse(fs.readFileSync(path.join(OUT, 'tcp_alive.json'), 'utf8')).length,
  tested_ok: working.length,
  exported: proxies.length,
  by_type: proxies.reduce((a, p) => (a[p.type] = (a[p.type] || 0) + 1, a), {}),
  by_region: finalNodes.reduce((a, f) => (a[f.meta.region] = (a[f.meta.region] || 0) + 1, a), {}),
  delay_stats: {
    min: Math.min(...finalNodes.map(f => f.meta.delay)),
    median: finalNodes.map(f => f.meta.delay).sort((a, b) => a - b)[Math.floor(finalNodes.length / 2)],
    max: Math.max(...finalNodes.map(f => f.meta.delay)),
  },
  nodes: finalNodes.map(f => ({ name: f.proxy.name, type: f.proxy.type, server: f.proxy.server, port: f.proxy.port, region: f.meta.region, delay_ms: f.meta.delay })),
};
fs.writeFileSync(path.join(OUT, 'nodes.json'), JSON.stringify(meta, null, 1));

console.log('by_type:', meta.by_type);
console.log('by_region:', meta.by_region);
console.log('delay:', meta.delay_stats);
console.log('uris:', uris.length);
