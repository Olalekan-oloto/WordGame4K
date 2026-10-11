# WORLD LIFE 4K — playable prototype

A responsive Nigeria/USA life-simulation web prototype. It includes a lightweight third-person 3D city test area inspired by open-world life games, alongside account, economy, marketplace and community foundations.

## Included in this prototype

- Account registration and sign-in with server-side bcrypt password hashing.
- Player profile and starting location selection.
- A browser-rendered Three.js 3D city-district prototype with improved lighting, soft shadows, road markings, crosswalk, more detailed facades and a more proportioned player with a third-person camera, simple character, keyboard movement, basic procedural walking-arm/leg animation, an E-key enter/exit vehicle interaction, basic vehicle steering/acceleration, and mouse and finger dragging to look around (touch gestures are captured by the game canvas). Nigeria and USA have distinct starter-scene details: Nigeria has warmer low-rise buildings, market stalls, local shop signs, overhead wires, a yellow/green danfo-style minibus, keke and okada; USA has taller blocks, a yellow taxi, American street signs, traffic signals, parking bays, a mailbox, bus-stop shelter, flag and hydrant detail. Scene signage adapts to the selected city.
- Country-specific careers and simulated rewards: Nigeria has Delivery Rider, Market Trader, Danfo Driver, Keke Rider and Jollof Chef paid in NGN; USA has Delivery Driver, Retail Associate, Rideshare Driver and EMT Assistant paid in USD. The server validates career choices against the player's selected country.
- Simulated bank deposits/withdrawals and starter home/vehicle purchases.
- Global text chat via Socket.IO, community feed and basic online-presence foundation. The 3D prototype now emits player positions and displays other connected players in the same selected country/city room when the authenticated backend is reachable.
- Nigeria and USA location choices and a display-only travel quote.
- Responsive layout for desktop and mobile browsers.

## Run locally

Requires Node.js 20 or later.

```sh
npm install
npm run dev
```

Open the local Vite address printed in the terminal. The development command starts both the Vite frontend and the Express/Socket.IO API.

Production checks:

```sh
npm run check
npm run build
npm start
```

The API health endpoint is `/api/health`.

## Important: prototype, not a finished online game

The 3D area is a small playable test block inspired by open-world games, not a complete open world or GTA-level graphics. Country-specific objects are visual prototypes, not a detailed or geographically accurate recreation. Player position synchronization is a basic prototype and needs multi-client testing; it is not yet a robust authoritative multiplayer simulation. Vehicle physics/collision are simplified. The “country server” label is currently a selected-region label, not proof of separate live servers. Drivable vehicles, character customization, missions, voice chat, private messages, robust moderation/reporting, verified email, password reset, persistent database, and a production payment system are not implemented yet.

The JSON data store is for development/testing only. It may not persist on some hosts and is not suitable for a large public launch. Before public registration, migrate to managed PostgreSQL, configure durable storage and backups, add email verification/password reset, session protections, rate limiting, moderation/reporting, privacy policy and terms, and test recovery from backups.

## Publishing

GitHub Pages can host only the built static frontend; it cannot run the Express API or Socket.IO server. The Nigeria/USA environments in this build are selected within the same app; separate regional game servers have not been deployed or configured yet. Region-specific city props, career choices and currency formatting are implemented in the prototype, but the region selector is not a separate physical server. To keep registration, chat and saving functional, publish the backend to a Node.js host that supports WebSockets and configure the GitHub repository secret `VITE_API_URL` to the backend's base URL (without `/api`). The backend currently permits the GitHub Pages origin configured in `index.js`; update that allow-list if the frontend domain changes. Confirm the hosting provider's current costs, sleeping behavior and persistent storage before sharing the game publicly.

## How the game could earn money later

1. Cosmetic purchases: outfits, hairstyles, emotes, vehicle paint and home decoration.
2. Optional VIP subscription: cosmetic perks, extra customization slots or convenience features that do not make the game unfair.
3. Rewarded ads: optional ads for small in-game rewards, only after adding a suitable ad provider and consent/privacy controls.
4. Sponsored in-game locations or branded events, clearly labeled as sponsored.

Do not sell accounts, passwords or personal data. Keep ordinary gameplay free, disclose prices clearly, offer receipts/refunds where required, and follow applicable tax, privacy, consumer-protection and platform rules. Game currency should not be presented as cash or promise real-world returns. Registration alone does not automatically generate income; revenue comes only if a user chooses to buy something, subscribes, or sees eligible ads. Do not add real payments until payment-provider checkout, server-side payment verification, refunds and support are implemented and tested.

## New player welcome package and home-life features

Newly registered accounts start with **1,000,000 in regional game currency**, a **Free Starter House**, and a **Free Starter Car**. Existing accounts keep their current balances and possessions. The house page includes six needs (hunger, energy, hygiene, bathroom, fun and social), free/paid home activities, and three-level upgrades for the bedroom, kitchen, bathroom, entertainment and decor. Players can also continue to earn money through region-specific jobs.

The banking page displays planned regional cash-pack prices: Nigeria uses ₦5,000 / ₦10,000 / ₦20,000 price tiers; USA uses $5 / $10 / $20. **Real-money checkout is not active**: a payment provider, verified server-side payment webhooks, refunds and fraud controls must be configured before purchases can be charged. The buttons currently explain that checkout is not connected and never charge a user.

## Regional separation status

Chat broadcasts and the social feed are filtered by country, and the existing live presence system keeps city rooms separated. This is **regional isolation in one backend**, not two physically independent servers. To deploy truly separate Nigeria and USA servers, deploy two backend instances with separate persistent databases and region-specific frontend API configuration; that infrastructure has not been provisioned by this source ZIP.

## Regional servers and real-money cash packs (deployment configuration)

This repository now includes `render.yaml` with two independent Node backend services: `world-life-4k-nigeria` and `world-life-4k-usa`. Each service has its own persistent disk and JSON database, and `GAME_REGION` prevents accounts from registering/signing in on the wrong regional server. This is deployment configuration, **not a claim that the services have already been deployed**.

### Deploy the two servers

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from this repository and review `render.yaml`. The two services use paid Starter instances and separate persistent disks; check current Render pricing before accepting.
3. Add `PAYSTACK_SECRET_KEY` to the Nigeria service using Paystack test keys first. Add `STRIPE_SECRET_KEY` to the USA service using Stripe test keys first. Never put secret keys in frontend variables or commit them to Git.
4. After both services deploy, copy their HTTPS URLs. In GitHub repository **Settings → Secrets and variables → Actions**, add `VITE_API_URL_NIGERIA` and `VITE_API_URL_USA`, each containing the relevant backend base URL without `/api`.
5. Re-run the GitHub Pages workflow to build the frontend with both region URLs. Confirm each service's `/api/health` response reports the intended region.
6. Test Paystack/Stripe in test mode before switching to live credentials. Configure provider dashboards, refund/support processes, legal disclosures, and monitoring before launch.

### Cash packs and payment verification

The banking page offers Nigeria packs priced at ₦5,000 / ₦10,000 / ₦20,000 and USA packs priced at $5 / $10 / $20. The server creates a provider-hosted checkout session and credits game cash only after a server-to-server provider verification confirms the payment, amount, currency, user and pack. Credits are marked paid to prevent duplicate crediting. Use provider test keys first. If a player is charged but the browser never returns to the game, the payment may need support/reconciliation; add provider webhooks and an admin reconciliation/refund workflow before a high-volume public launch.

### Important deployment limitations

- You must deploy the Render Blueprint and configure secrets yourself; source code cannot provision accounts or obtain payment keys.
- These services use a JSON file database on separate persistent disks for this prototype. That gives separate regional data but is not a production-scale database; migrate to managed PostgreSQL and add backups before a major public launch.
- The GitHub Pages project path in `FRONTEND_URL` is set to `https://olalekan-oloto.github.io/WordGame4K`. If your Pages URL differs, update `FRONTEND_URL` on both services. Set `ALLOWED_ORIGINS` to your frontend's exact origin (origin only, no path).
- Payment providers may require business verification and approval. Do not switch to live keys until test payments, refund handling and compliance checks have passed.
