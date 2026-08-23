/**
 * Payment-to-Asset Delivery Demo Server
 * Stripe TEST mode only + mock testnet payout.
 * For internal QA — no real funds.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'orders.db');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_placeholder';

// ---------------------------------------------------------------------------
// Stripe (test mode only)
// ---------------------------------------------------------------------------
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------
const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');

// Ensure schema exists (idempotent)
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    asset TEXT NOT NULL,
    fiat_amount REAL NOT NULL,
    crypto_amount REAL,
    wallet_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    stripe_session_id TEXT,
    tx_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);
`);

const insertOrder = db.prepare(`
  INSERT INTO orders (id, asset, fiat_amount, crypto_amount, wallet_address, status, stripe_session_id)
  VALUES (@id, @asset, @fiat_amount, @crypto_amount, @wallet_address, @status, @stripe_session_id)
`);

const updateOrderBySession = db.prepare(`
  UPDATE orders
  SET status = @status, tx_hash = @tx_hash, updated_at = datetime('now')
  WHERE stripe_session_id = @stripe_session_id
`);

const updateOrderStatus = db.prepare(`
  UPDATE orders SET status = @status, updated_at = datetime('now')
  WHERE stripe_session_id = @stripe_session_id
`);

const getOrderById = db.prepare(`SELECT * FROM orders WHERE id = ?`);
const getOrderBySession = db.prepare(`SELECT * FROM orders WHERE stripe_session_id = ?`);

// ---------------------------------------------------------------------------
// Address validation (testnet formats)
// ---------------------------------------------------------------------------
const ADDRESS_PATTERNS = {
  'SOL-testnet': /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  'ETH-goerli': /^0x[a-fA-F0-9]{40}$/,
  'BTC-testnet': /^(tb1|[2mn])[a-zA-HJ-NP-Z0-9]{25,62}$/,
};

function validateWalletAddress(asset, address) {
  const pattern = ADDRESS_PATTERNS[asset];
  if (!pattern) return { valid: false, error: 'Unsupported asset' };
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Wallet address required' };
  }
  if (!pattern.test(address.trim())) {
    return { valid: false, error: `Invalid ${asset} testnet address format` };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Mock price fetch (CoinGecko + hardcoded fallback)
// ---------------------------------------------------------------------------
const FALLBACK_PRICES_USD = {
  'SOL-testnet': 145.0,
  'ETH-goerli': 3200.0,
  'BTC-testnet': 65000.0,
};

const COINGECKO_IDS = {
  'SOL-testnet': 'solana',
  'ETH-goerli': 'ethereum',
  'BTC-testnet': 'bitcoin',
};

async function getAssetPriceUsd(asset) {
  const id = COINGECKO_IDS[asset];
  if (!id) return FALLBACK_PRICES_USD[asset] || 1;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    const price = data?.[id]?.usd;
    if (typeof price === 'number' && price > 0) return price;
    throw new Error('Invalid price payload');
  } catch (err) {
    console.warn(`[price] CoinGecko failed for ${asset}, using fallback:`, err.message);
    return FALLBACK_PRICES_USD[asset];
  }
}

// ---------------------------------------------------------------------------
// Mock swap / testnet payout (deterministic-ish hash, 2s delay)
// ---------------------------------------------------------------------------
function mockSwapAndPayout({ orderId, asset, cryptoAmount, walletAddress }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // ~5% simulated failure for QA edge-case testing
      if (Math.random() < 0.05) {
        reject(new Error('Mock exchange temporary failure'));
        return;
      }
      // Deterministic-looking hash from orderId + asset
      const seed = `${orderId}:${asset}:${cryptoAmount}:${walletAddress}`;
      const hash = crypto.createHash('sha256').update(seed).digest('hex');
      const txHash =
        asset === 'BTC-testnet'
          ? hash
          : asset === 'ETH-goerli'
            ? `0x${hash}`
            : hash.slice(0, 64); // SOL style
      resolve({ txHash, status: 'completed' });
    }, 2000);
  });
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// CORS — only local Vite
app.use(
  cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Stripe-Signature'],
  })
);

// Rate limit: 5 req/min per IP on API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again in a minute' },
});

// ---------------------------------------------------------------------------
// Webhook must receive raw body — mount before json parser
// ---------------------------------------------------------------------------
app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const sessionId = session.id;

      const order = getOrderBySession.get(sessionId);
      if (!order) {
        console.warn('[webhook] No order for session', sessionId);
        return res.json({ received: true });
      }

      // Mark processing
      updateOrderStatus.run({ status: 'processing', stripe_session_id: sessionId });

      // Fire mock swap asynchronously (do not block webhook response)
      (async () => {
        try {
          const result = await mockSwapAndPayout({
            orderId: order.id,
            asset: order.asset,
            cryptoAmount: order.crypto_amount,
            walletAddress: order.wallet_address,
          });
          updateOrderBySession.run({
            status: 'completed',
            tx_hash: result.txHash,
            stripe_session_id: sessionId,
          });
          console.log(`[mock-swap] Order ${order.id} completed → ${result.txHash}`);
        } catch (err) {
          updateOrderBySession.run({
            status: 'failed',
            tx_hash: null,
            stripe_session_id: sessionId,
          });
          console.error(`[mock-swap] Order ${order.id} failed:`, err.message);
        }
      })();
    }

    res.json({ received: true });
  }
);

// JSON body for the rest of the routes
app.use(express.json());

// ---------------------------------------------------------------------------
// POST /api/create-payment
// ---------------------------------------------------------------------------
app.post('/api/create-payment', apiLimiter, async (req, res) => {
  try {
    const { asset, walletAddress, usdAmount } = req.body;

    if (!asset || !ADDRESS_PATTERNS[asset]) {
      return res.status(400).json({ error: 'Invalid or missing asset. Use SOL-testnet, ETH-goerli, or BTC-testnet' });
    }

    const addrCheck = validateWalletAddress(asset, walletAddress);
    if (!addrCheck.valid) {
      return res.status(400).json({ error: addrCheck.error });
    }

    const fiat = Number(usdAmount);
    if (!Number.isFinite(fiat) || fiat < 1 || fiat > 10000) {
      return res.status(400).json({ error: 'USD amount must be between 1 and 10000' });
    }

    // Price + 2% fee
    const priceUsd = await getAssetPriceUsd(asset);
    const netUsd = fiat * 0.98; // 2% service fee
    const cryptoAmount = Number((netUsd / priceUsd).toFixed(8));

    const orderId = uuidv4();

    // Create Stripe Checkout Session (test mode)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Testnet ${asset} delivery`,
              description: `QA demo — ${cryptoAmount} ${asset} to ${walletAddress.slice(0, 10)}…`,
            },
            unit_amount: Math.round(fiat * 100), // cents
          },
          quantity: 1,
        },
      ],
      success_url: `${CLIENT_URL}/success?order_id=${orderId}`,
      cancel_url: `${CLIENT_URL}/?canceled=1`,
      metadata: {
        order_id: orderId,
        asset,
        wallet_address: walletAddress.trim(),
      },
    });

    insertOrder.run({
      id: orderId,
      asset,
      fiat_amount: fiat,
      crypto_amount: cryptoAmount,
      wallet_address: walletAddress.trim(),
      status: 'pending',
      stripe_session_id: session.id,
    });

    res.json({
      sessionId: session.id,
      url: session.url,
      orderId,
      cryptoAmount,
      priceUsed: priceUsd,
    });
  } catch (err) {
    console.error('[create-payment]', err);
    res.status(500).json({ error: 'Failed to create payment session', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/order/:id — status polling
// ---------------------------------------------------------------------------
app.get('/api/order/:id', apiLimiter, (req, res) => {
  const order = getOrderById.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({
    id: order.id,
    asset: order.asset,
    fiat_amount: order.fiat_amount,
    crypto_amount: order.crypto_amount,
    wallet_address: order.wallet_address,
    status: order.status,
    tx_hash: order.tx_hash,
    created_at: order.created_at,
    updated_at: order.updated_at,
  });
});

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'test', stripe: STRIPE_SECRET_KEY.startsWith('sk_test_') });
});

// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Payment-to-asset QA server listening on http://localhost:${PORT}`);
  console.log(`Stripe key prefix: ${STRIPE_SECRET_KEY.slice(0, 10)}…`);
  console.log(`CORS origin: ${CLIENT_URL}`);
});
