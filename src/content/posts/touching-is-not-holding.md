---
title: 'Touching is not holding'
description: 'Bitcoin reaches the top of its range in 81% of simulated weeks and closes above it in 34%. Three coins, three boxes, and the odds of leaving them, from a bootstrap rather than an arrow.'
pubDate: 2026-09-20
kind: research
stat: '81% vs 34%'
statLabel: 'odds BTC reaches 82,300 against closing above it'
tags: ['bitcoin', 'ethereum', 'solana', 'method']
---

Last week I marked a set of conditions I had posted seven days earlier and the result was unflattering: Bitcoin closed outside **both** edges of its box inside five sessions, and neither target printed. The box was two ATRs wide, which turned out to be the whole problem. A trigger placed one ATR from price is not a trigger, it is a coin toss with extra steps.

So this week I am not posting triggers. I am posting the odds of reaching each edge, which is a different claim and a checkable one.

| | price | box | width | reaches the high | reaches the low | touches neither |
|---|---|---|---|---|---|---|
| BTC | 80,354 | 73,027 .. 82,300 | 4.4 ATR | **81%** | 16% | 11% |
| ETH | 2,575 | 2,325 .. 2,668 | 3.4 ATR | **82%** | 37% | 4% |
| SOL | 108.25 | 87.57 .. 114.32 | 5.4 ATR | **71%** | 8% | 24% |

Every box here is wider than last week's two ATRs. That did not make them safer. Ether's box is the narrowest of the three at 3.4 ATR and it has a 22% chance of printing **both** edges inside one week. Width is half the picture; where price sits inside the width is the other half.

## Bitcoin

![BTC next week: 82,300 or 73,027](/charts/week-btc.png)

The headline number is the gap between two odds that sound like the same event. Bitcoin reaches 82,300 in 81% of simulated weeks. It closes above it on Sunday in 34%.

That gap is distance, not conviction. The top of the box is 2.4% away and a normal week here is ±7%. Getting there requires nothing to happen. Staying there requires something to happen.

The part I find more interesting sits above the chart. Bitcoin is above its 20, 50, 100 and 200 day averages, which by any short horizon reading is a clean tape. The 100-week average is at 89,432 and price is 10.2% below it. Same instrument, two timeframes, opposite readings.

It lost that line in January at 86,670 and has not closed back above it since. Eight months, and the low in between was 57,800. So when someone says Bitcoin is in the buy range because it is under the long average, they are not wrong about the position. They are quiet about the fact that the position has been true since January.

Funding is +11.0% annualised, +7.6% on the thirty day average, and it has printed negative exactly once in the last month. Longs are paying, steadily, and nobody is being forced out.

## Ether

![ETH next week: 2,668 or 2,325](/charts/week-eth.png)

Ether has run the furthest and paid the least for it. It is 24% above its 200 day average, the largest of the three, and its funding is +4.5% annualised against Bitcoin's +11.0%. Whatever moved this, it was not perpetual leverage.

The funding history says more than the level does. Nine of the last ninety funding prints were negative, including a run in early September that touched -10% annualised. Bitcoin printed negative once in the same window. Ether's rally went up through a market that kept paying shorts, which is a different thing from a market that keeps paying longs.

It is also the closest of the three to its 100-week line, at 2,756, only 6.6% overhead. Bitcoin needs 11% to get back to its own. Solana needs 33%.

The cost of all that is a wider cone. Realised volatility is 51.8% on the month, and one ATR out to Sunday is ±10.4%, which is why this is the only one of the three where touching both edges inside a week is a real outcome at 22%, and where sitting still all week is nearly off the table at 4%.

## Solana

![SOL next week: 114.32 or 87.57](/charts/week-sol.png)

Solana has the widest box, 5.4 ATR, and the highest odds of going nowhere: 24% of simulated weeks touch neither edge. It is also the only one of the three where realised volatility is expanding rather than settling, 70.0% on the month against 56.0% on the quarter.

Those two facts do not contradict each other, but they do cut in opposite directions for the week ahead, and it is worth being explicit about which is load bearing. The box is wide because the last ninety days contained a 64 to 114 move. The volatility is rising because the last thirty days contained most of it. A wide box built out of recent violence is not the same as a wide box built out of a quiet quarter.

Funding is the other tell. Thirty one of the last ninety prints were negative, a third of them, against one for Bitcoin. Solana's perpetual market has spent the last month with shorts paying longs about as often as the reverse, which is not what a crowded long looks like. The current print is +11.0%, the highest of the three, so that is changing as of this week.

Long term it is the furthest from repair: 24.7% below its 100-week average at 143.74, against Bitcoin's 10.2% and Ether's 6.6%.

## How the odds were made

Three things about the method, because a probability with no method behind it is just an adjective.

The paths are a bootstrap, not a lognormal. Daily returns get drawn with replacement from the last 730 sessions, so the simulation inherits this market's fat tails instead of a normal distribution's thin ones. A closed form would put the odds of reaching 82,300 several points lower and it would be wrong in a predictable direction.

The returns are de-meaned. Bitcoin's last two years carry a positive drift, and leaving it in would have the simulation quietly assuming the thing it is supposed to be measuring. Stripping it out means these numbers describe the shape of the market and nothing about its direction.

A barrier counts as touched on any day's high or low, not on the close. That is the difference between "reaches 82,300" at 81% and "closes above 82,300" at 34%, and conflating the two is how a level gets talked about as though it were a destination.

100,000 paths, seven daily steps each, seed fixed so the run reproduces. The input is Binance daily klines to 20 September 2026.

## What I will mark next Sunday

Same discipline as last week, and the claims are these:

- Bitcoin prints 82,300 at some point during the week (called at 81%)
- Bitcoin's Sunday close is above 82,300 (called at 34%)
- Ether prints both 2,668 and 2,325 inside the week (called at 22%)
- Solana touches neither edge (called at 24%)

Four statements, each one either true or false by next Sunday's close, none of them requiring me to have a view on direction. The one I expect to be least comfortable about is the second: a 34% call is the kind that looks stupid in both outcomes, which is exactly why it is worth writing down before the fact.
