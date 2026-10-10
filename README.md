# WORLD LIFE 4K — Launch/Test Build

WORLD LIFE 4K is a responsive web-game foundation for a Nigeria/USA life simulation. This build contains accounts, a player profile, starter game economy, jobs, home/vehicle marketplace, in-game bank, social feed, global text chat, country/state selection and a travel quote flow.

## Run it for free in the Replit workspace

1. Import/upload this ZIP into a **Node.js** Replit project.
2. Open **Shell** and run `npm install`.
3. Run `npm run dev`.
4. Open the Webview/Preview and test account registration, sign-in, work, bank transfers, marketplace purchases, social posts and chat.

The development command starts Vite for the browser and Express/Socket.IO for the API. The Vite proxy sends `/api` and `/socket.io` requests to the server.

## Production build commands

- Build frontend: `npm run build`
- Start production server: `npm start`
- Health check after startup: open `/api/health` on your app URL; it should return JSON with `ok: true`.

For a Replit deployment that supports a Node.js server and WebSockets, configure the build command as `npm run build` and the run command as `npm start`. If Replit offers only a static deployment on your account, it cannot host this complete backend by itself. Hosting availability, limits and pricing depend on the current Replit plan; do not assume public production hosting is free until the publish screen confirms the cost.

## What is included

- Responsive desktop/mobile UI.
- Account creation and sign-in with server-side bcrypt password hashing.
- Nigeria's 36 states plus FCT; all 50 US states plus DC.
- Starter city options (not an exhaustive list of all cities).
- Player profile, in-game cash and bank balances, level and career.
- Simulated jobs and rewards, in-game deposits/withdrawals and starter property/vehicle purchases.
- Global text chat using Socket.IO and a basic community feed.
- Online player presence foundation.
- International travel quote at $5 USD, with **no real payment collected**.
- Basic HTTP security headers and per-process auth-attempt throttling.

## Important limitations before a public launch

This is **not yet a finished GTA-scale 3D open-world game**. It does not include a synchronized walkable 3D world, player character customization/animation, drivable vehicles, complete city maps, private messaging, voice/video calls, moderation/reporting, verified email/password reset, or app-store builds. Those need additional implementation and testing.

The JSON file database is for development only. It may not be durable on hosted deployments, and concurrent writes are not suitable for a large public launch. Before inviting real users, move account/game data to a managed database (for example PostgreSQL), use persistent secure sessions, add email verification and password reset, configure rate limiting across instances, backups, moderation/reporting, privacy policy and terms, and test restore/recovery. Never use game currency as real money.

The $5 travel value is a display-only quote. Do not collect real money until a legitimate payment provider, server-side payment verification, refunds, receipts, support and legal compliance have been implemented.

## Pre-launch test checklist

- [ ] `npm install` completes without errors.
- [ ] `npm run build` completes successfully.
- [ ] `npm start` starts the production server.
- [ ] `/api/health` returns `ok: true`.
- [ ] A new user can register and sign in.
- [ ] Invalid password and duplicate account are rejected.
- [ ] Work rewards, bank transfers and purchases update the profile correctly.
- [ ] Two separate test accounts can exchange global chat messages.
- [ ] Social posts load and remain after navigating between pages.
- [ ] Test on a phone-sized screen and a desktop browser.
- [ ] Confirm hosting costs and data persistence before sharing publicly.
