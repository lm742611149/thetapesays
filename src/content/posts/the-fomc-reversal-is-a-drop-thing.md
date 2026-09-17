---
title: 'The FOMC reversal is a drop thing, not a Fed thing'
description: '93 scheduled decisions since 2015 against 3,452 days with no Fed meeting. Bitcoin bounces less after FOMC drops than after ordinary ones.'
pubDate: 2026-09-16
updatedDate: 2026-09-17
kind: research
stat: '49% vs 57%'
statLabel: 'five-day bounce rate, FOMC vs ordinary'
tags: ['macro', 'backtest', 'fomc']
---

There is a piece of folklore that says Bitcoin reverses after FOMC. Dumps into the decision, recovers a few days later. Enough people repeat it that it gets traded.

It is testable, so I tested it.

93 scheduled FOMC decisions since 2015. When Bitcoin falls into one, it is higher five days later **49%** of the time.

Then the control, which is the part nobody runs. Every week containing no Fed meeting at all, same drop condition, same five-day horizon. 3,452 days.

**57%.**

The bounce is real. It just has nothing to do with the Fed. Bitcoin recovers after drops in general, and some of those drops happen to land on a Wednesday afternoon in Washington. Conditioning on the Fed makes the bounce *worse*, not better — eight points worse.

## On p-values

I ran nine parameter settings, eighteen tests. Two came back under p&lt;0.05 and they point in opposite directions. That is what eighteen tests on noise looks like. If I had stopped at the first significant one and published it, you would be reading a very confident post about a pattern that isn't there.

This is most of what quantitative crypto content is: someone ran the version that worked.

## Last night

I posted the above five hours before the September 2026 decision, on purpose, so the timestamp would settle any argument about hindsight. Then the Fed hiked for the first time in three years.

The decision hour (2026-09-16 18:00 UTC) on BTCUSDT:

| | |
|---|---|
| Open → close | 75,770 → 75,632, **−0.18%** |
| High / low | 76,561 / 75,065 |
| Range | **1.97%**, versus a 0.39% median over the prior 1,000 hours |
| Six hours later | 75,845, **+0.10%** from the decision open |

Volatility showed up. It ranked in the top 1.3% of hours in the sample, five times the median. Direction did not. Price printed +1.04% and −0.93% inside one hour and closed where it opened.

Now the honest part, because this is where people cheat.

**This does not confirm the study.** The study's criterion is the five-day mark, which settles Monday 2026-09-21. Grading myself today on intraday range, when I wrote the test around a five-day horizon, would be swapping the yardstick after seeing the result.

And even on Monday, one event cannot validate a claim built on 93 of them. A single outcome adds a 94th data point. It does not make a 49% base rate right or wrong — 49% is a coin, and every possible result is inside expectations. The moment you start saying "my study was confirmed because I called this one," you have quietly replaced a statistical claim with a prediction, which is the exact move this post exists to complain about.

So: criterion set in advance, outcome posted either way, settlement date announced before the fact. Monday it either lands at 49% or it doesn't, and the sample goes to 94.

*Data: Binance public klines (BTCUSDT 1d and 1h), FOMC calendar 2015–2026. Control set is every non-meeting week over the same span.*
