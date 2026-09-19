---
title: 'The trigger was the weak part'
description: 'Seven days ago I posted three conditions instead of a forecast. Both edges of the box produced a daily close outside it, and not one target printed. The box was two ATRs wide.'
pubDate: 2026-09-19
kind: log
stat: '0.16 ATR'
statLabel: 'how far past the edge the trigger closes actually got'
tags: ['method', 'bitcoin', 'ethereum']
---

On September 11 I posted levels instead of an arrow, on the grounds that levels are checkable and arrows are not. Bitcoin was 77,081 in a box running 76,000 to 80,555. Ether was 2,511 in a box running 2,406 to 2,667. Three branches, each with a trigger and a target:

| | trigger | target | weight |
|---|---|---|---|
| BTC up | daily close > 80,555 | 82,285 | 25% |
| BTC down | daily close < 76,000 | 73,400 | 20% |
| ETH up | daily close > 2,667 | 2,790 | 25% |
| ETH down | daily close < 2,406 | 2,357 | 20% |
| either, chop | no close outside the box | — | 55% |

Seven sessions have closed since. Here is the mark, on OKX daily candles, UTC.

![The three conditions, marked seven days later](/charts/week-mark.png)

## What happened

Bitcoin broke **both** edges. It closed at 75,641 on the 15th, below the 76,000 trigger. Three sessions later it closed at 80,903, above the 80,555 trigger. Two opposite signals inside one week.

Neither target printed. The low of the week was 74,956 against a 73,400 downside target. The high was 81,407 against 82,285 on the way up. Both missed, in opposite directions, on the same instrument.

Ether was worse in the way that stings more. It closed below 2,406 once, at 2,398, and its low for the week was 2,358. The target was 2,357. **One dollar.** On the other side it never closed through 2,667 at all; the closest it came was a 2,663 print on the 19th, four dollars short, after the window had already shut.

Five of seven Bitcoin closes and six of seven Ether closes finished inside the box. The 55% branch, the boring one, was the correct read on probability.

## Why the trigger fired anyway

The interesting part is not that the chop branch won. It is that a framework built to identify resolution produced two contradictory resolutions in five sessions. That is a property of the trigger, not of the market.

Measure everything in the same unit and it stops being a judgement call. ATR(14) on the day of the call was 2,241 on Bitcoin and 97 on Ether.

![A box two ATRs wide cannot hold a close](/charts/two-atr-box.png)

The Bitcoin box was 4,555 wide. That is **2.03 ATR** from one edge to the other. The average daily range during the week that followed was 2,239, or **1.00 ATR** — a single ordinary session covers half the box. The edge sits one average day from the middle. Reaching it is not information, it is Tuesday.

And clearing it required almost nothing. The close that broke the floor cleared it by 359 points, **0.16 ATR**. The close that broke the ceiling cleared it by 348 points, again **0.16 ATR**. Ether's break cleared its floor by eight dollars, **0.08 ATR**.

A trigger that fires on a sixth of a day's range, placed one day's range from the middle of the range, is going to fire. The only open question was which side went first.

## The fix, and what it would have done

The levels were fine. Both edges were real, both got tested, and price respected them for most of the week. What was missing is a condition on the break itself. Two candidates, both cheap:

- **Hold it.** The close has to stay outside the edge for a second consecutive session.
- **Clear it.** The close has to finish some fraction of ATR beyond the edge, not merely past it.

Run the second one at 0.5 ATR over the week that just happened. Bitcoin's downside trigger would have needed a close below 74,880; the actual print was 75,641, so it never fires. The upside trigger would have needed 81,675; the actual close was 80,903, so that one never fires either. Ether would have needed 2,358 and closed at 2,398.

Zero triggers. Which is the correct answer, and it is the answer the 55% branch already gave.

The first filter would have caught it too: neither Bitcoin break held for a second session. The 15th closed below, the 16th closed back inside at 76,201.

## The caveat that matters

One week is one sample. A 0.5 ATR filter tuned on the week it failed is a curve fit until it survives a backtest it did not help design, and the obvious cost of any filter is the break it makes you miss — the real ones start as small ones too. That test has not been run yet, so the number above is a hypothesis with an arithmetic check attached, not a rule.

What does generalise is the ratio. A box two ATRs wide does not contain enough room for a close outside it to mean anything, and that is knowable **before** the week starts, not after. The condition worth writing down next time is not a better trigger. It is the question of whether the box is wide enough to be worth trading the edges of at all.

Same three branches. One filter, once it has been tested.
