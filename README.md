# Payment → Asset Delivery (Internal QA Demo)

**Test mode only.** Stripe `sk_test_*` + mock testnet payouts. No real funds move.

Demonstrates:

1. Frontend form (asset, testnet address, USD amount)
2. Stripe Checkout Session creation
3. SQLite order storage
4. Webhook → mock swap → status update
5. Frontend polling + testnet explorer links

---

## Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Backend  | Node, Express, better-sqlite3 |
| Frontend | React 18, Vite, React Router  |
| Payments | Stripe Checkout (test)        |
| Price    | CoinGecko (fallback hardcoded)|
| Payout   | Mock function (2s delay + hash)|

---

## Folder structure

```
payment-to-asset/
├── README.md
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── init-db.js
│   ├── server.js
│   └── orders.db          # created on first run
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── index.css
```

---

## Prerequisites

- Node.js 18+
- Stripe account (test mode)
- Stripe CLI (for local webhooks) — https://stripe.com/docs/stripe-cli

---

## Setup

### 1. Server

```bash
cd server
cp .env.example .env
# Edit .env — paste your Stripe TEST keys
npm install
node init-db.js   # optional; server also creates schema
npm run dev
```

Server runs at `http://localhost:3001`.

### 2. Stripe webhook (local)

In a second terminal:

```bash
stripe listen --forward-to localhost:3001/api/stripe-webhook
```

Copy the `whsec_...` signing secret into `server/.env` as `STRIPE_WEBHOOK_SECRET`, then restart the server.

### 3. Client

```bash
cd client
npm install
npm run dev
```

App at `http://localhost:5173`. Vite proxies `/api` → backend.

---

## Environment variables (`server/.env`)

| Variable                 | Example / note                                      |
|--------------------------|-----------------------------------------------------|
| `STRIPE_SECRET_KEY`      | `sk_test_...` only                                  |
| `STRIPE_WEBHOOK_SECRET`  | `whsec_...` from `stripe listen`                    |
| `PORT`                   | `3001`                                              |
| `CLIENT_URL`             | `http://localhost:5173`                             |
| `DATABASE_PATH`          | `./orders.db`                                       |
| `HOT_WALLET_PRIVATE_KEY` | any 64-char hex (unused in mock; present for demo)  |

---

## Test flow

1. Open `http://localhost:5173`
2. Select asset (e.g. ETH-goerli)
3. Paste a valid-format testnet address  
   - ETH: `0x` + 40 hex  
   - SOL: base58 32–44 chars  
   - BTC testnet: `tb1…` or `m/n/2…`
4. Enter USD amount (e.g. 10)
5. Click **Pay with Stripe**
6. Use test card: `4242 4242 4242 4242` · any future expiry · any CVC · any ZIP
7. After redirect, success page polls `/api/order/:id`
8. Webhook marks order `processing` → mock swap (~2s) → `completed` + tx hash
9. Link opens the appropriate testnet explorer

---

## API

### `POST /api/create-payment`

```json
{
  "asset": "ETH-goerli",
  "walletAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "usdAmount": 10
}
```

Response:

```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/...",
  "orderId": "uuid",
  "cryptoAmount": 0.00306,
  "priceUsed": 3200
}
```

### `GET /api/order/:id`

Returns order status, amounts, `tx_hash` when completed.

### `POST /api/stripe-webhook`

Raw body + `Stripe-Signature`. Handles `checkout.session.completed`.

### `GET /api/health`

```json
{ "ok": true, "mode": "test", "stripe": true }
```

---

## Security (demo)

- CORS locked to `CLIENT_URL` (localhost:5173)
- Rate limit: 5 requests/min on create-payment and order status
- Webhook signature verification with raw body
- Address format validation per asset
- Stripe test keys only — live keys must never be used

---

## Mock behavior notes

- Price: tries CoinGecko; falls back to hardcoded USD values if API is down
- Fee: 2% deducted from fiat before conversion
- Swap: 2 second delay; ~5% chance of simulated failure (status `failed`, no refund)
- Tx hash: deterministic SHA-256 derived from order data (not a real chain tx)

---

## Important

This is an **internal QA demonstration tool**.  
All Stripe traffic is test mode. Asset “transfers” are mocked.  
Do not point live keys or mainnet addresses at this stack.
