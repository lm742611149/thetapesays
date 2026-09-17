---
title: 'Covered calls on Bitcoin sell the only part that pays'
description: 'Seven years of Binance daily bars, a monthly covered call simulated three ways. Buy and hold returns 7.90x. The friendliest version of the option strategy returns 0.29x.'
pubDate: 2026-09-17
kind: research
stat: '0.29x vs 7.90x'
statLabel: 'covered call vs hold, 7 years'
tags: ['options', 'backtest', 'bitcoin']
---

Someone told me selling calls against spot was "steady income with good returns." It is steady. That is the problem.

I pulled every daily bar for BTCUSDT on Binance from 2019-09-01 to 2026-09-16, 2,573 of them, and simulated writing a one-month call at the start of each month. Three strike levels. The premium assumptions are generous — more generous than you would actually get after spreads.

| Strike | Monthly premium | Months assigned | Ending | vs hold |
|---|---|---|---|---|
| +5% | 1.8% (24%/yr) | 38 of 85 | **0.29x** | −96% |
| +10% | 2.5% (34%/yr) | 29 of 85 | 2.40x | −70% |
| +3% | 1.2% (15%/yr) | 39 of 85 | 0.08x | −99% |

Buy and hold over the same window: **7.90x**.

The +5% row is not "you made less." It ends at 0.29x. You are down 71% while the person who did nothing is up 690%.

## Why it breaks

Two numbers explain the whole thing.

The median up month in Bitcoin is **+12%**. You sold a +5% strike. So on more than half your winning months you handed over most of the move, and on every losing month you ate all of it. The premium is not compensation for that, it is a rounding error against it.

The second number is worse. Of the 85 months, 38 closed above +5%. **Those 38 months produced 98% of all the gains from up months.** The other 47 up months, added together, were worth 2%. Writing calls is a trade where you sell the 98% to lock in the 2%.

Daily bars say it more bluntly. Drop the ten single best days out of 2,572 — four tenths of one percent of the sample — and 7.90x collapses to 2.06x. Drop twenty and you are at 0.75x, which is seven years of holding Bitcoin to end up poorer than you started.

The five months you most regret capping:

| Month | Move | You received |
|---|---|---|
| 2020-12 | +47% | +6.8% |
| 2024-02 | +44% | +6.8% |
| 2020-11 | +43% | +6.8% |
| 2021-10 | +40% | +6.8% |
| 2023-01 | +40% | +6.8% |

## The part that makes it feel safe

Win rate on this strategy is structurally high. You collect in most months. The equity curve goes up in a smooth line and looks nothing like the asset underneath it. That smoothness is what people are describing when they say "stable," and it is the same smoothness a martingale grid produces right up until the day it doesn't.

A curve cannot tell you the difference between a strategy that is genuinely steady and one that has not yet met the month it was built to lose in. With short options you don't even need a disaster. You just need the market to do the thing it does every year or two, and a year of premium is gone.

## Where it would actually work

Nothing here says short volatility is broken as an idea. It says it is wrong on *this* asset at *this* volatility. The trade needs the underlying's returns to be spread across many small moves. Bitcoin's are stacked into a handful of big ones.

I would look at it again when annualized vol is under 25% and the median up month is 3–4% instead of 12%. That is a different asset than the one in this dataset.

One practical note, since this came up as a real question and not a theoretical one. Deribit's minimum is 0.1 BTC, about $7,600 at today's price, and writing covered calls means owning that much spot first. Binance goes down to 0.01 BTC, roughly $760, but the bid-ask on those books routinely runs 5–15%. On a $760 contract the spread eats more than the premium. Small size doesn't make this trade safer, it makes it arithmetically worse.

*Data: Binance public klines API, BTCUSDT 1d, 2019-09-01 to 2026-09-16. Simulation is a monthly rewrite at the open, assignment capped at the strike, premium added regardless of outcome — an assumption that flatters the strategy.*
