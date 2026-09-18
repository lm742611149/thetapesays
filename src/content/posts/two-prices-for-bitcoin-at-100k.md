---
title: 'There are two prices for Bitcoin at $100,000'
description: 'History says a 28% gain from here happens inside 98 days about 42% of the time. Deribit prices that same move at 7.8%. The gap is the trade.'
pubDate: 2026-09-18
kind: research
stat: '42% vs 7.8%'
statLabel: 'history vs options, 100k by Christmas'
tags: ['options', 'bitcoin', 'probability']
---

Bitcoin closed at 78,058 today, up a bit over 2% on the day and 33% off the 58,524 low from the end of June. It is still 37% below the October 2025 high of 124,720. Someone asked how long until 100,000, so I went and got both answers, because there are two and they do not agree.

Getting from 78,058 to 100,000 is a **28.1% move**. That is the whole question.

## What history says

I pulled every Coinbase daily close from 2015-07-20 to today, 4,079 bars. For each day I asked one thing: starting from that close, did price gain 28.1% within the next N days.

Doing that across all 3,714 days with a full year of future data, **80% of them saw the move within 365 days, median 63 days**. That number is useless on its own, though. Bitcoin spent most of its history in a bull market, and we are not in one of those right now.

So I narrowed it to days that looked like today: sitting 30% to 45% below their own running all-time high. There are about 500 of them. Same question, same windows:

| Window | Days | All days | Days 30-45% off the high |
|---|---|---|---|
| to Oct 30 | 42 | 27.0% | **15.6%** |
| to Nov 27 | 70 | 41.0% | **26.6%** |
| to Dec 25 | 98 | 48.7% | **41.8%** |
| to Mar 26 | 189 | 63.8% | **50.2%** |
| to Jun 25 | 280 | 75.8% | **54.0%** |

Read the last row carefully. From a drawdown like this one, a 28% recovery happened within nine months a little better than half the time. Of the times it did happen, the median was 62 days. So the historical answer to "how long" is bimodal: usually about two months, or not for a very long time.

## What the options say

Deribit quotes BTC options out to June 2027. The probability the market assigns to any strike is sitting right there in the call spread: take the 98k and 102k calls, convert the marks to dollars, and the difference divided by 4,000 is the risk-neutral probability of finishing above 100k.

| Expiry | Days out | Implied P(100k) |
|---|---|---|
| 30 Oct 2026 | 42 | **1.6%** |
| 27 Nov 2026 | 70 | **5.2%** |
| 25 Dec 2026 | 98 | **7.8%** |
| 26 Mar 2027 | 189 | **14.9%** |
| 25 Jun 2027 | 280 | **19.7%** |

By Christmas: 7.8%. By next summer: under 20%. The market's median path does not reach 100,000 inside the entire quoted curve.

## The gap

Side by side, for the same question and the same windows:

| | Oct 30 | Nov 27 | Dec 25 | Mar 26 | Jun 25 |
|---|---|---|---|---|---|
| History, same drawdown | 15.6% | 26.6% | 41.8% | 50.2% | 54.0% |
| Options today | 1.6% | 5.2% | 7.8% | 14.9% | 19.7% |
| Ratio | 10x | 5x | 5x | 3x | 3x |

Three to ten times apart, and the gap narrows as you go further out.

## Why they differ, honestly

I can think of three reasons and none of them make either number wrong.

**Risk-neutral is not real-world.** Option prices embed a drift equal to the risk-free rate, not to whatever Bitcoin actually compounds at. Over my sample Bitcoin compounded at 65% a year. Strip that drift out and any upside probability collapses. The difference between the two columns is, mechanically, the price of risk. It is not a forecasting error.

**My 500 days are not 500 experiments.** They are a handful of drawdowns with 500 overlapping start dates inside them: 2018, 2019, 2021-22, the 2024 chop, this one. The effective sample size is closer to five than five hundred. Treat the green column as a description of five episodes, not a law.

**The drift may not repeat.** The 65% number comes from a period that began with Bitcoin at $280. Nothing entitles the next decade to it, and a market cap north of a trillion argues against it.

## What I take from it

The honest version of "how long until 100k" is this: if the move happens at all, history says about two months is typical, because these recoveries are fast when they come. But nothing in the current option surface is paying for that outcome, and the further out you look the less the market disagrees with history.

That gap is what a call option costs. Buying December 100k calls is a bet that the frequency column is closer to the truth than the pricing column. Selling them is the opposite bet. I am not putting on either one, I just wanted to know what each side was quoting.

## Reproducing this

Daily closes from `api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400`, pulled in 300-bar segments. Option marks from `deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option`, which quotes in BTC, so multiply by spot before differencing across strikes. Spot cross-checked against OKX at 78,060. Everything above uses closes, not intraday highs, so the historical hit rates are the conservative version.
