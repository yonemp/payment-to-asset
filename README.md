# Payment to Asset (Card to Crypto)

Whop card checkout sells **credits**. This site does not send crypto.

1. Customer enters a USD amount ($25–$5000) and pays with a card
2. A 14% service fee comes out of that amount. The remaining 86% becomes credits ($1 net = 1 credit)
3. After Whop confirms payment, credits are issued to a **credit code** and **order ID**
4. Lookup by order ID or credit code shows remaining balance
5. Crypto redemption is a separate service (redeem site coming soon). Do not invent a redeem domain.

Swap stays disabled.

## Stack

- Backend: Node, Express
- Frontend: React 18, Vite, React Router
- Payments: Whop one-time checkout (live)
- Store: Isolated HTTP/PGlite via DATABASE_URL, local SQLite fallback

## Setup

See server/.env.example. Server listens on 127.0.0.1:3001 by default.

## Environment variables

Set in Vercel Production. Never commit real values.
- WHOP_API_KEY
- WHOP_ACCOUNT_ID
- WHOP_WEBHOOK_SECRET
- CLIENT_URL
- DATABASE_URL
- DATABASE_TOKEN
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

## API

POST /api/create-payment  body `{ usdAmount }` — creates a credits order and Whop checkout
GET /api/quote?usdAmount=100  fee + credits (no live crypto quote)
GET /api/order/:id  order UUID, credit code (CTC-…), or checkout / payment id
POST /api/whop-webhook
GET /api/health

## Credits math

Enter $100 → fee $14 → **86.00 credits**. Paid Whop webhook credits `remaining_balance`.

## Production notes

- Checkout requires Whop keys in Vercel Production.
- This site issues credits only. It does not broadcast ETH/SOL/BTC.
- Isolated payment-to-asset DB only.
