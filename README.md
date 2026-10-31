# 🚀 Proxy Hub · 自动更新的免费 Clash / V2Ray 节点池

> 全自动采集公开订阅源 → TCP 预筛 → **真实代理测速** → 输出可用配置。
> 每 6 小时自动刷新一次，订阅地址永久有效。

**最后更新：** 2026/10/31 20:57:54 (UTC+8)
**可用节点：** 779 个（**全部实测能访问 Google / YouTube**）
**筛选漏斗：** 采集 42204 → TCP 存活 23826 → 代理测速通过 917 → 端到端验证 779
**延迟：** 最低 5ms · 中位 154ms · 最高 2290ms

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
| 🌐 其他 | 207 |
| 🇺🇸 美国 | 123 |
| 🇳🇱 荷兰 | 105 |
| 🇩🇪 德国 | 81 |
| 🇨🇦 加拿大 | 44 |
| 🇬🇧 英国 | 38 |
| 🇹🇭 泰国 | 31 |
| 🇮🇳 印度 | 24 |
| 🇫🇷 法国 | 23 |
| 🇦🇷 阿根廷 | 20 |
| 🇪🇸 西班牙 | 20 |
| 🇭🇰 香港 | 19 |
| 🇸🇬 新加坡 | 11 |
| 🇯🇵 日本 | 9 |
| 🇰🇷 韩国 | 5 |
| 🇮🇹 意大利 | 3 |
| 🇨🇭 瑞士 | 3 |
| 🇷🇺 俄罗斯 | 3 |
| 🇧🇷 巴西 | 2 |
| 🇦🇪 阿联酋 | 2 |
| 🇵🇱 波兰 | 2 |
| 🇮🇩 印尼 | 1 |
| 🇹🇷 土耳其 | 1 |
| 🇹🇼 台湾 | 1 |
| 🇲🇾 马来西亚 | 1 |

### 按协议

| 协议 | 节点数 |
| --- | --- |
| `vless` | 355 |
| `ss` | 179 |
| `trojan` | 129 |
| `http` | 64 |
| `vmess` | 48 |
| `hysteria2` | 4 |

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
