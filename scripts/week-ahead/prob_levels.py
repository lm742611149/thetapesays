"""Touch / close probabilities for hand-picked levels.

Same engine as prob.py (bootstrap off the last 730 de-meaned daily log returns,
100k paths, 7 steps, barriers judged on a sampled intraday range) but the levels
are given on the command line instead of being read off the 30-day box. Needed
the day price breaks out of that box, when "reaches the high" is 100% and says
nothing.

    python3 prob_levels.py BTCUSDT 82300 90000
"""
import json, math, random, sys

random.seed(20260921)
pair = sys.argv[1]
levels = [float(x) for x in sys.argv[2:]]
N, DAYS = 100_000, 7

rows = json.load(open(f"dl-{pair}.json"))
bars = [{"o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4])} for r in rows]
done, cur = bars[:-1], bars[-1]["c"]
closes = [b["c"] for b in done]
rets = [math.log(closes[i] / closes[i - 1]) for i in range(1, len(closes))][-730:]
mu = sum(rets) / len(rets)
rets = [r - mu for r in rets]
rng = [(b["h"] - b["l"]) / b["c"] for b in done[-730:]]

touch = {L: 0 for L in levels}
close_above = {L: 0 for L in levels}
ends = []
steps = [[] for _ in range(DAYS)]          # per-day prices, for the fan
for _ in range(N):
    p = cur
    hit = {L: False for L in levels}
    for d in range(DAYS):
        r = random.choice(rets)
        nxt = p * math.exp(r)
        w = p * random.choice(rng) * 0.5
        day_hi, day_lo = max(p, nxt) + w, min(p, nxt) - w
        for L in levels:
            if L >= cur and day_hi >= L: hit[L] = True
            if L < cur and day_lo <= L: hit[L] = True
        p = nxt
        steps[d].append(p)
    for L in levels:
        if hit[L]: touch[L] += 1
        if p > L: close_above[L] += 1
    ends.append(p)

ends.sort()
q = lambda x: ends[int(x * N)]
f = lambda x: round(100 * x / N, 1)
fan = {k: [cur] for k in ("p10", "p25", "p50", "p75", "p90")}
for day in steps:
    day.sort()
    for k, frac in (("p10", .10), ("p25", .25), ("p50", .50), ("p75", .75), ("p90", .90)):
        fan[k].append(day[int(frac * N)])
out = {"pair": pair, "cur": cur, "levels": {}, "fan": fan,
       "p10": q(.10), "p25": q(.25), "p50": q(.50), "p75": q(.75), "p90": q(.90)}
print(f"{pair}  spot {cur:,.0f}   ({DAYS} sessions, {N:,} paths)")
for L in levels:
    out["levels"][str(int(L))] = {"touch": f(touch[L]), "close_above": f(close_above[L])}
    side = "up to" if L >= cur else "back to"
    print(f"  {side} {L:,.0f}:  touch {f(touch[L])}%   close above {f(close_above[L])}%")
print(f"  end-of-week distribution:  p10 {q(.10):,.0f}  p25 {q(.25):,.0f}  median {q(.50):,.0f}  p75 {q(.75):,.0f}  p90 {q(.90):,.0f}")
json.dump(out, open(f"levels-{pair}.json", "w"), indent=1)
