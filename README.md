# 🚀 Proxy Hub · 自动更新的免费 Clash / V2Ray 节点池

> 全自动采集公开订阅源 → TCP 预筛 → **真实代理测速** → 输出可用配置。
> 每 6 小时自动刷新一次，订阅地址永久有效。

**最后更新：** 2026/10/27 08:39:08 (UTC+8)
**可用节点：** 194 / 采集 42092 · TCP 存活 11479 · 实测通过 194
**延迟：** 最低 55ms · 中位 264ms · 最高 1907ms

---

## 📥 订阅地址

### 1️⃣ Clash / Mihomo / Clash Verge / ClashX（推荐）

```
https://raw.githubusercontent.com/zueston/proxy-hub/main/out/clash.yaml
```

<details>
<summary>国内访问慢？用加速镜像（任选其一）</summary>

```
https://cdn.jsdelivr.net/gh/zueston/proxy-hub@main/out/clash.yaml
https://raw.gitmirror.com/zueston/proxy-hub/main/out/clash.yaml
https://ghfast.top/https://raw.githubusercontent.com/zueston/proxy-hub/main/out/clash.yaml
```

</details>

### 2️⃣ V2RayN / V2RayNG / NekoBox / Shadowrocket / sing-box（Base64 订阅）

```
https://raw.githubusercontent.com/zueston/proxy-hub/main/out/base64.txt
```

镜像：

```
https://cdn.jsdelivr.net/gh/zueston/proxy-hub@main/out/base64.txt
https://raw.gitmirror.com/zueston/proxy-hub/main/out/base64.txt
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
| 🇺🇸 美国 | 47 |
| 🌐 其他 | 38 |
| 🇳🇱 荷兰 | 23 |
| 🇩🇪 德国 | 15 |
| 🇫🇷 法国 | 14 |
| 🇮🇹 意大利 | 9 |
| 🇸🇬 新加坡 | 7 |
| 🇷🇺 俄罗斯 | 6 |
| AR | 5 |
| 🇭🇰 香港 | 4 |
| 🇨🇦 加拿大 | 3 |
| 🇹🇼 台湾 | 3 |
| 🇯🇵 日本 | 3 |
| 🇹🇭 泰国 | 2 |
| 🇮🇳 印度 | 2 |
| 🇬🇧 英国 | 2 |
| 🇸🇪 瑞典 | 2 |
| 🇧🇷 巴西 | 2 |
| 🇵🇱 波兰 | 2 |
| 🇰🇷 韩国 | 1 |
| 🇲🇾 马来西亚 | 1 |
| 🇨🇭 瑞士 | 1 |
| 🇪🇸 西班牙 | 1 |
| 🇦🇺 澳大利亚 | 1 |

### 按协议

| 协议 | 节点数 |
| --- | --- |
| `http` | 108 |
| `vless` | 46 |
| `trojan` | 19 |
| `ss` | 14 |
| `vmess` | 3 |
| `socks5` | 3 |
| `hysteria2` | 1 |

> 地区识别依据节点名称里的关键词（HK/香港/🇭🇰 等），未命中的归入「其他」。

---

## 🔧 工作流程

```
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
```

**只有真实能跑通 `generate_204` 的节点才会进入最终配置**，不是"看着像活的"。

---

## ⚠️ 使用说明

- 节点来自公开互联网，**不保证长期稳定**，失效是常态；本仓库每 6 小时自动重新测试并剔除失效节点。
- 公共节点可能有带宽限制、被滥用、记录流量等风险。**不要用来登录重要账号、传输敏感数据。**
- 若某个订阅地址拉不到，用上面的镜像地址；镜像有缓存延迟，最长滞后 12 小时。
- 需要稳定自用请自建（VPS + Xray/sing-box），公共节点只适合临时应急。

---

<sub>🤖 本仓库由 GitHub Actions 自动维护 · 数据源全部为公开订阅 · 仅供技术研究与网络连通性测试使用</sub>
