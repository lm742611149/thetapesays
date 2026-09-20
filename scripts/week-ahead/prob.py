"""Touch probabilities for the week ahead.

Bootstrap, not a normal: BTC's daily returns are fat-tailed and a lognormal
closed form understates the odds of reaching a level. Draws with replacement
from the last 730 daily log returns, de-meaned so the simulation carries the
market's shape but no view on direction. 100k paths, 7 daily steps, and a
barrier is counted as touched on any day's high or low, not just the close.
"""
import json, math, random

random.seed(20260920)
OUT={}
N, DAYS = 100_000, 7

def klines(p):
    return [{"o":float(r[1]),"h":float(r[2]),"l":float(r[3]),"c":float(r[4])} for r in json.load(open(p))]

for sym, pair, fmt in [("BTC","BTCUSDT","{:,.0f}"),("ETH","ETHUSDT","{:,.0f}"),("SOL","SOLUSDT","{:,.1f}")]:
    bars = klines(f"dl-{pair}.json")
    done, cur = bars[:-1], bars[-1]["c"]
    closes = [b["c"] for b in done]
    rets = [math.log(closes[i]/closes[i-1]) for i in range(1,len(closes))][-730:]
    mu = sum(rets)/len(rets)
    rets = [r-mu for r in rets]                       # no drift, no view
    # intraday reach: how far beyond the close a day typically travels
    rng = [ (b["h"]-b["l"])/b["c"] for b in done[-730:] ]
    hi = max(b["h"] for b in done[-30:]); lo = min(b["l"] for b in done[-30:])

    up_only = dn_only = both = neither = 0
    end_above = end_below = 0
    for _ in range(N):
        p = cur; tu = td = False
        for _ in range(DAYS):
            r = random.choice(rets)
            nxt = p*math.exp(r)
            # the day's extremes, scaled off a sampled true range
            w = p*random.choice(rng)*0.5
            if max(p,nxt)+w >= hi: tu = True
            if min(p,nxt)-w <= lo: td = True
            p = nxt
        if tu and td: both += 1
        elif tu: up_only += 1
        elif td: dn_only += 1
        else: neither += 1
        if p > hi: end_above += 1
        elif p < lo: end_below += 1
    f=lambda x: round(100*x/N,1)
    OUT[sym]={"hi":hi,"lo":lo,"cur":cur,"touch_hi":f(up_only+both),"touch_lo":f(dn_only+both),"neither":f(neither),"close_above":f(end_above),"close_below":f(end_below)}
    print(f"=== {sym}  {fmt.format(cur)}   box {fmt.format(lo)} .. {fmt.format(hi)}")
    print(f"  touches the high only   {f(up_only)}%")
    print(f"  touches the low only    {f(dn_only)}%")
    print(f"  touches both            {f(both)}%")
    print(f"  stays inside all week   {f(neither)}%")
    print(f"  -> reaches the high  {f(up_only+both)}%")
    print(f"  -> reaches the low   {f(dn_only+both)}%")
    print(f"  closes above {f(end_above)}%  below {f(end_below)}%")

json.dump(OUT, open("prob.json","w"), indent=1)
print("wrote prob.json")
