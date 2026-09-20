# The weekly post

Run order, from the repo root:

```bash
DIR=$(scripts/week-ahead/fetch.sh | tail -1)   # klines + funding to a temp dir
cd "$DIR"
python3 ~/Documents/tapesays/scripts/week-ahead/prob.py     # writes prob.json
python3 ~/Documents/tapesays/scripts/week-ahead/charts.py   # writes week-{btc,eth,sol}.png
cp week-*.png ~/Documents/tapesays/public/charts/
```

Then write the post in `src/content/posts/`, `npm run og`, build, push.

## What the numbers are

`prob.py` answers one question: what are the odds price **reaches** each edge of
its 30-day range inside the next seven sessions, and separately what are the
odds it **closes** outside. Those get talked about as the same event and they
are not: on 20 Sep 2026 Bitcoin reached its high in 81% of paths and closed
above it in 34%.

Three choices in there, each one deliberate:

- **Bootstrap, not lognormal.** Daily returns are drawn with replacement from
  the last 730 sessions, so the simulation inherits this market's fat tails. A
  closed form understates the odds of reaching a level, predictably.
- **De-meaned.** The last two years carry a positive drift. Leaving it in would
  have the simulation assume the thing it is measuring. These numbers describe
  the shape of the market and nothing about direction.
- **A barrier counts on the day's high or low**, not the close, using a sampled
  true range around each simulated step. That is the whole 81 against 34 gap.

Seed is fixed, so a rerun reproduces.

## The part that is not optional

Every one of these posts ends with claims dated for the following Sunday, and
they get marked. The 19 Sep post marked the 11 Sep call and the call came out
badly; publishing that is the reason any of the rest is worth reading. A claim
posted and never scored is worse than no claim.
