#!/usr/bin/env bash
# 第二批采集：高活跃度聚合源
cd "$(dirname "$0")/.." || exit 1
mkdir -p raw

fetch() {
  local n="$1" u="$2"
  local code sz
  code=$(curl -sL --max-time 30 -o "raw/$n" -w "%{http_code}" "$u" 2>/dev/null)
  sz=$(stat -c %s "raw/$n" 2>/dev/null || echo 0)
  if [ "$code" != "200" ] || [ "$sz" -lt 200 ]; then rm -f "raw/$n"; fi
  echo "$n|$code|$sz"
}

fetch x_barryfar   "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt"
fetch x_epodonios  "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/All_Configs_Sub.txt"
fetch x_mhdit      "https://raw.githubusercontent.com/MhdiTaheri/V2rayCollector/main/sub/mix"
fetch x_yebekhe    "https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/mix"
fetch x_soroush    "https://raw.githubusercontent.com/soroushmirzaei/telegram-configs-collector/main/splitted/mixed"
fetch x_mermeroo   "https://raw.githubusercontent.com/mermeroo/V2RAY-and-CLASH-in-ONE/main/v2ray.txt"
fetch x_aliilapro  "https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/server.txt"
fetch x_surfboard  "https://raw.githubusercontent.com/Surfboardv2ray/TGParse/main/python/vless"
fetch x_milad      "https://raw.githubusercontent.com/miladtahanian/V2RayCFGDumper/main/config.txt"
fetch x_lalatina   "https://raw.githubusercontent.com/LalatinaHub/Mineral/master/result/nodes"
fetch x_azadnet    "https://raw.githubusercontent.com/AzadNetCH/Clash/main/AzadNet.txt"
fetch x_eternity   "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/Eternity"
fetch x_mfuu       "https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray"
fetch x_aiboboxx   "https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2"
fetch x_flik6      "https://raw.githubusercontent.com/Flik6/getNode/main/v2ray.txt"
fetch x_tsfly      "https://raw.githubusercontent.com/ts-sf/fly/main/v2"
fetch x_mianfei    "https://raw.githubusercontent.com/mianfeifq/share/main/data2024.txt"
fetch x_foxborn    "https://raw.githubusercontent.com/foxborn/v2ray/main/v2ray.txt"
fetch x_zizifn     "https://raw.githubusercontent.com/zizifn/edgetunnel/main/src/config.js"
fetch x_sinspired  "https://raw.githubusercontent.com/sinspired/collector/main/data/v2ray.txt"
fetch x_pawdroid2  "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub"
fetch x_v2cross    "https://raw.githubusercontent.com/v2cross/aggregator/main/all.txt"
fetch x_nodefree   "https://raw.githubusercontent.com/nodefree/nodefree/main/README.md"
fetch x_freeclash  "https://raw.githubusercontent.com/ermaozi01/free_clash_vpn/main/subscribe/v2ray.txt"
fetch x_clashmeta  "https://raw.githubusercontent.com/roosterkid/openproxylist/main/V2RAY_RAW.txt"
fetch x_openproxy  "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SSR_RAW.txt"
fetch x_speedtest  "https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/all"
fetch x_leonvless  "https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/vless"
fetch x_leontrojan "https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/trojan"
fetch x_leonvmess  "https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/vmess"
fetch x_leonss     "https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/ss"
