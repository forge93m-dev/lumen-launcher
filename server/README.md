# Lumen skin service

A tiny server that lets Lumen players see each other's skins and capes. Each launcher uploads the skin and cape of
its player; each game asks for the players around it. It has no dependencies, only Node 18 or newer.

```
node server/skin-service.js                      # port 8787, data in ./skin-data
PORT=80 DATA=/var/lib/lumen-skins node server/skin-service.js
```

| Variable | Meaning | Default |
| --- | --- | --- |
| `PORT` | port to listen on | `8787` |
| `HOST` | address to listen on | `0.0.0.0` |
| `DATA` | folder where profiles are kept | `./skin-data` |
| `TRUST_PROXY=1` | read the client address from `X-Forwarded-For` (set it behind a reverse proxy, for the rate limits) | off |

## Putting it online

The service has to be reachable by everyone who should see each other: a small VPS, a home server with a port forwarded,
or any host that runs Node or Docker. Put HTTPS in front of it (Caddy, nginx or the host's own TLS), then every player
types the address into **Settings → Lumen skin service** in the launcher.

With Docker (from the repository root):

```
docker build -f server/Dockerfile -t lumen-skins .
docker run -d --restart unless-stopped -p 8787:8787 -v lumen-skins:/data lumen-skins
```

## On Cloudflare (free, no server of your own)

`server/cloudflare/` is the same service as a Cloudflare Worker with Workers KV for storage. The free plan is plenty for
a group of friends. You need a free Cloudflare account; nothing is installed on your computer except what `npx` fetches.

```
cd server/cloudflare
npx wrangler login                          # opens the browser once
npx wrangler kv namespace create SKINS      # prints an id: paste it into wrangler.toml (replace REPLACE_WITH_THE_ID...)
npx wrangler deploy                         # prints https://lumen-skins.<your-name>.workers.dev
```

Give that address to every player: **Settings → Lumen skin service** in the launcher, then *Check*.

Free plan limits to keep in mind: about 1000 KV writes a day (an upload is up to three writes, so a few hundred skin
changes a day) and 100 000 reads. Changes can take up to a minute to show up in other regions (KV is eventually
consistent). There is no per-address rate limit in the Worker: use Cloudflare's own rate limiting rules (dashboard →
Security → WAF) if the address becomes public.

To try it locally first: `npx wrangler dev --local` (the tests do exactly this, see `tests/net/skin-worker-live.test.js`).

## How it works

* `PUT /v1/profile/<nickname>` uploads a skin (64×64 PNG), a cape (64×32 PNG) and the arm model. The first launcher to
  upload a nickname claims it with a secret token (kept hashed); later uploads must send the same token.
* `GET /v1/profile/<nickname>` tells the game what exists; `GET /v1/skin/<nickname>` and `/v1/cape/<nickname>` give the pictures.
* Pictures are decoded and re-encoded, so only pixels are stored. Writes and reads are rate limited per address.

This is name based and trust based, like a friends' server: whoever claims a nickname first owns it on this service.
It is not a replacement for Mojang's skin servers and cannot change what other players see in the vanilla game.
