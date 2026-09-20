"""Week-ahead charts. Binance daily klines and funding history, read from disk
(the local proxy is a MITM cert, so urllib inside the script fails; curl writes
the json first)."""
import json, math, datetime as dt, statistics as st
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

BG, PANEL, GRID = "#0B0E11", "#12161C", "#1E2530"
# type is one hue in three values, so the chart reads as one object. Candles and
# the moving averages keep their own colours: those are data, not labels.
FG, MUT = "#F0B90B", "#8A7030"        # bright gold for figures, dim gold for labels
DIM = "#C9A227"
UP, DOWN, GOLD, BLUE, AMBER = "#0ECB81", "#F6465D", "#F0B90B", "#7AA2FF", "#E5C07B"
WIN = 95                                     # trading days drawn
PROB = json.load(open("prob.json"))

def klines(p):
    return [{"t": int(r[0]), "o": float(r[1]), "h": float(r[2]), "l": float(r[3]),
             "c": float(r[4]), "v": float(r[7])} for r in json.load(open(p))]   # v = quote volume

def sma(vals, n, i):
    return sum(vals[i - n + 1:i + 1]) / n if i >= n - 1 else None

def atr(bars, n=14):
    tr = [max(b["h"] - b["l"], abs(b["h"] - bars[i-1]["c"]), abs(b["l"] - bars[i-1]["c"]))
          for i, b in enumerate(bars) if i]
    return sum(tr[-n:]) / n

# The headline asks the question and names both edges. It does not answer it:
# the account's whole position is that a level is checkable and a call is not.
SPEC = [
    ("BTC", "BTCUSDT", "{:,.0f}", "Still 10% under the 100-week average it lost in January"),
    ("ETH", "ETHUSDT", "{:,.0f}", "Up the most of the three and levered the least"),
    ("SOL", "SOLUSDT", "{:,.1f}", "Realised vol 70% on the month against 56% on the quarter"),
]

for sym, pair, fmt, subtitle in SPEC:
    bars = klines(f"dl-{pair}.json")
    done, live = bars[:-1], bars[-1]
    cur = live["c"]
    closes = [b["c"] for b in done]
    a = atr(done)

    # the 100-week average, as a line rather than a level: 700 daily closes
    ma700 = [sma(closes, 700, i) for i in range(len(closes))]
    ma20 = [sma(closes, 20, i) for i in range(len(closes))]
    ma50 = [sma(closes, 50, i) for i in range(len(closes))]

    w = done[-WIN:]
    xs = list(range(len(w)))
    hi30 = max(b["h"] for b in done[-30:]); lo30 = min(b["l"] for b in done[-30:])
    hi90 = max(b["h"] for b in done[-90:]); lo90 = min(b["l"] for b in done[-90:])
    pos = 100 * (cur - lo30) / (hi30 - lo30)
    w100 = ma700[-1]

    rets = [math.log(closes[i] / closes[i-1]) for i in range(1, len(closes))]
    rv30 = st.pstdev(rets[-30:]) * math.sqrt(365) * 100
    rv90 = st.pstdev(rets[-90:]) * math.sqrt(365) * 100

    fr = json.load(open(f"fr-{pair}.json"))
    fr = fr[-(WIN * 3):]
    fr_ann = [float(r["fundingRate"]) * 3 * 365 * 100 for r in fr]
    fr_now = fr_ann[-1]
    fr_avg = sum(fr_ann[-90:]) / len(fr_ann[-90:])

    fig = plt.figure(figsize=(13.2, 7.8), dpi=105)
    fig.patch.set_facecolor(BG)
    ax = fig.add_axes([0.062, 0.115, 0.853, 0.715])
    for A in (ax,):
        A.set_facecolor(BG)
        for s in A.spines.values(): s.set_color(GRID)
        A.grid(color=GRID, lw=0.6, alpha=0.7)
        A.tick_params(colors=MUT, labelsize=9.5)

    # ---- candles
    for i, b in enumerate(w):
        c = UP if b["c"] >= b["o"] else DOWN
        ax.plot([i, i], [b["l"], b["h"]], color=c, lw=0.9, solid_capstyle="butt")
        lo, hi = sorted((b["o"], b["c"]))
        ax.add_patch(plt.Rectangle((i - 0.32, lo), 0.64, max(hi - lo, (hi30 - lo30) * 0.0016),
                                   facecolor=c, edgecolor=c, lw=0.4))

    off = len(closes) - WIN
    ax.plot(xs, ma20[off:], color=BLUE, lw=1.2, alpha=0.9, label="MA20")
    ax.plot(xs, ma50[off:], color=AMBER, lw=1.2, alpha=0.85, label="MA50")
    if all(v is not None for v in ma700[off:]):
        ax.plot(xs, ma700[off:], color="#B267FF", lw=1.6, label="100-week")

    ax.axhline(hi30, color=BLUE, lw=1.0, ls="--", alpha=0.8)
    ax.axhline(lo30, color=BLUE, lw=1.0, ls="--", alpha=0.8)
    ax.axhline(hi90, color=MUT, lw=0.9, ls=":", alpha=0.9)
    ax.fill_between(xs, lo30, hi30, color=BLUE, alpha=0.045)

    # ---- the week ahead: one ATR scaled by sqrt(t). width, not direction
    fwd = [len(w) - 1 + i for i in range(8)]
    up_c = [cur + a * math.sqrt(i) for i in range(8)]
    dn_c = [cur - a * math.sqrt(i) for i in range(8)]
    ax.fill_between(fwd, dn_c, up_c, color=GOLD, alpha=0.14)
    ax.plot(fwd, up_c, color=GOLD, lw=1.0, alpha=0.6)
    ax.plot(fwd, dn_c, color=GOLD, lw=1.0, alpha=0.6)
    ax.scatter([len(w) - 1], [cur], s=30, color=FG, zorder=6)

    # ---- right-hand price tags
    def tag(y, text, colour, bold=False):
        ax.annotate(text, xy=(1.002, y), xycoords=("axes fraction", "data"),
                    va="center", ha="left", fontsize=9.5, color="#0B0E11",
                    fontweight="bold" if bold else "normal",
                    bbox=dict(boxstyle="square,pad=0.28", fc=colour, ec="none"))
    tag(cur, fmt.format(cur), GOLD, True)
    tag(hi30, fmt.format(hi30), BLUE)
    tag(lo30, fmt.format(lo30), BLUE)
    if w100: tag(w100, fmt.format(w100), "#B267FF")
    tag(up_c[-1], fmt.format(up_c[-1]), "#3A4250")
    tag(dn_c[-1], fmt.format(dn_c[-1]), "#3A4250")

    ax.set_xlim(-1.2, len(w) + 9.5)
    span = [b["l"] for b in w] + [b["h"] for b in w] + dn_c + up_c + [lo30, hi30]
    if w100: span.append(w100)
    m = (max(span) - min(span)) * 0.05
    ax.set_ylim(min(span) - m, max(span) + m)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: fmt.format(v)))

    # ---- the panel answers the headline: how far to each edge, and how far a
    # normal week reaches. Anything that does not bear on that is off the chart.
    chg = (cur / done[-1]["c"] - 1) * 100
    lines = [
        ("to the high", fmt.format(hi30), f"{(hi30/cur-1)*100:+.1f}%", BLUE),
        ("to the low", fmt.format(lo30), f"{(lo30/cur-1)*100:+.1f}%", BLUE),
        ("a normal week", f"{fmt.format(dn_c[-1])} .. {fmt.format(up_c[-1])}", f"±{a*math.sqrt(7)/cur*100:.1f}%", GOLD),
        ("100-week", fmt.format(w100), f"{(cur/w100-1)*100:+.1f}%", "#B267FF"),
        ("funding", f"{fr_now:+.1f}% ann", f"{fr_avg:+.1f}% avg", DIM),
    ]
    pr = PROB[sym]
    odds = [f"{pr['touch_hi']:.0f}% chance it gets there", f"{pr['touch_lo']:.0f}%",
            f"{pr['neither']:.0f}% of weeks touch neither", "", ""]
    ax.text(0.011, 0.972, f"{fmt.format(cur)}", transform=ax.transAxes,
            color=FG, fontsize=23, fontweight="bold", va="top")
    ax.text(0.125, 0.963, f"{chg:+.2f}%", transform=ax.transAxes,
            color=UP if chg >= 0 else DOWN, fontsize=13, va="top")
    y = 0.888
    for (k, v, extra, col), o in zip(lines, odds):
        ax.text(0.011, y, k, transform=ax.transAxes, color=MUT, fontsize=10.5, va="top")
        ax.text(0.118, y, v, transform=ax.transAxes, color=DIM, fontsize=10.5, va="top")
        ax.text(0.232, y, extra, transform=ax.transAxes, color=col, fontsize=10.5, va="top")
        if o: ax.text(0.300, y, o, transform=ax.transAxes, color=FG, fontsize=10.5, va="top")
        y -= 0.046
    ax.legend(loc="upper right", facecolor=PANEL, edgecolor=GRID, labelcolor=DIM,
              fontsize=9.5, framealpha=0.9)

    step = max(1, len(w) // 8)
    ticks = list(range(0, len(w), step))
    ax.set_xticks(ticks)
    ax.set_xticklabels([dt.datetime.utcfromtimestamp(w[i]["t"] / 1000).strftime("%d %b") for i in ticks])

    fig.text(0.062, 0.968, f"{sym} next week: {fmt.format(hi30)} or {fmt.format(lo30)}?",
             color=FG, fontsize=35, fontweight="bold", va="top")
    fig.text(0.062, 0.888, subtitle, color=MUT, fontsize=14.5, va="top")
    fig.text(0.062, 0.040, "Binance daily klines to 20 Sep 2026. Cone is ±1 ATR(14) scaled by √t.",
             color=MUT, fontsize=8.4)
    fig.text(0.062, 0.016, "Odds from 100,000 bootstrap paths over 730 de-meaned daily returns: the shape of this market, no view on direction.",
             color=MUT, fontsize=8.4)
    fig.text(0.915, 0.022, "@TheTapeSays", color=DIM, fontsize=10.5, ha="right")
    fig.savefig(f"week-{sym.lower()}.png", facecolor=BG)
    print(f"wrote week-{sym.lower()}.png  pos {pos:.0f}%  100w {(cur/w100-1)*100:+.1f}%  funding {fr_now:+.1f}%")
