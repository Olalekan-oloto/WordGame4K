# WORLD LIFE 4K — playable prototype

A responsive Nigeria/USA life-simulation web prototype. It includes a lightweight third-person 3D city test area inspired by open-world life games, alongside account, economy, marketplace and community foundations.

## Included in this prototype

- Account registration and sign-in with server-side bcrypt password hashing.
- Player profile and starting location selection.
- A browser-rendered Three.js 3D city-district prototype with improved lighting, soft shadows, road markings, crosswalk, more detailed facades and a more proportioned player with a third-person camera, simple character, keyboard movement, basic procedural walking-arm/leg animation, an E-key enter/exit vehicle interaction, basic vehicle steering/acceleration, and mouse and finger dragging to look around (touch gestures are captured by the game canvas). Nigeria and USA have distinct starter-scene details: Nigeria has warmer low-rise buildings, market stalls and a yellow/green danfo-style minibus; USA has taller blocks, a yellow taxi and an American flag/hydrant detail.
- Jobs and simulated game-currency rewards.
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

GitHub Pages can host only the built static frontend; it cannot run the Express API or Socket.IO server. The Nigeria/USA environments in this build are selected within the same app; separate regional game servers have not been deployed or configured yet. To keep registration, chat and saving functional, publish the backend to a Node.js host that supports WebSockets and configure the GitHub repository secret `VITE_API_URL` to the backend's base URL (without `/api`). The backend currently permits the GitHub Pages origin configured in `index.js`; update that allow-list if the frontend domain changes. Confirm the hosting provider's current costs, sleeping behavior and persistent storage before sharing the game publicly.

## How the game could earn money later

1. Cosmetic purchases: outfits, hairstyles, emotes, vehicle paint and home decoration.
2. Optional VIP subscription: cosmetic perks, extra customization slots or convenience features that do not make the game unfair.
3. Rewarded ads: optional ads for small in-game rewards, only after adding a suitable ad provider and consent/privacy controls.
4. Sponsored in-game locations or branded events, clearly labeled as sponsored.

Do not sell accounts, passwords or personal data. Keep ordinary gameplay free, disclose prices clearly, offer receipts/refunds where required, and follow applicable tax, privacy, consumer-protection and platform rules. Game currency should not be presented as cash or promise real-world returns. Registration alone does not automatically generate income; revenue comes only if a user chooses to buy something, subscribes, or sees eligible ads. Do not add real payments until payment-provider checkout, server-side payment verification, refunds and support are implemented and tested.
