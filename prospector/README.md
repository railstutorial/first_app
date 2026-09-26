# Prospector (Jev via Vercel AI Gateway)

Finds people on Reddit who are asking for a roof leak / storm-damage roofer, then
checks your outreach messages before you send them. **It never sends, posts or DMs
anything.** You review every lead and send by hand.

Edit `config.mjs` to change what you sell, the subreddits, the pre-filter phrases or the
Jev questions.

## Setup (once)

```sh
cd prospector
npm install
cp .env.example .env   # paste AI_GATEWAY_API_KEY=... (never commit .env)
```

Needs Node.js 22.18+.

## Part 1: find buyers

```sh
node fetch-posts.mjs                        # last 30 days -> data/posts.json
node --env-file=.env score-leads.mjs        # Jev, 3 at a time -> leads.csv
```

- Posts come from the Arctic Shift archive of Reddit, because reddit.com blocks
  scripted access from many networks. Only posts that mention a roof, a leak or storm
  damage, and are phrased as a request, go to Jev.
- Each post is **one** `experimental_evaluate` call to `typesafe-ai/jev` with three boolean
  questions: `buying`, `pain`, `vendor`.
- A post is kept when `buying >= 0.60` and `vendor < 0.50`.
- `leads.csv` has `url, buying, pain, vendor`. `data/all-scored.csv` has every scored post
  with its title, for spot checks.
- The gateway often answers "high demand" (HTTP 429) for Jev. Calls back off and retry,
  and anything that still fails goes to `data/failed.csv`. Rerun `score-leads.mjs` and it
  only scores the posts that are missing.

## Part 2: check messages before they go

1. Copy `approved.example.csv` to `approved.csv`. Add one row per lead you approve:
   `url`, `who` (one line on who they are), `message` (what you plan to send).
2. Run:

   ```sh
   node --env-file=.env check-messages.mjs  # -> checked.csv
   ```

Each lead is one Jev call with the state
`LEAD: <who> / MESSAGE THEY ARE ABOUT TO RECEIVE: <message>` and two questions: `reply`
(would they reply) and `fit` (written for their role and problem). `fit < 0.50` is
flagged **do not send**. The right message is going to the wrong person.
