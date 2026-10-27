const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');

const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'nodes.json'), 'utf8'));
const REPO = process.env.REPO_SLUG || 'zueston/proxy-hub';
const BRANCH = process.env.REPO_BRANCH || 'main';

const rawBase = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const jsdBase = `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}`;

const utc = meta.generated_at;
const local = new Date(utc).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

const regionNames = {
  HK: '🇭🇰 香港', TW: '🇹🇼 台湾', JP: '🇯🇵 日本', SG: '🇸🇬 新加坡', US: '🇺🇸 美国',
  KR: '🇰🇷 韩国', UK: '🇬🇧 英国', DE: '🇩🇪 德国', NL: '🇳🇱 荷兰', FR: '🇫🇷 法国',
  CA: '🇨🇦 加拿大', AU: '🇦🇺 澳大利亚', RU: '🇷🇺 俄罗斯', TR: '🇹🇷 土耳其', IN: '🇮🇳 印度',
  BR: '🇧🇷 巴西', VN: '🇻🇳 越南', MY: '🇲🇾 马来西亚', TH: '🇹🇭 泰国', PH: '🇵🇭 菲律宾',
  ID: '🇮🇩 印尼', AE: '🇦🇪 阿联酋', CH: '🇨🇭 瑞士', SE: '🇸🇪 瑞典', PL: '🇵🇱 波兰',
  IT: '🇮🇹 意大利', ES: '🇪🇸 西班牙', XX: '🌐 其他',
};

const regions = Object.entries(meta.by_region).sort((a, b) => b[1] - a[1]);
const types = Object.entries(meta.by_type).sort((a, b) => b[1] - a[1]);

const regionTable = regions.map(([r, c]) => `| ${regionNames[r] || r} | ${c} |`).join('\n');
const typeTable = types.map(([t, c]) => `| \`${t}\` | ${c} |`).join('\n');

const md = `# 🚀 Proxy Hub · 自动更新的免费 Clash / V2Ray 节点池

> 全自动采集公开订阅源 → TCP 预筛 → **真实代理测速** → 输出可用配置。
> 每 6 小时自动刷新一次，订阅地址永久有效。

**最后更新：** ${local} (UTC+8)
**可用节点：** ${meta.exported} / 采集 ${meta.total_candidates} · TCP 存活 ${meta.tcp_alive} · 实测通过 ${meta.tested_ok}
**延迟：** 最低 ${meta.delay_stats.min}ms · 中位 ${meta.delay_stats.median}ms · 最高 ${meta.delay_stats.max}ms

---

## 📥 订阅地址

### 1️⃣ Clash / Mihomo / Clash Verge / ClashX（推荐）

\`\`\`
${rawBase}/out/clash.yaml
\`\`\`

<details>
<summary>国内访问慢？用加速镜像（任选其一）</summary>

\`\`\`
${jsdBase}/out/clash.yaml
https://raw.gitmirror.com/${REPO}/${BRANCH}/out/clash.yaml
https://ghfast.top/${rawBase}/out/clash.yaml
\`\`\`

</details>

### 2️⃣ V2RayN / V2RayNG / NekoBox / Shadowrocket / sing-box（Base64 订阅）

\`\`\`
${rawBase}/out/base64.txt
\`\`\`

镜像：

\`\`\`
${jsdBase}/out/base64.txt
https://raw.gitmirror.com/${REPO}/${BRANCH}/out/base64.txt
\`\`\`

### 3️⃣ 明文节点列表（自己复制粘贴用）

\`\`\`
${rawBase}/out/plain.txt
\`\`\`

### 4️⃣ 纯 proxies 片段（给已有的 clash 配置做 proxy-provider）

\`\`\`
${rawBase}/out/proxies_only.yaml
\`\`\`

### 5️⃣ 节点元数据（JSON，含延迟 / 地区 / 协议）

\`\`\`
${rawBase}/out/nodes.json
\`\`\`

---

## 🧩 客户端导入方法

| 客户端 | 操作 |
| --- | --- |
| **Clash Verge Rev** | 订阅 → 新建 → 粘贴 \`clash.yaml\` 地址 → 导入 |
| **ClashX / ClashX Meta**（macOS） | 状态栏图标 → Config → Remote Config → Manage → Add |
| **Clash for Windows** | Profiles → 粘贴 URL → Download |
| **Mihomo / Clash.Meta 内核** | \`mihomo -f config.yaml\` 或直接用作 proxy-provider |
| **V2RayN**（Windows） | 订阅分组设置 → 添加 → 粘贴 \`base64.txt\` 地址 |
| **V2RayNG**（Android） | 右上角 + → 从剪贴板导入 / 订阅设置 |
| **NekoBox / sing-box** | 订阅 → 新建 → 粘贴 \`base64.txt\` 地址 |
| **Shadowrocket**（iOS） | 首页 + → 订阅 → 粘贴 \`base64.txt\` 地址 |

---

## 📊 当前节点分布

### 按地区

| 地区 | 节点数 |
| --- | --- |
${regionTable}

### 按协议

| 协议 | 节点数 |
| --- | --- |
${typeTable}

> 地区识别依据节点名称里的关键词（HK/香港/🇭🇰 等），未命中的归入「其他」。

---

## 🔧 工作流程

\`\`\`
公开订阅源 (14 个)
      ↓  collect.sh
  raw/ 原始订阅 (yaml / base64 / 明文 URI)
      ↓  parse.js  —— 解析 ss/ssr/vmess/vless/trojan/hysteria2/tuic/anytls
  out/candidates.json  去重后的候选节点
      ↓  tcp_test.js  —— 400 并发 TCP 连通性预筛
  out/tcp_alive.json
      ↓  real_test.js —— 启动 mihomo 内核，逐个测真实 HTTP 204
  out/working.json
      ↓  retest.js  —— 失败节点换 URL / 加长超时复测
      ↓  finalize.js —— 生成 clash 配置、URI 列表、元数据
  out/clash.yaml · base64.txt · plain.txt · nodes.json
\`\`\`

**只有真实能跑通 \`generate_204\` 的节点才会进入最终配置**，不是"看着像活的"。

---

## ⚠️ 使用说明

- 节点来自公开互联网，**不保证长期稳定**，失效是常态；本仓库每 6 小时自动重新测试并剔除失效节点。
- 公共节点可能有带宽限制、被滥用、记录流量等风险。**不要用来登录重要账号、传输敏感数据。**
- 若某个订阅地址拉不到，用上面的镜像地址；镜像有缓存延迟，最长滞后 12 小时。
- 需要稳定自用请自建（VPS + Xray/sing-box），公共节点只适合临时应急。

---

<sub>🤖 本仓库由 GitHub Actions 自动维护 · 数据源全部为公开订阅 · 仅供技术研究与网络连通性测试使用</sub>
`;

fs.writeFileSync(path.join(ROOT, 'README.md'), md);
console.log('README.md written, nodes:', meta.exported);
