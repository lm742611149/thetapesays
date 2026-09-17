---
title: 'Funding rate carry is mostly gone'
description: 'Seven years of Binance BTCUSDT funding, every one of the 7,689 settlements. The trade paid 30.6% in 2021 and 2.82% in 2026.'
pubDate: 2026-09-16
kind: research
stat: '30.6% → 2.82%'
statLabel: 'annualized funding carry, 2021 vs 2026'
tags: ['funding', 'backtest', 'yield']
---

Cash and carry on perpetuals — long spot, short the perp, collect funding — is the trade people point at when they want to say crypto has a risk-free rate. I pulled all 7,689 funding settlements on Binance BTCUSDT since 2019-09 to see what it actually paid.

Full period: **11.57% annualized**, with funding negative 14.2% of the time.

That headline is doing a lot of hiding.

| Year | Annualized | Negative periods |
|---|---|---|
| 2020 | 17.19% | 14.3% |
| 2021 | **30.61%** | 7.3% |
| 2022 | 4.16% | 22.1% |
| 2023 | 7.87% | 10.1% |
| 2024 | 11.92% | 8.4% |
| 2025 | 5.13% | 12.9% |
| **2026** | **2.82%** | **27.0%** |

The decay isn't a regime, it's the trade working. More capital showed up to do it, the basis compressed, and the yield went with it. Anyone quoting the seven-year average as a forward expectation is quoting 2021.

## What's left after costs

Opening and closing both legs is four fills, roughly 0.3% round trip. You're tying up spot plus margin — call it 1,200 to run a 1,000 position. At a 10% gross year that leaves 7–8% net, which was fine.

At 2.82% gross it leaves under 2%. Binance's flexible USDT earn pays 2.28% base with a 4.00% tier on the first 800. **The carry trade currently loses to the savings account**, before you've thought about anything going wrong.

OKX has been slightly better over the last three months (5.05%, ranging 1.38% in June to 6.71% in August), so there's dispersion worth watching. The worst rolling 90-day window in the entire Binance history is −0.39%, annualized −1.56%, which is the genuinely good news here: this trade rarely bleeds, it just stopped paying.

## The risk people describe wrong

Delta neutral is not the same as no liquidation risk.

Your spot sits in one account and your short sits in another. Price rips 20%, the short's unrealized loss chews through its margin, and that leg gets liquidated. Now you're holding naked spot at a local high with none of the hedge you were being paid to carry. The exposure was never to direction, it was to **margin isolation**, and that's the part that actually ends these positions.

If I ran it I'd want a mechanical switch rather than a view: open when the rolling 30-day annualized is above 15%, close below 5%. Today that switch says stay out.

One more thing, since the altcoin funding screens get shown around a lot. Across all 851 perpetual markets, 36 print above 20% annualized and 9 above 50%. A chunk of the top of that list is tokenized equity perps with no spot market on the same venue, so the hedge you'd need doesn't exist. And the negative tail on the same illiquid names is far more extreme — STEEM at −1411%, ASTR at −1070%. High altcoin funding and dangerous altcoin funding have the same cause.

*Data: Binance public funding rate history, BTCUSDT perpetual, 2019-09 to 2026-09, all 7,689 settlements. OKX figures from its public funding endpoint.*
