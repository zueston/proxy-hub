#!/usr/bin/env bash
# 采集多个公开订阅源到 raw/
cd "$(dirname "$0")/.." || exit 1
mkdir -p raw

fetch() { # name url
  local n="$1" u="$2"
  local code
  code=$(curl -sL --max-time 30 -o "raw/$n" -w "%{http_code}" "$u" 2>/dev/null)
  local sz
  sz=$(stat -c %s "raw/$n" 2>/dev/null || echo 0)
  echo "$n|$code|$sz|$u"
}

fetch clash_ripao   "https://raw.githubusercontent.com/ripaojiedian/freenode/main/clash"
fetch clash_ermaozi "https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/clash.yml"
fetch clash_anaer   "https://raw.githubusercontent.com/anaer/Sub/main/clash.yaml"
fetch clash_bara    "https://raw.githubusercontent.com/Barabama/FreeNodes/main/nodes/clashmeta.yaml"
fetch clash_nmw     "https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.yml"
fetch clash_cheng   "https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.yml"
fetch sub_pawdroid  "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub"
fetch sub_mahdi     "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt"
fetch sub_freefq    "https://raw.githubusercontent.com/freefq/free/master/v2"
fetch clash_mfuu    "https://raw.githubusercontent.com/mfuu/v2ray/master/clash.yaml"
fetch clash_aibox   "https://raw.githubusercontent.com/aiboboxx/clashfree/main/clash.yml"
fetch clash_vveg    "https://raw.githubusercontent.com/vveg26/get_proxy/main/dist/clash.config.yaml"
fetch clash_wsfun   "https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription_num"
fetch clash_openits "https://raw.githubusercontent.com/openitcloud/OpenitCloud/main/sub/clash.yaml"
