# 🚀 Proxy Hub · 自动更新的免费 Clash / V2Ray 节点池

> 全自动采集公开订阅源 → TCP 预筛 → **真实代理测速** → 输出可用配置。
> 每 6 小时自动刷新一次，订阅地址永久有效。

**最后更新：** 2026/10/31 20:20:37 (UTC+8)
**可用节点：** 800 个（**全部实测能访问 Google / YouTube**）
**筛选漏斗：** 采集 42290 → TCP 存活 23918 → 代理测速通过 988 → 端到端验证 800
**延迟：** 最低 9ms · 中位 123ms · 最高 784ms

---

## 📥 订阅地址

### 1️⃣ Clash / Mihomo / Clash Verge / ClashX（推荐）

```
https://raw.githubusercontent.com/zueston/proxy-hub/main/out/clash.yaml
```

<details>
<summary>国内直连 raw 慢 / 被墙？用这些加速镜像（已实测 200）</summary>

```
https://gh-proxy.com/https://raw.githubusercontent.com/zueston/proxy-hub/main/out/clash.yaml
https://ghproxy.net/https://raw.githubusercontent.com/zueston/proxy-hub/main/out/clash.yaml
https://gcore.jsdelivr.net/gh/zueston/proxy-hub@main/out/clash.yaml
```

</details>

### 2️⃣ V2RayN / V2RayNG / NekoBox / Shadowrocket / sing-box（Base64 订阅）

```
https://raw.githubusercontent.com/zueston/proxy-hub/main/out/base64.txt
```

镜像：

```
https://gh-proxy.com/https://raw.githubusercontent.com/zueston/proxy-hub/main/out/base64.txt
https://ghproxy.net/https://raw.githubusercontent.com/zueston/proxy-hub/main/out/base64.txt
https://gcore.jsdelivr.net/gh/zueston/proxy-hub@main/out/base64.txt
```

### 3️⃣ 明文节点列表（自己复制粘贴用）

```
https://raw.githubusercontent.com/zueston/proxy-hub/main/out/plain.txt
```

### 4️⃣ 纯 proxies 片段（给已有的 clash 配置做 proxy-provider）

```
https://raw.githubusercontent.com/zueston/proxy-hub/main/out/proxies_only.yaml
```

### 5️⃣ 节点元数据（JSON，含延迟 / 地区 / 协议）

```
https://raw.githubusercontent.com/zueston/proxy-hub/main/out/nodes.json
```

---

## 🧩 客户端导入方法

| 客户端 | 操作 |
| --- | --- |
| **Clash Verge Rev** | 订阅 → 新建 → 粘贴 `clash.yaml` 地址 → 导入 |
| **ClashX / ClashX Meta**（macOS） | 状态栏图标 → Config → Remote Config → Manage → Add |
| **Clash for Windows** | Profiles → 粘贴 URL → Download |
| **Mihomo / Clash.Meta 内核** | `mihomo -f config.yaml` 或直接用作 proxy-provider |
| **V2RayN**（Windows） | 订阅分组设置 → 添加 → 粘贴 `base64.txt` 地址 |
| **V2RayNG**（Android） | 右上角 + → 从剪贴板导入 / 订阅设置 |
| **NekoBox / sing-box** | 订阅 → 新建 → 粘贴 `base64.txt` 地址 |
| **Shadowrocket**（iOS） | 首页 + → 订阅 → 粘贴 `base64.txt` 地址 |

---

## 📊 当前节点分布

### 按地区

| 地区 | 节点数 |
| --- | --- |
| 🌐 其他 | 200 |
| 🇺🇸 美国 | 129 |
| 🇳🇱 荷兰 | 109 |
| 🇩🇪 德国 | 86 |
| 🇨🇦 加拿大 | 51 |
| 🇬🇧 英国 | 51 |
| 🇹🇭 泰国 | 33 |
| 🇫🇷 法国 | 26 |
| 🇪🇸 西班牙 | 24 |
| 🇦🇷 阿根廷 | 21 |
| 🇮🇳 印度 | 21 |
| 🇸🇬 新加坡 | 8 |
| 🇯🇵 日本 | 7 |
| 🇭🇰 香港 | 7 |
| 🇰🇷 韩国 | 6 |
| 🇷🇺 俄罗斯 | 5 |
| 🇹🇷 土耳其 | 3 |
| 🇧🇷 巴西 | 3 |
| 🇨🇭 瑞士 | 3 |
| 🇵🇱 波兰 | 2 |
| 🇮🇹 意大利 | 2 |
| 🇮🇩 印尼 | 1 |
| 🇦🇪 阿联酋 | 1 |
| 🇹🇼 台湾 | 1 |

### 按协议

| 协议 | 节点数 |
| --- | --- |
| `vless` | 359 |
| `ss` | 182 |
| `trojan` | 118 |
| `http` | 104 |
| `vmess` | 34 |
| `hysteria2` | 2 |
| `socks5` | 1 |

> 地区识别依据节点名称里的关键词（HK/香港/🇭🇰 等），未命中的归入「其他」。

---

## 🔧 工作流程

```
公开订阅源 (20+ 个)
      ↓  collect.sh + collect2.sh
  raw/ 原始订阅 (yaml / base64 / 明文 URI)
      ↓  parse.js  —— 解析 ss/ssr/vmess/vless/trojan/hysteria2/tuic/anytls
  out/candidates.json  去重后的候选节点
      ↓  tcp_test.js  —— 600 并发 TCP 连通性预筛
  out/tcp_alive.json
      ↓  validate_config.js —— 用 mihomo 逐个试解析，剔掉非法参数
  out/validated.json
      ↓  real_test.js —— 启动 mihomo 内核，逐个测真实 HTTP 204
  out/working.json
      ↓  verify.js  —— 端到端验证能否访问 Google / YouTube
  out/working_verified.json
      ↓  finalize.js —— 生成 clash 配置、URI 列表、元数据
  out/clash.yaml · base64.txt · plain.txt · nodes.json
```

**准入标准是「能真的打开 Google」**：节点必须通过 mihomo 的 delay API 成功请求
`https://www.google.com/generate_204` 才会进入最终配置。只通 gstatic 但过不了
Google 的节点（多数是被墙的落地）会被剔除，不是"看着像活的"就算数。

---

## ⚠️ 使用说明

- 节点来自公开互联网，**不保证长期稳定**，失效是常态；本仓库每 6 小时自动重新测试并剔除失效节点。
- 公共节点可能有带宽限制、被滥用、记录流量等风险。**不要用来登录重要账号、传输敏感数据。**
- 若某个订阅地址拉不到，用上面的镜像地址；镜像有缓存延迟，最长滞后 12 小时。
- 需要稳定自用请自建（VPS + Xray/sing-box），公共节点只适合临时应急。

---

<sub>🤖 本仓库由 GitHub Actions 自动维护 · 数据源全部为公开订阅 · 仅供技术研究与网络连通性测试使用</sub>
