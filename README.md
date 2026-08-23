# Payment to Asset

Stripe Checkout (live) converts a card payment into a real mainnet delivery of ETH, SOL, or BTC.

1. Customer picks an asset, mainnet address, and USD amount
2. Server creates a Stripe Checkout Session
3. Order is stored in the isolated payment-to-asset database
4. Live webhook POST /api/stripe-webhook triggers a mainnet send from the hot wallet
5. Success page polls order status and links to the mainnet explorer

This is production. Transfers move real funds. Missing keys fail the payout instead of faking a transaction.

## Stack

- Backend: Node, Express
- Frontend: React 18, Vite, React Router
- Payments: Stripe Checkout (live)
- Price: CoinGecko (hardcoded USD fallback)
- Payout: Ethereum mainnet, Solana mainnet-beta, Bitcoin mainnet
- Store: Isolated onetwo HTTP/PGlite via DATABASE_URL, local SQLite fallback

## Networks

- ETH: Ethereum mainnet (chainId 1). RPC ETH_RPC_URL or https://cloudflare-eth.com. Explorer etherscan.io
- SOL: Solana mainnet-beta. RPC SOL_RPC_URL or https://api.mainnet-beta.solana.com. Explorer solscan.io
- BTC: Bitcoin mainnet. API BTC_API_URL or https://mempool.space/api. Explorer mempool.space

## Setup

See server/.env.example. Server listens on 127.0.0.1:3001 by default.

## Environment variables

Set in Vercel Production. Never commit real values.
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- VITE_STRIPE_PUBLISHABLE_KEY
- CLIENT_URL
- DATABASE_URL
- DATABASE_TOKEN
- HOT_WALLET_PRIVATE_KEY
- ETH_HOT_WALLET_PRIVATE_KEY
- SOL_HOT_WALLET_SECRET
- BTC_HOT_WALLET_WIF
- ETH_RPC_URL
- SOL_RPC_URL
- BTC_API_URL

## API

POST /api/create-payment  asset must be ETH, SOL, or BTC.
GET /api/order/:id
POST /api/stripe-webhook
GET /api/health  mode is live. stripe is true only for sk_live_ keys.

## Production notes

- Checkout requires a live Stripe secret. Test keys are rejected.
- Webhook path stays /api/stripe-webhook.
- Missing chain keys fail the payout. No fake tx hashes.
- Isolated payment-to-asset DB only.
