"""Charts for the day price leaves the box.

charts.py draws the 30-day box and asks which edge gets touched. Once price is
outside it that framing is dead: "reaches the high" comes back 100%. This one
keeps the house style and swaps two things. The levels are given by hand (the
old ceiling underneath, the 100-week average overhead), and the week ahead is
drawn as the simulated distribution, p10 to p90 with the median, instead of an
ATR cone: after a break the asymmetry is the story and a symmetric cone hides it.

Run after prob_levels.py has written levels-{PAIR}.json for each pair.
"""
import json, math, datetime as dt
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

BG, PANEL, GRID = "#0B0E11", "#12161C", "#1E2530"
FG, MUT, DIM = "#F0B90B", "#8A7030", "#C9A227"
UP, DOWN, GOLD, BLUE, AMBER, PURP = "#0ECB81", "#F6465D", "#F0B90B", "#7AA2FF", "#E5C07B", "#B267FF"
WIN = 95

#      sym   pair       fmt        support  target   support key  target key  subtitle
SPEC = [
    ("BTC", "BTCUSDT", "{:,.0f}", 82300.0, 90000.0, "82300", "90000",
     "Yesterday 82,300 was the ceiling and a weekly close above it priced at 34%. It is 67% now."),
    ("ETH", "ETHUSDT", "{:,.0f}", 2668.0, 2756.0, "2668", "2756",
     "Within 1.5% of the 100-week average, the closest any of the three has been since January."),
    ("SOL", "SOLUSDT", "{:,.1f}", 114.32, 143.66, "114", "143",
     "Broke out with a third of the last ninety funding prints still negative."),
]

for SYM, PAIR, fmt, SUPPORT, TARGET, KS, KT, SUBTITLE in SPEC:
    L = json.load(open(f"levels-{PAIR}.json"))
    bars = [{"t": int(r[0]), "o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4])}
            for r in json.load(open(f"dl-{PAIR}.json"))]
    done, live = bars[:-1], bars[-1]
    cur = live["c"]
    closes = [b["c"] for b in done]
    sma = lambda v, n, i: sum(v[i - n + 1:i + 1]) / n if i >= n - 1 else None
    ma20 = [sma(closes, 20, i) for i in range(len(closes))]
    ma50 = [sma(closes, 50, i) for i in range(len(closes))]
    ma700 = [sma(closes, 700, i) for i in range(len(closes))]
    w100 = ma700[-1]

    w = bars[-WIN:]                       # includes the live session: it is the news
    xs = list(range(len(w)))
    fan = L["fan"]
    fwd = [len(w) - 1 + i for i in range(8)]

    fr = json.load(open(f"fr-{PAIR}.json"))
    fr_ann = [float(r["fundingRate"]) * 3 * 365 * 100 for r in fr]
    fr_now, fr_avg = fr_ann[-1], sum(fr_ann[-90:]) / 90

    fig = plt.figure(figsize=(13.2, 7.8), dpi=105)
    fig.patch.set_facecolor(BG)
    ax = fig.add_axes([0.062, 0.115, 0.853, 0.715])
    ax.set_facecolor(BG)
    for s in ax.spines.values(): s.set_color(GRID)
    ax.grid(color=GRID, lw=0.6, alpha=0.7)
    ax.tick_params(colors=MUT, labelsize=9.5)

    rngspan = max(b["h"] for b in w) - min(b["l"] for b in w)
    for i, b in enumerate(w):
        c = UP if b["c"] >= b["o"] else DOWN
        ax.plot([i, i], [b["l"], b["h"]], color=c, lw=0.9, solid_capstyle="butt")
        lo, hi = sorted((b["o"], b["c"]))
        ax.add_patch(plt.Rectangle((i - 0.32, lo), 0.64, max(hi - lo, rngspan * 0.0016),
                                   facecolor=c, edgecolor=c, lw=0.4))

    off = len(closes) - (WIN - 1)
    ax.plot(xs[:-1], ma20[off:], color=BLUE, lw=1.2, alpha=0.9, label="MA20")
    ax.plot(xs[:-1], ma50[off:], color=AMBER, lw=1.2, alpha=0.85, label="MA50")
    if all(v is not None for v in ma700[off:]):
        ax.plot(xs[:-1], ma700[off:], color=PURP, lw=1.6, label="100-week")

    ax.axhline(SUPPORT, color=BLUE, lw=1.1, ls="--", alpha=0.85)
    ax.axhline(TARGET, color=GOLD, lw=1.0, ls=":", alpha=0.75)
    ax.text(len(w) - 34, SUPPORT, "last week's ceiling", color=BLUE, fontsize=9.5, va="bottom", alpha=0.9)

    ax.fill_between(fwd, fan["p10"], fan["p90"], color=GOLD, alpha=0.10)
    ax.fill_between(fwd, fan["p25"], fan["p75"], color=GOLD, alpha=0.16)
    ax.plot(fwd, fan["p50"], color=GOLD, lw=1.3, alpha=0.85)
    for k in ("p10", "p90"):
        ax.plot(fwd, fan[k], color=GOLD, lw=0.9, alpha=0.5)
    ax.scatter([len(w) - 1], [cur], s=30, color=FG, zorder=6)

    def tag(y, text, colour, bold=False):
        ax.annotate(text, xy=(1.002, y), xycoords=("axes fraction", "data"), va="center", ha="left",
                    fontsize=9.5, color="#0B0E11", fontweight="bold" if bold else "normal",
                    bbox=dict(boxstyle="square,pad=0.28", fc=colour, ec="none"))
    tag(cur, fmt.format(cur), GOLD, True)
    tag(SUPPORT, fmt.format(SUPPORT), BLUE)
    if abs(TARGET - w100) / w100 > 0.012: tag(TARGET, fmt.format(TARGET), "#3A4250")
    if w100: tag(w100, fmt.format(w100), PURP)
    tag(fan["p90"][-1], fmt.format(fan["p90"][-1]), "#3A4250")
    tag(fan["p10"][-1], fmt.format(fan["p10"][-1]), "#3A4250")

    ax.set_xlim(-1.2, len(w) + 9.5)
    span = [b["l"] for b in w] + [b["h"] for b in w] + fan["p10"] + fan["p90"] + [SUPPORT]
    if TARGET < max(fan["p90"]) * 1.15: span.append(TARGET)
    if w100 and w100 < max(fan["p90"]) * 1.15: span.append(w100)
    m = (max(span) - min(span))
    ax.set_ylim(min(span) - m * 0.05, max(span) + m * 0.45)   # headroom for the panel
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: fmt.format(v)))

    chg = (cur / done[-1]["c"] - 1) * 100
    lv = L["levels"]
    third = f"{lv[KS]['close_above']:.0f}%, from 34% yesterday" if SYM == "BTC" else f"{lv[KS]['close_above']:.0f}%"
    rows = [
        (f"back to {fmt.format(SUPPORT)}", fmt.format(SUPPORT), f"{(SUPPORT/cur-1)*100:+.1f}%", BLUE,
         f"{lv[KS]['touch']:.0f}% of weeks get there"),
        (f"up to {fmt.format(TARGET)}", fmt.format(TARGET), f"{(TARGET/cur-1)*100:+.1f}%", GOLD,
         f"{lv[KT]['touch']:.0f}%"),
        (f"closes above {fmt.format(SUPPORT)}", "Sunday", "", DIM, third),
        ("middle of the range", f"{fmt.format(L['p25'])} .. {fmt.format(L['p75'])}", "half of paths", GOLD, ""),
        ("funding", f"{fr_now:+.1f}% ann", f"{fr_avg:+.1f}% avg", DIM, ""),
    ]
    # the panel sits over the chart, so it gets its own backing: on SOL the
    # 100-week line runs straight through where the rows are
    ax.add_patch(plt.Rectangle((0.0, 0.688), 1.0, 0.312, transform=ax.transAxes,
                               facecolor=BG, edgecolor="none", alpha=0.93, zorder=5))
    ax.text(0.011, 0.972, fmt.format(cur), transform=ax.transAxes, color=FG, fontsize=23, fontweight="bold", va="top", zorder=6)
    ax.text(0.135, 0.963, f"{chg:+.2f}%", transform=ax.transAxes, color=UP if chg >= 0 else DOWN, fontsize=13, va="top", zorder=6)
    y = 0.888
    for k, v, extra, col, o in rows:
        ax.text(0.011, y, k, transform=ax.transAxes, color=MUT, fontsize=10.5, va="top", zorder=6)
        ax.text(0.170, y, v, transform=ax.transAxes, color=DIM, fontsize=10.5, va="top", zorder=6)
        ax.text(0.286, y, extra, transform=ax.transAxes, color=col, fontsize=10.5, va="top", zorder=6)
        if o: ax.text(0.370, y, o, transform=ax.transAxes, color=FG, fontsize=10.5, va="top", zorder=6)
        y -= 0.046
    ax.legend(loc="lower right", facecolor=PANEL, edgecolor=GRID, labelcolor=DIM, fontsize=9.5, framealpha=0.9)

    step = max(1, len(w) // 8)
    ticks = list(range(0, len(w), step))
    ax.set_xticks(ticks)
    ax.set_xticklabels([dt.datetime.utcfromtimestamp(w[i]["t"] / 1000).strftime("%d %b") for i in ticks])

    fig.text(0.062, 0.968, f"{SYM} after the break: {fmt.format(TARGET)} or back to {fmt.format(SUPPORT)}?",
             color=FG, fontsize=28, fontweight="bold", va="top")
    fig.text(0.062, 0.888, SUBTITLE, color=MUT, fontsize=14.5, va="top")
    fig.text(0.062, 0.040, "Binance daily klines, 21 Sep 2026 session still open. Shaded band is the simulated 10th to 90th percentile, darker is 25th to 75th, line is the median.",
             color=MUT, fontsize=8.4)
    fig.text(0.062, 0.016, "Odds from 100,000 bootstrap paths over 730 de-meaned daily returns: the shape of this market, no view on direction.",
             color=MUT, fontsize=8.4)
    fig.text(0.915, 0.022, "@TheTapeSays", color=DIM, fontsize=10.5, ha="right")
    fig.savefig(f"break-{SYM.lower()}.png", facecolor=BG)
    print(f"wrote break-{SYM.lower()}.png   {fmt.format(cur)}  100w {fmt.format(w100)} ({(cur/w100-1)*100:+.1f}%)")
