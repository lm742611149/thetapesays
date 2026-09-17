---
title: 'What the CLARITY vote actually priced'
description: 'Bitcoin fell 3.38% the night cloture failed. Almost none of it was the bill. The arithmetic closes to the decimal.'
pubDate: 2026-09-16
kind: research
stat: '1.42%'
statLabel: 'the part of the move that was actually the bill'
tags: ['macro', 'regulation', 'attribution']
---

Cloture on the CLARITY Act failed 46–43, short of the 60 it needed. Crypto sold off. The obvious read is that the market was long the bill and got stopped out.

The obvious read is wrong, and you can show it in one line.

From the 2026-09-14 close to 2026-09-15 21:50 UTC:

| | |
|---|---|
| US 10-year | 4.84% → **5.00%** (+16bp) |
| NASDAQ | −1.66% |
| S&P 500 | −1.14% |
| VIX | +4.50% |
| BTC | **−3.38%** |
| ETH | **−4.75%** |
| ETH/BTC | **−1.42%** |

Bitcoin's beta to the NASDAQ runs around 2. A −1.66% day on the index gets you −3.3% on BTC before anything crypto-specific happens at all. Which is to say the bill's contribution to the Bitcoin move rounds to zero — that was a rates day, and a long-end rates day at that.

What's left over is the 1.42% that ETH lost *relative* to BTC. And it closes exactly:

```
(1 − 3.38%) × (1 − 1.42%) = −4.75%
```

That is ETH's actual print. The decomposition isn't approximate, it reconciles.

## The reading

The conclusion isn't "the bill didn't matter." It's that the bill was never a Bitcoin story. Market structure legislation is about what counts as a security, who registers, which venue can list what — questions that bind ETH and DeFi and barely touch an asset that everyone already agreed was a commodity.

Bitcoin never needed it. ETH and DeFi did. The tape had that priced correctly and the headlines didn't.

## Why I write these before instead of after

The night before the vote I wrote down the criterion: judge the bill's impact on **ETH/BTC**, not on direction. That choice is the whole method. If I'd written "BTC falls if it fails," I'd have been right for entirely the wrong reason and learned nothing, because BTC was going to fall on a 16bp move in the long end regardless.

A criterion on a relative value survives both outcomes. If cloture had passed and ETH/BTC hadn't moved, that's information too.

Doing it in the other order — seeing −3.38% and then constructing the story — is how almost all event analysis gets written, and it can never be wrong, which is exactly what's wrong with it.

*Data: Binance spot for BTC and ETH, Treasury and index levels from public close data. Window is the 2026-09-14 close to 2026-09-15 21:50 UTC.*
