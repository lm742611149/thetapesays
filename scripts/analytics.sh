#!/usr/bin/env bash
# Query the usage events written by functions/api/beacon.js.
#
# Analytics Engine is read through Cloudflare's SQL API, which needs a real API
# token — the OAuth credential wrangler stores cannot read it. Create one at
#   dash.cloudflare.com → My Profile → API Tokens → Create Token
#   permission: Account · Account Analytics · Read
# then put it somewhere only you can read:
#   echo 'CF_ACCOUNT_ID=...'  > ~/.tapesays-analytics
#   echo 'CF_API_TOKEN=...'  >> ~/.tapesays-analytics
#   chmod 600 ~/.tapesays-analytics
#
# Usage:  scripts/analytics.sh [pages|referral|switches|sources|raw] [days]
set -euo pipefail

CONF="${TAPESAYS_ANALYTICS_CONF:-$HOME/.tapesays-analytics}"
[ -f "$CONF" ] || { echo "missing $CONF — see the header of this script"; exit 1; }
# shellcheck disable=SC1090
. "$CONF"
: "${CF_ACCOUNT_ID:?}" "${CF_API_TOKEN:?}"

REPORT="${1:-pages}"
DAYS="${2:-7}"
SINCE="toDateTime(now() - INTERVAL '${DAYS}' DAY)"

# The author's own browsers stopped reporting at source on 2026-09-20 (the
# optout flag in src/lib/track.ts), so anything newer is already clean. Rows
# written before that carry no id to subtract him by, and country is the only
# handle left: EXCLUDE_CC drops a whole country, real readers included, so it
# stays opt-in rather than being wired in as a default.
#   EXCLUDE_CC=JP scripts/analytics.sh pages 30
EXCLUDE_CC="${EXCLUDE_CC:-}"
CC=""
[ -n "$EXCLUDE_CC" ] && CC=" AND blob6 != '${EXCLUDE_CC}'"

# blob1 event · blob2 path · blob3 label · blob4 value/href · blob5 referrer
# blob6 country · blob7 device · double1 dwell(s) · double2 depth(%) · double3 width
case "$REPORT" in
pages)
	# Analytics Engine speaks a subset of ClickHouse: no NULLIF, and avg() over a
	# null branch is not safe either. Divide by hand and guard the empty case, so
	# a page with views but no completed visit reports 0 rather than erroring.
	V="sum(if(blob1='visit',1,0))"
	SQL="SELECT blob2 AS page,
	        sum(if(blob1='view',1,0)) AS views,
	        $V AS visits,
	        round(sum(if(blob1='visit',double1,0.0))/if($V=0,1,$V),1) AS avg_seconds,
	        round(sum(if(blob1='visit',double2,0.0))/if($V=0,1,$V),0) AS avg_depth_pct,
	        round(100*sum(if(blob1='visit' AND double1<10,1,0))/if($V=0,1,$V),0) AS bounce_pct
	      FROM tapesays_events WHERE timestamp > $SINCE$CC
	      GROUP BY page ORDER BY views DESC LIMIT 30" ;;
referral)
	SQL="SELECT blob2 AS page, count() AS clicks
	      FROM tapesays_events WHERE timestamp > $SINCE$CC AND blob1='referral'
	      GROUP BY page ORDER BY clicks DESC LIMIT 30" ;;
switches)
	SQL="SELECT blob3 AS control, blob4 AS value, count() AS uses
	      FROM tapesays_events WHERE timestamp > $SINCE$CC AND blob1='switch'
	      GROUP BY control, value ORDER BY uses DESC LIMIT 40" ;;
sources)
	SQL="SELECT if(blob5='','(direct)',blob5) AS source, blob6 AS country, blob7 AS device, count() AS views
	      FROM tapesays_events WHERE timestamp > $SINCE$CC AND blob1='view'
	      GROUP BY source, country, device ORDER BY views DESC LIMIT 40" ;;
raw)
	SQL="SELECT timestamp, blob1 AS event, blob2 AS page, blob3 AS label, blob4 AS value,
	            double1 AS dwell, double2 AS depth
	      FROM tapesays_events WHERE timestamp > $SINCE$CC ORDER BY timestamp DESC LIMIT 60" ;;
*)
	echo "unknown report: $REPORT (pages|referral|switches|sources|raw)"; exit 1 ;;
esac

curl -sS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
	-H "Authorization: Bearer ${CF_API_TOKEN}" \
	--data "$SQL" \
| python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print(raw.strip() or "(empty response)"); sys.exit(1)
rows = d.get("data") or []
if not rows:
    print("no rows — either nothing tracked yet, or the dataset name/token is wrong")
    sys.exit()
cols = list(rows[0].keys())
w = {c: max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in cols}
print("  ".join(c.ljust(w[c]) for c in cols))
print("  ".join("-" * w[c] for c in cols))
for r in rows:
    print("  ".join(str(r.get(c, "")).ljust(w[c]) for c in cols))
'
