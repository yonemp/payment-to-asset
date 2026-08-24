/**
 * Payment-to-Asset production server.
 * Stripe live mode + real mainnet payouts (ETH / SOL / BTC).
 */
require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { createDb, schemaSql, nowExpr, migrateSql } = require('./db');

let rateLimit = function (_opts) {
  return function (_req, _res, next) { next(); };
};
try {
  rateLimit = require('express-rate-limit');
} catch (err) {
  console.warn('[boot] express-rate-limit unavailable:', err.message);
}

let Stripe = null;
try {
  Stripe = require('stripe');
} catch (err) {
  console.warn('[boot] stripe unavailable:', err.message);
}

let payouts;
try {
  payouts = require('./payouts');
} catch (err) {
  console.warn('[boot] payouts module failed to load:', err.message);
  payouts = {
    NETWORKS: {
      ETH: { symbol: 'ETH', explorerTx: function () { return null; } },
      SOL: { symbol: 'SOL', explorerTx: function () { return null; } },
      BTC: { symbol: 'BTC', explorerTx: function () { return null; } },
    },
    ADDRESS_PATTERNS: {
      ETH: /^0x[a-fA-F0-9]{40}$/,
      SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
    },
    FALLBACK_PRICES_USD: { ETH: 3200.0, SOL: 145.0, BTC: 65000.0 },
    COINGECKO_IDS: { ETH: 'ethereum', SOL: 'solana', BTC: 'bitcoin' },
    validateWalletAddress: function (asset, address) {
      const pattern = {
        ETH: /^0x[a-fA-F0-9]{40}$/,
        SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
        BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
      }[asset];
      if (!pattern) return { valid: false, error: 'Unsupported asset. Use ETH, SOL, or BTC' };
      if (!address || typeof address !== 'string') return { valid: false, error: 'Wallet address required' };
      if (!pattern.test(address.trim())) return { valid: false, error: 'Invalid ' + asset + ' mainnet address format' };
      return { valid: true };
    },
    payoutReady: function () { return { ETH: false, SOL: false, BTC: false }; },
    sendPayout: async function () { throw new Error('Payout module failed to load'); },
    depositAddressFor: function () { return null; },
  };
}

const {
  NETWORKS,
  ADDRESS_PATTERNS,
  FALLBACK_PRICES_USD,
  COINGECKO_IDS,
  validateWalletAddress,
  payoutReady,
  sendPayout,
  depositAddressFor,
} = payouts;

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const CLIENT_URL = process.env.CLIENT_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? ('https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL) : (process.env.VERCEL_URL ? ('https://' + process.env.VERCEL_URL) : 'http://localhost:5173'));
const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const STRIPE_LIVE = STRIPE_SECRET_KEY.startsWith('sk_live_');

const stripe = (STRIPE_SECRET_KEY && Stripe)
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' })
  : null;

const db = createDb();
const ready = Promise.resolve()
  .then(function () {
    if (!db || db.driver === 'down') return;
    const sql = schemaSql(db.driver);
    if (!sql) return;
    return db.exec(sql);
  })
  .then(function () {
    if (!db || db.driver === 'down') return;
    const extras = typeof migrateSql === 'function' ? migrateSql(db.driver) : [];
    return extras.reduce(function (prev, sql) {
      return prev.then(function () {
        return db.exec(sql).catch(function (err) {
          console.warn('[db] migrate:', err.message);
        });
      });
    }, Promise.resolve());
  })
  .catch(function (err) {
    console.warn('[db] schema init failed:', err.message);
  });

function storeDownPayload(err, message) {
  return {
    error: message || 'Order store is unavailable',
    code: 'STORE_DOWN',
    detail: err && err.message ? String(err.message) : 'store unreachable',
  };
}

function isUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function isStripeSessionId(id) {
  return /^cs_(live|test)_[A-Za-z0-9]+$/i.test(id);
}

function isStripePaymentIntentId(id) {
  return /^pi_(live_|test_)?[A-Za-z0-9]+$/i.test(id);
}

function parseShortOrderId(id) {
  const normalized = String(id || '').trim().replace(/\.\.\./g, '…');
  if (!normalized) return null;
  if (normalized.includes('…')) {
    const parts = normalized.split('…');
    if (parts.length === 2 && parts[0].length >= 6 && parts[1].length >= 4) {
      return { prefix: parts[0], suffix: parts[1] };
    }
    return null;
  }
  if (/^[0-9a-f]{8}(-[0-9a-f]{0,4}){0,4}[0-9a-f-]*$/i.test(normalized) && normalized.length >= 8 && normalized.length < 36) {
    return { prefix: normalized, suffix: null };
  }
  return null;
}

function inferSwapFromSession(order) {
  const sid = String(order && order.stripe_session_id || '');
  if (!sid.startsWith('swap:')) return null;
  const parts = sid.split(':');
  return {
    from_asset: parts[1] || null,
    from_amount: parts[2] ? Number(parts[2]) : null,
    deposit_address: parts[3] && parts[3] !== 'unconfigured' ? parts.slice(3).join(':') : null,
  };
}

function publicOrder(order) {
  const encoded = inferSwapFromSession(order);
  const kind = order.kind || (encoded ? 'swap' : 'buy');
  const fromAsset = order.from_asset || (encoded && encoded.from_asset) || null;
  const toAsset = order.to_asset || (kind === 'swap' ? order.asset : null);
  const fromAmount = order.from_amount != null ? order.from_amount : (encoded && encoded.from_amount);
  const deposit = order.deposit_address || (encoded && encoded.deposit_address) || null;
  const meta = NETWORKS[order.asset] || NETWORKS[toAsset];
  return {
    id: order.id,
    kind,
    asset: order.asset,
    from_asset: fromAsset,
    to_asset: toAsset,
    from_amount: fromAmount == null ? null : fromAmount,
    fiat_amount: order.fiat_amount,
    crypto_amount: order.crypto_amount,
    wallet_address: order.wallet_address,
    deposit_address: deposit,
    deposit_configured: Boolean(deposit),
    status: order.status,
    tx_hash: order.tx_hash,
    explorer_url: order.tx_hash && meta ? meta.explorerTx(order.tx_hash) : null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

async function insertOrder(row) {
  await ready;
  if (!db || db.driver === 'down') {
    throw new Error(db && db.reason ? db.reason : 'store unavailable');
  }
  const kind = row.kind || 'buy';
  try {
    await db.query(
      `INSERT INTO orders (id, asset, fiat_amount, crypto_amount, wallet_address, status, stripe_session_id, kind, from_asset, to_asset, from_amount, deposit_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        row.id,
        row.asset,
        row.fiat_amount,
        row.crypto_amount,
        row.wallet_address,
        row.status,
        row.stripe_session_id || null,
        kind,
        row.from_asset || null,
        row.to_asset || null,
        row.from_amount == null ? null : row.from_amount,
        row.deposit_address || null,
      ]
    );
    return;
  } catch (err) {
    const msg = String(err && err.message || '');
    if (!/column|unknown|no such/i.test(msg)) throw err;
    console.warn('[db] insert fallback to base columns:', msg);
  }
  const encoded = kind === 'swap'
    ? ('swap:' + (row.from_asset || '') + ':' + (row.from_amount == null ? '' : row.from_amount) + ':' + (row.deposit_address || 'unconfigured'))
    : (row.stripe_session_id || null);
  await db.query(
    `INSERT INTO orders (id, asset, fiat_amount, crypto_amount, wallet_address, status, stripe_session_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [row.id, row.asset, row.fiat_amount, row.crypto_amount, row.wallet_address, row.status, encoded]
  );
}

async function bindOrderSession(orderId, sessionId, paymentIntentId) {
  await ready;
  if (paymentIntentId) {
    await db.query(
      `UPDATE orders SET stripe_session_id = $1, stripe_payment_intent_id = $2, updated_at = ${nowExpr(db.driver)} WHERE id = $3`,
      [sessionId, paymentIntentId, orderId]
    );
    return;
  }
  await db.query(
    `UPDATE orders SET stripe_session_id = $1, updated_at = ${nowExpr(db.driver)} WHERE id = $2`,
    [sessionId, orderId]
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

async function getOrderByPaymentIntent(piId) {
  await ready;
  let order = await db.get(`SELECT * FROM orders WHERE stripe_payment_intent_id = $1`, [piId]);
  if (order) return order;
  if (!stripe) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    const orderId = pi && pi.metadata && pi.metadata.order_id;
    if (orderId) {
      order = await getOrderById(orderId);
      if (order) {
        try {
          await bindOrderSession(order.id, order.stripe_session_id || null, piId);
        } catch (err) {
          console.warn('[order] bind pi', err.message);
        }
        return order;
      }
    }
    const listed = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
    const sessionId = listed && listed.data && listed.data[0] && listed.data[0].id;
    if (sessionId) {
      order = await getOrderBySession(sessionId);
      if (order) {
        try {
          await bindOrderSession(order.id, sessionId, piId);
        } catch (err) {
          console.warn('[order] bind pi session', err.message);
        }
        return order;
      }
    }
  } catch (err) {
    console.warn('[order] pi lookup', err.message);
  }
  return null;
}

async function getOrderByShortId(id) {
  await ready;
  const parsed = parseShortOrderId(id);
  if (!parsed) return null;
  const result = parsed.suffix
    ? await db.query(
        `SELECT * FROM orders WHERE id LIKE $1 AND id LIKE $2 LIMIT 2`,
        [parsed.prefix + '%', '%' + parsed.suffix]
      )
    : await db.query(`SELECT * FROM orders WHERE id LIKE $1 LIMIT 2`, [parsed.prefix + '%']);
  if (result.rows && result.rows.length === 1) return result.rows[0];
  return null;
}

async function findOrder(id) {
  if (isStripeSessionId(id)) return getOrderBySession(id);
  if (isStripePaymentIntentId(id)) return getOrderByPaymentIntent(id);
  if (isUuid(id)) return getOrderById(id);
  return getOrderByShortId(id);
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
      error: 'Stripe live mode is not configured. Set STRIPE_SECRET_KEY to a rotated sk_live_ key in Vercel (Production). Checkout cannot start without it.',
      code: 'STRIPE_NOT_CONFIGURED',
    });
    return false;
  }
  return true;
}


function normalizeAsset(value) {
  return String(value || '').trim().toUpperCase();
}

async function buildSwapQuote(fromAsset, toAsset, fromAmount) {
  const from = normalizeAsset(fromAsset);
  const to = normalizeAsset(toAsset);
  if (!ADDRESS_PATTERNS[from] || !ADDRESS_PATTERNS[to]) {
    const err = new Error('Invalid or missing asset. Use ETH, SOL, or BTC');
    err.status = 400;
    throw err;
  }
  if (from === to) {
    const err = new Error('fromAsset and toAsset must be different');
    err.status = 400;
    throw err;
  }
  const fromAmt = Number(fromAmount);
  if (!Number.isFinite(fromAmt) || fromAmt <= 0) {
    const err = new Error('Enter a from amount');
    err.status = 400;
    throw err;
  }
  const [fromPriceUsd, toPriceUsd] = await Promise.all([
    getAssetPriceUsd(from),
    getAssetPriceUsd(to),
  ]);
  const usdNotional = Number((fromAmt * fromPriceUsd).toFixed(2));
  const feeUsd = Number((usdNotional * 0.02).toFixed(2));
  const netUsd = Number((usdNotional - feeUsd).toFixed(2));
  const toAmount = toPriceUsd > 0 && netUsd > 0 ? Number((netUsd / toPriceUsd).toFixed(8)) : 0;
  return {
    fromAsset: from,
    toAsset: to,
    fromAmount: fromAmt,
    fromPriceUsd,
    toPriceUsd,
    usdNotional,
    feeUsd,
    netUsd,
    toAmount,
    inRange: usdNotional >= 10 && usdNotional <= 5000,
    minUsd: 10,
    maxUsd: 5000,
    serviceFee: 0.02,
  };
}

async function handleQuoteSwap(req, res) {
  try {
    const fromAsset = req.query.fromAsset || req.query.from;
    const toAsset = req.query.toAsset || req.query.to;
    const fromAmount = req.query.fromAmount || req.query.amount;
    const quote = await buildSwapQuote(fromAsset, toAsset, fromAmount);
    res.json(quote);
  } catch (err) {
    if (err && err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[quote-swap]', err);
    res.status(502).json({ error: 'Swap quote unavailable' });
  }
}

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Stripe-Signature'],
  })
);

const limiterBase = {
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again in a minute' },
  validate: { xForwardedForHeader: false, trustProxy: false },
};

const createLimiter = rateLimit(Object.assign({ max: 10 }, limiterBase));
const orderLimiter = rateLimit(Object.assign({ max: 60 }, limiterBase));

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
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent && session.payment_intent.id) || null;
      let order = await getOrderBySession(sessionId);
      if (!order && paymentIntentId) {
        order = await getOrderByPaymentIntent(paymentIntentId);
      }
      if (order && paymentIntentId && order.stripe_payment_intent_id !== paymentIntentId) {
        try {
          await bindOrderSession(order.id, sessionId, paymentIntentId);
        } catch (err) {
          console.warn('[webhook] bind pi', err.message);
        }
      }
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
    if (!Number.isFinite(fiat) || fiat < 10) {
      return res.status(400).json({ error: 'Minimum purchase is $10' });
    }
    if (fiat > 5000) {
      return res.status(400).json({ error: 'Maximum purchase is $5000' });
    }
    const priceUsd = await getAssetPriceUsd(asset);
    const netUsd = fiat * 0.98;
    const cryptoAmount = Number((netUsd / priceUsd).toFixed(8));
    const orderId = crypto.randomUUID();
    try {
      await insertOrder({
        id: orderId,
        asset,
        fiat_amount: fiat,
        crypto_amount: cryptoAmount,
        wallet_address: walletAddress.trim(),
        status: 'pending',
        stripe_session_id: null,
        kind: 'buy',
      });
    } catch (err) {
      console.error('[create-payment] insert', err);
      return res.status(503).json(storeDownPayload(err, 'Order store is unavailable. Checkout was not started.'));
    }
    let session;
    try {
      session = await stripe.checkout.sessions.create({
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
        payment_intent_data: {
          metadata: {
            order_id: orderId,
            asset,
            wallet_address: walletAddress.trim(),
          },
        },
      });
    } catch (err) {
      console.error('[create-payment] stripe', err);
      return res.status(500).json({
        error: 'Failed to create payment session',
        detail: err.message,
        orderId,
      });
    }
    try {
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent && session.payment_intent.id) || null;
      await bindOrderSession(orderId, session.id, paymentIntentId);
    } catch (err) {
      console.error('[create-payment] bind session', err);
    }
    res.json({
      sessionId: session.id,
      url: session.url,
      orderId,
      cryptoAmount,
      priceUsed: priceUsd,
    });
  } catch (err) {
    console.error('[create-payment]', err);
    const storeish = err && (err.code === 'STORE_DOWN' || /store /i.test(String(err.message || '')));
    res.status(storeish ? 503 : 500).json(
      storeish
        ? storeDownPayload(err, 'Order store is unavailable. Checkout was not started.')
        : { error: 'Failed to create payment session', detail: err.message }
    );
  }
});


app.post('/api/create-swap', createLimiter, async (req, res) => {
  try {
    const fromAsset = normalizeAsset(req.body && req.body.fromAsset);
    const toAsset = normalizeAsset(req.body && req.body.toAsset);
    const fromAmount = req.body && req.body.fromAmount;
    const walletAddress = req.body && req.body.walletAddress;
    let quote;
    try {
      quote = await buildSwapQuote(fromAsset, toAsset, fromAmount);
    } catch (err) {
      if (err && err.status === 400) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
    if (!quote.inRange) {
      if (quote.usdNotional < 10) {
        return res.status(400).json({ error: 'Minimum swap is $10 equivalent' });
      }
      return res.status(400).json({ error: 'Maximum swap is $5000 equivalent' });
    }
    const addrCheck = validateWalletAddress(toAsset, walletAddress);
    if (!addrCheck.valid) {
      return res.status(400).json({ error: addrCheck.error });
    }
    let depositAddress = null;
    try {
      depositAddress = typeof depositAddressFor === 'function' ? depositAddressFor(fromAsset) : null;
    } catch (err) {
      console.warn('[create-swap] deposit address', err.message);
      depositAddress = null;
    }
    const orderId = crypto.randomUUID();
    try {
      await insertOrder({
        id: orderId,
        asset: toAsset,
        fiat_amount: quote.usdNotional,
        crypto_amount: quote.toAmount,
        wallet_address: String(walletAddress).trim(),
        status: 'pending',
        stripe_session_id: null,
        kind: 'swap',
        from_asset: fromAsset,
        to_asset: toAsset,
        from_amount: quote.fromAmount,
        deposit_address: depositAddress,
      });
    } catch (err) {
      console.error('[create-swap] insert', err);
      return res.status(503).json(storeDownPayload(err, 'Order store is unavailable. Swap was not created.'));
    }
    const configured = Boolean(depositAddress);
    res.json({
      orderId,
      kind: 'swap',
      fromAsset,
      toAsset,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      usdNotional: quote.usdNotional,
      feeUsd: quote.feeUsd,
      netUsd: quote.netUsd,
      fromPriceUsd: quote.fromPriceUsd,
      toPriceUsd: quote.toPriceUsd,
      walletAddress: String(walletAddress).trim(),
      depositAddress: depositAddress,
      depositConfigured: configured,
      status: 'pending',
      instruction: configured
        ? ('Send ' + quote.fromAmount + ' ' + fromAsset + ' to this address')
        : 'Deposit address not configured',
    });
  } catch (err) {
    console.error('[create-swap]', err);
    const storeish = err && (err.code === 'STORE_DOWN' || /store /i.test(String(err.message || '')));
    res.status(storeish ? 503 : 500).json(
      storeish
        ? storeDownPayload(err, 'Order store is unavailable. Swap was not created.')
        : { error: 'Failed to create swap', detail: err.message }
    );
  }
});

app.get('/api/order/:id', orderLimiter, async (req, res) => {
  try {
    if (!db || db.driver === 'down') {
      return res.status(503).json(storeDownPayload({ message: db && db.reason ? db.reason : 'store unavailable' }));
    }
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Order ID required', code: 'BAD_ID' });
    }
    const order = await findOrder(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    res.json(publicOrder(order));
  } catch (err) {
    console.error('[order]', err);
    res.status(503).json(storeDownPayload(err));
  }
});

app.get('/api/quote-swap', orderLimiter, handleQuoteSwap);

app.get('/api/quote', orderLimiter, async (req, res) => {
  try {
    if ((req.query.fromAsset || req.query.from) && (req.query.toAsset || req.query.to)) {
      return handleQuoteSwap(req, res);
    }
    const asset = String(req.query.asset || '').toUpperCase();
    const fiat = Number(req.query.usdAmount);
    if (!asset || !ADDRESS_PATTERNS[asset]) {
      return res.status(400).json({ error: 'Invalid or missing asset. Use ETH, SOL, or BTC' });
    }
    if (!Number.isFinite(fiat) || fiat < 10) {
      return res.status(400).json({ error: 'Minimum purchase is $10' });
    }
    if (fiat > 5000) {
      return res.status(400).json({ error: 'Maximum purchase is $5000' });
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
  let store = 'down';
  try {
    await ready;
    if (!db || db.driver === 'down') {
      store = 'down';
    } else if (db.driver === 'sqlite') {
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
    store_code: store === 'down' ? 'STORE_DOWN' : undefined,
    driver: db && db.driver ? db.driver : 'down',
    networks: {
      ETH: { chainId: 1, network: 'mainnet' },
      SOL: { network: 'mainnet-beta' },
      BTC: { network: 'mainnet' },
    },
    payouts: payoutReady(),
    swapDeposits: {
      SOL: Boolean(typeof depositAddressFor === 'function' && depositAddressFor('SOL')),
      ETH: Boolean(typeof depositAddressFor === 'function' && depositAddressFor('ETH')),
      BTC: Boolean(typeof depositAddressFor === 'function' && depositAddressFor('BTC')),
    },
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log('Payment-to-asset production server listening on http://' + HOST + ':' + PORT);
    console.log('Stripe mode: ' + (STRIPE_LIVE ? 'live' : 'not configured'));
    console.log('CORS origin: ' + CLIENT_URL);
    console.log('DB driver: ' + (db && db.driver ? db.driver : 'down'));
  });
}
