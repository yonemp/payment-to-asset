/**
 * Payment-to-Asset production server.
 * Stripe live mode + real mainnet payouts (ETH / SOL / BTC).
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const { createDb, schemaSql, nowExpr } = require('./db');
const {
  NETWORKS,
  ADDRESS_PATTERNS,
  FALLBACK_PRICES_USD,
  COINGECKO_IDS,
  validateWalletAddress,
  payoutReady,
  sendPayout,
} = require('./payouts');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const CLIENT_URL = process.env.CLIENT_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? ('https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL) : (process.env.VERCEL_URL ? ('https://' + process.env.VERCEL_URL) : 'http://localhost:5173'));
const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const STRIPE_LIVE = STRIPE_SECRET_KEY.startsWith('sk_live_');

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' })
  : null;

const db = createDb();
const ready = db.exec(schemaSql(db.driver));

async function insertOrder(row) {
  await ready;
  await db.query(
    `INSERT INTO orders (id, asset, fiat_amount, crypto_amount, wallet_address, status, stripe_session_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [row.id, row.asset, row.fiat_amount, row.crypto_amount, row.wallet_address, row.status, row.stripe_session_id]
  );
}

async function updateOrderBySession({ status, tx_hash, stripe_session_id }) {
  await ready;
  await db.query(
    `UPDATE orders SET status = $1, tx_hash = $2, updated_at = ${nowExpr(db.driver)} WHERE stripe_session_id = $3`,
    [status, tx_hash, stripe_session_id]
  );
}

async function updateOrderStatus({ status, stripe_session_id }) {
  await ready;
  await db.query(
    `UPDATE orders SET status = $1, updated_at = ${nowExpr(db.driver)} WHERE stripe_session_id = $2`,
    [status, stripe_session_id]
  );
}

async function getOrderById(id) {
  await ready;
  return db.get(`SELECT * FROM orders WHERE id = $1`, [id]);
}

async function getOrderBySession(sessionId) {
  await ready;
  return db.get(`SELECT * FROM orders WHERE stripe_session_id = $1`, [sessionId]);
}

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

function requireLiveStripe(res) {
  if (!stripe || !STRIPE_LIVE) {
    res.status(503).json({
      error: 'Stripe live mode is not configured. Set STRIPE_SECRET_KEY to a sk_live_ key.',
    });
    return false;
  }
  return true;
}

const app = express();

app.use(
  cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Stripe-Signature'],
  })
);

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again in a minute' },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again in a minute' },
});

app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(503).send('Stripe live webhook is not configured');
    }
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
      const order = await getOrderBySession(sessionId);
      if (!order) {
        console.warn('[webhook] No order for session', sessionId);
        return res.json({ received: true });
      }
      if (order.status === 'completed' && order.tx_hash) {
        return res.json({ received: true });
      }
      await updateOrderStatus({ status: 'processing', stripe_session_id: sessionId });
      try {
        const result = await sendPayout({
          asset: order.asset,
          cryptoAmount: order.crypto_amount,
          walletAddress: order.wallet_address,
        });
        await updateOrderBySession({
          status: 'completed',
          tx_hash: result.txHash,
          stripe_session_id: sessionId,
        });
        console.log(`[payout] Order ${order.id} completed -> ${result.txHash}`);
      } catch (err) {
        await updateOrderBySession({
          status: 'failed',
          tx_hash: null,
          stripe_session_id: sessionId,
        });
        console.error(`[payout] Order ${order.id} failed:`, err.message);
      }
    }

    res.json({ received: true });
  }
);

app.use(express.json());

app.post('/api/create-payment', createLimiter, async (req, res) => {
  try {
    if (!requireLiveStripe(res)) return;
    const { asset, walletAddress, usdAmount } = req.body;
    if (!asset || !ADDRESS_PATTERNS[asset]) {
      return res.status(400).json({ error: 'Invalid or missing asset. Use ETH, SOL, or BTC' });
    }
    const addrCheck = validateWalletAddress(asset, walletAddress);
    if (!addrCheck.valid) {
      return res.status(400).json({ error: addrCheck.error });
    }
    const fiat = Number(usdAmount);
    if (!Number.isFinite(fiat) || fiat < 1 || fiat > 10000) {
      return res.status(400).json({ error: 'USD amount must be between 1 and 10000' });
    }
    const priceUsd = await getAssetPriceUsd(asset);
    const netUsd = fiat * 0.98;
    const cryptoAmount = Number((netUsd / priceUsd).toFixed(8));
    const orderId = uuidv4();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${NETWORKS[asset].symbol} delivery`,
              description: `${cryptoAmount} ${asset} to ${walletAddress.trim().slice(0, 10)}…`,
            },
            unit_amount: Math.round(fiat * 100),
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
    await insertOrder({
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

app.get('/api/order/:id', orderLimiter, async (req, res) => {
  const order = await getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  const meta = NETWORKS[order.asset];
  res.json({
    id: order.id,
    asset: order.asset,
    fiat_amount: order.fiat_amount,
    crypto_amount: order.crypto_amount,
    wallet_address: order.wallet_address,
    status: order.status,
    tx_hash: order.tx_hash,
    explorer_url: order.tx_hash && meta ? meta.explorerTx(order.tx_hash) : null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  });
});

app.get('/api/quote', orderLimiter, async (req, res) => {
  try {
    const asset = String(req.query.asset || '').toUpperCase();
    const fiat = Number(req.query.usdAmount);
    if (!asset || !ADDRESS_PATTERNS[asset]) {
      return res.status(400).json({ error: 'Invalid or missing asset. Use ETH, SOL, or BTC' });
    }
    if (!Number.isFinite(fiat) || fiat < 1 || fiat > 10000) {
      return res.status(400).json({ error: 'USD amount must be between 1 and 10000' });
    }
    const priceUsd = await getAssetPriceUsd(asset);
    const feeUsd = Number((fiat * 0.02).toFixed(2));
    const netUsd = Number((fiat * 0.98).toFixed(2));
    const cryptoAmount = Number((netUsd / priceUsd).toFixed(8));
    res.json({
      asset,
      usdAmount: fiat,
      feeUsd,
      netUsd,
      priceUsd,
      cryptoAmount,
    });
  } catch (err) {
    console.error('[quote]', err);
    res.status(502).json({ error: 'Quote unavailable' });
  }
});

app.get('/api/health', async (_req, res) => {
  let store = db.driver === 'sqlite' ? 'sqlite' : 'down';
  try {
    await ready;
    if (db.driver === 'sqlite') {
      store = 'sqlite';
    } else {
      const ping = await db.query('SELECT 1 AS ok');
      store = ping.rows && ping.rows.length ? 'ok' : 'down';
    }
  } catch (err) {
    console.warn('[health] store', err.message);
    store = 'down';
  }
  res.json({
    ok: true,
    mode: 'live',
    stripe: STRIPE_LIVE,
    webhook: Boolean(STRIPE_WEBHOOK_SECRET),
    store,
    driver: db.driver,
    networks: {
      ETH: { chainId: 1, network: 'mainnet' },
      SOL: { network: 'mainnet-beta' },
      BTC: { network: 'mainnet' },
    },
    payouts: payoutReady(),
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log('Payment-to-asset production server listening on http://' + HOST + ':' + PORT);
    console.log('Stripe mode: ' + (STRIPE_LIVE ? 'live' : 'not configured'));
    console.log('CORS origin: ' + CLIENT_URL);
    console.log('DB driver: ' + db.driver);
  });
}
