# OrbZox web application — reserved for Phase 2

React + TypeScript + Vite will own the interface; native Canvas 2D will render gameplay.
No frontend application, gameplay screen, or browser build exists in Phase 1.

Public identity: **OrbZox | ORVLI**, published by **ORVLI**. Branding belongs in app
configuration, never in simulation or protocol identifiers.

The eventual `/orbzox/` base path must be configurable. Initial standalone Cloudflare
hosting will use `/`. API/WebSocket origin and asset base are separate configuration
values; browser routing must not assume that a GitHub repository creates a public path.
