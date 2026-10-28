# OrbZox authoritative server — reserved for Phase 3

A Cloudflare Worker will serve static assets and route secure WebSockets to one
authoritative Durable Object per room. A small directory resolves expiring room codes.
Room identity, authentication, input sequencing, reconnection, rate limits, storage,
and network pause policy belong here, not in game-core.

No Worker, Durable Object, socket server, credentials, or deployment is implemented yet.
Initial deployment will be independent of ORVLI's existing GitHub Pages sites.
