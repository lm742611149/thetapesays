---
title: 'Three boxes, one line'
description: 'All three coins left their thirty-day range in a single session. The odds of coming back to the old ceiling, of reaching the 100-week average, and of closing above either, rerun on today price.'
pubDate: 2026-09-21
kind: research
stat: '34% to 67%'
statLabel: 'the same claim about 82,300, one day and one 4% session later'
tags: ['bitcoin', 'ethereum', 'solana', 'method']
---

Yesterday I put the odds of Bitcoin reaching 82,300 this week at 81%. It took one session. The high so far is 85,299 and the day is not closed.

That is the least interesting number in this post. 81% was the easiest of the four claims I made, and a high-probability call landing tells you nothing about whether the model is any good; it would have been news if it had **not** happened. The claim with something at stake was the second one, a Sunday close above 82,300 at 34%, and that still has six sessions to run.

What is worth writing about is that all three coins did it at once. Bitcoin, Ether and Solana each closed outside the top of their thirty-day range in the same session, and the ranges were not narrow.

| | price | day | old ceiling | 100-week | distance to it |
|---|---|---|---|---|---|
| BTC | 84,438 | +4.0% | 82,300 | 89,449 | **-5.6%** |
| ETH | 2,715 | +2.7% | 2,668 | 2,756 | **-1.5%** |
| SOL | 115.9 | +4.3% | 114.32 | 143.66 | **-19.3%** |

Three breakouts, one line overhead. The 100-week average is the level none of them has closed above since January, and it is the only thing the three charts still have in common.

## What the odds say now

Same engine as yesterday, rerun on today's price. The levels are given by hand this time, because once price is outside the box the old question returns 100% and stops meaning anything.

| | comes back to the old ceiling | closes Sunday above it | reaches the 100-week |
|---|---|---|---|
| BTC | 80% | **67%** (34% yesterday) | 42% |
| ETH | 96% | 57% | 97% |
| SOL | 99% | 56% | 7% |

The first column is the one I did not expect to be so lopsided. Bitcoin has a one-in-five chance of never seeing 82,300 again this week. For Ether the equivalent is one in twenty-five, for Solana one in a hundred. All three broke out on the same day and only one of them broke out far enough to matter, because distance is measured in volatility and not in percent: Bitcoin cleared its ceiling by 2.6% in a market realising 36%, Solana by 1.4% in a market realising 67%.

That is the whole difference between a break and a nudge, and you cannot see it on the chart.

## Bitcoin

![BTC after the break: 90,000 or back to 82,300](/charts/break-btc.png)

The 34% to 67% move is the part I want to be careful about, because it is easy to read as the model getting smarter. It did not. Nothing about the simulation changed. Price moved 4% and the same question, asked from a different starting point, has a different answer. A probability is a description of where you are standing, and updating one is not the same as being right.

Above, the round number and the long average are almost the same level: 90,000 is 6.6% away at 36%, and the 100-week line at 89,449 is 5.9% away at 42%. It lost that line in January at 86,670 and the eight months since have included a 57,800 low. Getting back to it this week is not the base case. It is close enough to be the thing worth watching.

Funding is +11.0% annualised against a ninety day average of +7.5%, and exactly one print in the last ninety was negative. Longs have been paying for a month and paying more this week.

## Ether

![ETH after the break: 2,756 or back to 2,668](/charts/break-eth.png)

Ether is the cleanest illustration of the thing this whole series keeps circling. It reaches its 100-week average in 97% of simulated weeks and closes above it in 43%. The level is 1.5% away, which means getting there requires nothing at all, and staying there requires the market to decide something.

Last week the same gap on Bitcoin was 81 against 34. A level that close is not a target, it is scenery.

Funding tells the more interesting story: +9.5% now, +5.1% on the ninety day average, with nine negative prints in that window against Bitcoin's one. Ether has spent parts of the last month with shorts paying longs. It has run 49% off its 1 August low with the perpetual market leaning against it a good part of the way, and the rally does not appear to be levered.

## Solana

![SOL after the break: 143.7 or back to 114.3](/charts/break-sol.png)

Solana's break is the weakest of the three by the only measure that matters here. Its ceiling is 1.4% below spot and one ATR out to Sunday is ±11%, so 99% of paths come back to touch it. The 100-week average is 19.3% overhead and gets reached in 7% of weeks; on that horizon it is not in the conversation.

The funding shift is the real news. Thirty one of the last ninety prints were negative, a third of them, against one for Bitcoin. That describes a month where the perpetual market kept leaning short into a rising spot price. The current print is +11.0%, the highest of the three and triple its own ninety day average of +3.6%. The crowd that spent a month fading this has stopped fading it inside the last few days. Whether that is confirmation or exhaustion is the question, and I do not have a number for it.

## What I did

T2 bought Bitcoin back this morning on yesterday's close, 0.00369 at 81,264, a 300 USDT slice, stop written down at 75,641. That is now three open positions, all spot, all posted on [the positions page](/positions) with the fills. The system was flat Bitcoin for ten days before this and bought it 3.9% below where it trades as I write, which is what a close-confirmed rule costs you and the reason it is written down in advance.

I am not posting this because it worked. It has been open for eight hours.

## The method, briefly

Bootstrap, not a lognormal: daily returns drawn with replacement from the last 730 sessions, so the paths inherit this market's fat tails. De-meaned, so the simulation carries no view on direction. A barrier counts as touched on any day's high or low, using a sampled true range around each step, which is the entire reason "reaches" and "closes above" come back as different numbers. 100,000 paths, seven daily steps, fixed seed. Input is Binance daily klines with the 21 September session still open.

## What I will mark next Sunday

Yesterday's four claims still stand and get marked on their own terms. These four are new, from today's price:

- Bitcoin's Sunday close is above 82,300 (called at 67%)
- Bitcoin prints 90,000 at some point in the week (36%)
- Ether's Sunday close is above 2,756, its 100-week average (43%)
- Solana's Sunday close is above 114.32 (56%)

Eight statements between the two posts, all of them true or false by Sunday's close, none of them requiring a view on direction. If the first one lands it proves very little on its own; the set is what gets scored.
