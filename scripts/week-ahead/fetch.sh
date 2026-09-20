#!/usr/bin/env bash
# Pull everything the weekly post needs into one directory.
#
# Binance returns 451 to Node/undici's default user agent and the local proxy is
# a MITM cert that python's urllib will not accept, so every request is a curl
# with a browser UA that writes json to disk. The analysis scripts read files,
# never the network.
set -euo pipefail
OUT="${1:-$(mktemp -d)}"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
PROXY="${TAPESAYS_PROXY:-http://127.0.0.1:7897}"
mkdir -p "$OUT"

for s in BTCUSDT ETHUSDT SOLUSDT; do
	curl -sS --max-time 40 --proxy "$PROXY" -A "$UA" \
		"https://data-api.binance.vision/api/v3/klines?symbol=$s&interval=1d&limit=1000" -o "$OUT/dl-$s.json"
	# fapi has no mirror, and it is the only source for funding
	curl -sS --max-time 30 --proxy "$PROXY" -A "$UA" \
		"https://fapi.binance.com/fapi/v1/fundingRate?symbol=$s&limit=280" -o "$OUT/fr-$s.json"
	echo "[fetch] $s  $(python3 -c "import json;print(len(json.load(open('$OUT/dl-$s.json'))),'daily', len(json.load(open('$OUT/fr-$s.json'))),'funding')")"
done
echo "$OUT"
