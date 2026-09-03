/**
 * Payment-to-Asset production server.
 * Whop card checkout sells CREDITS (USD net after 14% fee).
 * Crypto redemption is a separate service — not on this site.
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

const swapSettle = require('./swap-settle');
const telegram = require('./telegram');
const whop = require('./whop');
const credits = require('./credits');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const CLIENT_URL = process.env.CLIENT_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? ('https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL) : (process.env.VERCEL_URL ? ('https://' + process.env.VERCEL_URL) : 'http://localhost:5173'));
const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const STRIPE_LIVE = STRIPE_SECRET_KEY.startsWith('sk_live_');
const SERVICE_FEE = 0.14;
const MIN_USD = 25;
const MAX_USD = 5000;

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

function isCheckoutProviderId(id) {
  return isStripeSessionId(id) || whop.isCheckoutId(id);
}

function isProviderPaymentId(id) {
  return isStripePaymentIntentId(id) || whop.isPaymentId(id);
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
  const isCredits = credits.isCreditsOrder(order) || kind === 'credits';
  const creditCode = order.credit_code || (isCredits ? order.wallet_address : null) || null;
  const creditsAmount = order.credits_amount != null
    ? order.credits_amount
    : (isCredits ? order.crypto_amount : null);
  const remaining = order.remaining_balance != null
    ? order.remaining_balance
    : (order.status === 'completed' && isCredits ? creditsAmount : (isCredits ? 0 : null));
  return {
    id: order.id,
    kind,
    product: isCredits ? 'credits' : (kind === 'swap' ? 'swap' : 'buy'),
    asset: isCredits ? 'CREDITS' : order.asset,
    from_asset: fromAsset,
    to_asset: toAsset,
    from_amount: fromAmount == null ? null : fromAmount,
    fiat_amount: order.fiat_amount,
    crypto_amount: isCredits ? null : order.crypto_amount,
    credit_code: creditCode,
    credits_amount: creditsAmount == null ? null : creditsAmount,
    remaining_balance: remaining == null ? null : remaining,
    credits_status: order.credits_status || (isCredits
      ? (order.status === 'completed' ? 'credited' : (order.status === 'failed' ? 'failed' : 'pending'))
      : null),
    redeem_note: isCredits ? 'Redeem site coming soon' : null,
    wallet_address: isCredits ? null : order.wallet_address,
    deposit_address: deposit,
    deposit_configured: Boolean(deposit),
    status: order.status,
    tx_hash: isCredits ? null : order.tx_hash,
    explorer_url: isCredits ? null : ((order.payout_tx || order.tx_hash) && meta ? meta.explorerTx(order.payout_tx || order.tx_hash) : null),
    deposit_tx: order.deposit_tx || null,
    payout_tx: isCredits ? null : (order.payout_tx || (kind === 'swap' ? order.tx_hash : null)),
    payout_note: order.payout_note || null,
    deposit_explorer_url: order.deposit_tx && fromAsset && NETWORKS[fromAsset] ? NETWORKS[fromAsset].explorerTx(order.deposit_tx) : null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

async function withCredits(order) {
  if (!order) return order;
  const row = await getCreditsByOrderId(order.id);
  if (!row) return order;
  return Object.assign({}, order, {
    credit_code: order.credit_code || row.credit_code,
    credits_amount: order.credits_amount != null ? order.credits_amount : row.credits_amount,
    remaining_balance: row.remaining_balance,
    credits_status: row.status,
  });
}

async function insertOrder(row) {
  await ready;
  if (!db || db.driver === 'down') {
    throw new Error(db && db.reason ? db.reason : 'store unavailable');
  }
  const kind = row.kind || 'buy';
  try {
    await db.query(
      `INSERT INTO orders (id, asset, fiat_amount, crypto_amount, wallet_address, status, stripe_session_id, kind, from_asset, to_asset, from_amount, deposit_address, deposit_tx, payout_tx, payout_note, credit_code, credits_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
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
        row.deposit_tx || null,
        row.payout_tx || null,
        row.payout_note || null,
        row.credit_code || null,
        row.credits_amount == null ? null : row.credits_amount,
      ]
    );
    return;
  } catch (err) {
    const msg = String(err && err.message || '');
    if (!/column|unknown|no such/i.test(msg)) throw err;
    console.warn('[db] insert fallback without credit columns:', msg);
  }
  try {
    await db.query(
      `INSERT INTO orders (id, asset, fiat_amount, crypto_amount, wallet_address, status, stripe_session_id, kind, from_asset, to_asset, from_amount, deposit_address, deposit_tx, payout_tx, payout_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
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
        row.deposit_tx || null,
        row.payout_tx || null,
        row.payout_note || null,
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

async function insertCreditsRow(row) {
  await ready;
  if (!db || db.driver === 'down') {
    throw new Error(db && db.reason ? db.reason : 'store unavailable');
  }
  await db.query(
    `INSERT INTO credits (order_id, credit_code, credits_amount, remaining_balance, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      row.order_id,
      row.credit_code,
      row.credits_amount,
      row.remaining_balance == null ? 0 : row.remaining_balance,
      row.status || 'pending',
    ]
  );
}

async function getCreditsByOrderId(orderId) {
  await ready;
  try {
    return await db.get(`SELECT * FROM credits WHERE order_id = $1`, [orderId]);
  } catch (err) {
    console.warn('[credits] get by order', err.message);
    return null;
  }
}

async function getOrderByCreditCode(code) {
  await ready;
  const normalized = credits.normalizeCreditCode(code);
  if (!normalized) return null;
  try {
    const row = await db.get(`SELECT * FROM credits WHERE credit_code = $1`, [normalized]);
    if (row && row.order_id) {
      const order = await getOrderById(row.order_id);
      if (order) return order;
    }
  } catch (err) {
    console.warn('[credits] lookup table', err.message);
  }
  try {
    return await db.get(`SELECT * FROM orders WHERE credit_code = $1`, [normalized]);
  } catch (err) {
    console.warn('[credits] lookup orders', err.message);
    return null;
  }
}

async function creditPaidOrder(order) {
  if (!order || !order.id) return;
  await ready;
  const nowSql = nowExpr(db.driver);
  try {
    await db.query(
      "UPDATE credits SET remaining_balance = credits_amount, status = 'credited', updated_at = " + nowSql +
        " WHERE order_id = $1 AND status <> 'credited'",
      [order.id]
    );
  } catch (err) {
    console.warn('[credits] credit row', err.message);
  }
  try {
    await db.query(
      "UPDATE orders SET status = 'completed', updated_at = " + nowSql + " WHERE id = $1",
      [order.id]
    );
  } catch (err) {
    console.warn('[credits] complete order', err.message);
  }
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
  if (whop.configured() && whop.isPaymentId(piId)) {
    try {
      const payment = await whop.retrievePayment(piId);
      const orderId = whop.orderIdFromPayment(payment);
      if (orderId) {
        order = await getOrderById(orderId);
        if (order) {
          try {
            await bindOrderSession(order.id, payment.checkout_configuration_id || order.stripe_session_id || null, piId);
          } catch (err) {
            console.warn('[order] bind whop pay', err.message);
          }
          return order;
        }
      }
      if (payment && payment.checkout_configuration_id) {
        order = await getOrderBySession(payment.checkout_configuration_id);
        if (order) {
          try {
            await bindOrderSession(order.id, payment.checkout_configuration_id, piId);
          } catch (err) {
            console.warn('[order] bind whop pay session', err.message);
          }
          return order;
        }
      }
    } catch (err) {
      console.warn('[order] whop pay lookup', err.message);
    }
    return null;
  }
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
  if (credits.isCreditCode(id)) return getOrderByCreditCode(id);
  if (isCheckoutProviderId(id)) return getOrderBySession(id);
  if (isProviderPaymentId(id)) return getOrderByPaymentIntent(id);
  if (isUuid(id)) return getOrderById(id);
  return getOrderByShortId(id);
}

async function notifyPaidOnce(order) {
  try {
    await telegram.notifyPaidOrder(db, order, nowExpr(db.driver));
  } catch (err) {
    console.warn('[telegram] notify', err.message);
  }
}

async function maybeNotifyFromVerifiedStripe(order) {
  if (!order || telegram.isSwapLike(order)) return;
  if (!telegram.configured()) return;
  if (order.telegram_notified_at) return;
  try {
    let paid = false;
    const sid = order.stripe_session_id;
    if (whop.configured() && sid && whop.isCheckoutId(sid)) {
      const listed = await whop.listPaymentsForCheckout(sid);
      const rows = (listed && listed.data) || [];
      paid = rows.some(function (row) { return whop.paymentSucceeded(row); });
    } else if (whop.configured() && order.stripe_payment_intent_id && whop.isPaymentId(order.stripe_payment_intent_id)) {
      const payment = await whop.retrievePayment(order.stripe_payment_intent_id);
      paid = whop.paymentSucceeded(payment);
    } else if (stripe && sid && isStripeSessionId(sid)) {
      const session = await stripe.checkout.sessions.retrieve(sid);
      paid = Boolean(session && session.payment_status === 'paid');
    } else if (stripe && order.stripe_payment_intent_id && isStripePaymentIntentId(order.stripe_payment_intent_id)) {
      const intent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      paid = Boolean(intent && intent.status === 'succeeded');
    }
    if (paid) await notifyPaidOnce(order);
  } catch (err) {
    console.warn('[telegram] success-page verify', err.message);
  }
}

async function handleWhopPaymentSucceeded(payment) {
  const paymentId = payment && payment.id ? payment.id : null;
  const checkoutId = payment && payment.checkout_configuration_id ? payment.checkout_configuration_id : null;
  const metaOrderId = whop.orderIdFromPayment(payment);
  let order = null;
  if (metaOrderId) {
    try { order = await getOrderById(metaOrderId); } catch (err) { console.warn('[whop-webhook] order id', err.message); }
  }
  if (!order && checkoutId) {
    try { order = await getOrderBySession(checkoutId); } catch (err) { console.warn('[whop-webhook] checkout', err.message); }
  }
  if (!order && paymentId) {
    try { order = await getOrderByPaymentIntent(paymentId); } catch (err) { console.warn('[whop-webhook] pay', err.message); }
  }
  if (!order) {
    console.warn('[whop-webhook] No order for payment');
    return;
  }
  try {
    await bindOrderSession(order.id, checkoutId || order.stripe_session_id || null, paymentId);
  } catch (err) {
    console.warn('[whop-webhook] bind', err.message);
  }
  await notifyPaidOnce(order);
  if (credits.isCreditsOrder(order)) {
    await creditPaidOrder(order);
    console.log('[credits] Order ' + order.id + ' credited');
    return;
  }
  if (order.status === 'completed' && order.tx_hash) return;
  const sessionKey = checkoutId || order.stripe_session_id;
  if (!sessionKey) return;
  await updateOrderStatus({ status: 'processing', stripe_session_id: sessionKey });
  try {
    const result = await sendPayout({
      asset: order.asset,
      cryptoAmount: order.crypto_amount,
      walletAddress: order.wallet_address,
    });
    await updateOrderBySession({
      status: 'completed',
      tx_hash: result.txHash,
      stripe_session_id: sessionKey,
    });
    console.log('[payout] Order ' + order.id + ' completed -> ' + result.txHash);
  } catch (err) {
    await updateOrderBySession({
      status: 'failed',
      tx_hash: null,
      stripe_session_id: sessionKey,
    });
    console.error('[payout] Order ' + order.id + ' failed:', err.message);
  }
}

const PRICE_CACHE_MS = 30000;
const priceCache = new Map();
const COINBASE_PAIRS = { ETH: 'ETH-USD', SOL: 'SOL-USD', BTC: 'BTC-USD' };
const BINANCE_SYMBOLS = { ETH: 'ETHUSDT', SOL: 'SOLUSDT', BTC: 'BTCUSDT' };

function parsePositivePrice(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchJsonWithTimeout(url, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CardToCrypto/1.0 (price)',
      },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function priceFromCoinGecko(asset) {
  const id = COINGECKO_IDS[asset];
  if (!id) throw new Error('no CoinGecko id');
  const data = await fetchJsonWithTimeout(
    'https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(id) + '&vs_currencies=usd',
    4000
  );
  const price = parsePositivePrice(data && data[id] && data[id].usd);
  if (!price) throw new Error('invalid CoinGecko payload');
  return price;
}

async function priceFromCoinbase(asset) {
  const pair = COINBASE_PAIRS[asset];
  if (!pair) throw new Error('no Coinbase pair');
  const data = await fetchJsonWithTimeout(
    'https://api.coinbase.com/v2/prices/' + pair + '/spot',
    4000
  );
  const price = parsePositivePrice(data && data.data && data.data.amount);
  if (!price) throw new Error('invalid Coinbase payload');
  return price;
}

async function priceFromBinance(asset) {
  const symbol = BINANCE_SYMBOLS[asset];
  if (!symbol) throw new Error('no Binance symbol');
  const data = await fetchJsonWithTimeout(
    'https://api.binance.com/api/v3/ticker/price?symbol=' + symbol,
    4000
  );
  const price = parsePositivePrice(data && data.price);
  if (!price) throw new Error('invalid Binance payload');
  return price;
}

async function getAssetPriceUsd(asset) {
  const cached = priceCache.get(asset);
  if (cached && (Date.now() - cached.at) < PRICE_CACHE_MS && cached.price > 0) {
    return cached.price;
  }

  const sources = [
    { name: 'coinbase', fn: priceFromCoinbase },
    { name: 'coingecko', fn: priceFromCoinGecko },
    { name: 'binance', fn: priceFromBinance },
  ];

  const raced = await Promise.allSettled(sources.map(function (src) {
    return src.fn(asset).then(function (price) {
      return { name: src.name, price: price };
    });
  }));

  let winner = null;
  const errors = [];
  for (let i = 0; i < raced.length; i++) {
    const r = raced[i];
    if (r.status === 'fulfilled' && r.value && r.value.price > 0) {
      if (!winner) winner = r.value;
    } else if (r.status === 'rejected') {
      errors.push(sources[i].name + ': ' + (r.reason && r.reason.message ? r.reason.message : String(r.reason)));
    }
  }

  if (winner) {
    priceCache.set(asset, { price: winner.price, at: Date.now(), source: winner.name });
    return winner.price;
  }

  if (cached && cached.price > 0) {
    console.warn('[price] all live feeds failed for ' + asset + ', using last live ' + cached.source + ' @ ' + cached.price + ' — ' + errors.join('; '));
    return cached.price;
  }

  console.warn('[price] all live feeds failed for ' + asset + ' — ' + errors.join('; '));
  const err = new Error('Live ' + asset + ' price unavailable');
  err.status = 502;
  throw err;
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

function requireWhop(res) {
  if (!whop.configured()) {
    res.status(503).json({
      error: 'Card checkout is not configured. Set WHOP_API_KEY and WHOP_ACCOUNT_ID in Vercel (Production). Checkout cannot start without it.',
      code: 'WHOP_NOT_CONFIGURED',
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
  const feeUsd = Number((usdNotional * SERVICE_FEE).toFixed(2));
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
    inRange: usdNotional >= MIN_USD && usdNotional <= MAX_USD,
    minUsd: MIN_USD,
    maxUsd: MAX_USD,
    serviceFee: SERVICE_FEE,
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
    allowedHeaders: ['Content-Type', 'Stripe-Signature', 'webhook-id', 'webhook-timestamp', 'webhook-signature'],
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
      await notifyPaidOnce(order);
      if (credits.isCreditsOrder(order)) {
        await creditPaidOrder(order);
        console.log('[credits] Order ' + order.id + ' credited');
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

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const piId = pi && pi.id;
      let order = null;
      try {
        if (piId) order = await getOrderByPaymentIntent(piId);
        if (!order && pi && pi.metadata && pi.metadata.order_id) {
          order = await getOrderById(pi.metadata.order_id);
        }
      } catch (err) {
        console.warn('[webhook] pi lookup', err.message);
      }
      if (order) await notifyPaidOnce(order);
    }

    res.json({ received: true });
  }
);

app.post(
  '/api/whop-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const secret = whop.webhookSecret();
    if (!secret) {
      return res.status(503).send('Whop webhook is not configured');
    }
    let event;
    try {
      event = whop.verifyWebhook(req.body, req.headers, secret);
    } catch (err) {
      console.error('[whop-webhook] verify', err.message);
      return res.status(err.status || 400).send('Webhook Error: ' + err.message);
    }
    try {
      if (event && event.type === 'payment.succeeded') {
        await handleWhopPaymentSucceeded(event.data || {});
      }
    } catch (err) {
      console.error('[whop-webhook] handle', err.message);
    }
    res.json({ received: true });
  }
);

app.use(express.json());

app.post('/api/create-payment', createLimiter, async (req, res) => {
  try {
    if (!requireWhop(res)) return;
    const usdAmount = req.body && req.body.usdAmount;
    const fiat = Number(usdAmount);
    if (!Number.isFinite(fiat) || fiat < MIN_USD) {
      return res.status(400).json({ error: 'Minimum purchase is $25' });
    }
    if (fiat > MAX_USD) {
      return res.status(400).json({ error: 'Maximum purchase is $5000' });
    }
    const math = credits.creditMath(fiat);
    const orderId = crypto.randomUUID();
    let creditCode = credits.generateCreditCode();
    try {
      await insertOrder({
        id: orderId,
        asset: 'CREDITS',
        fiat_amount: fiat,
        crypto_amount: math.creditsAmount,
        wallet_address: creditCode,
        status: 'pending',
        stripe_session_id: null,
        kind: 'credits',
        credit_code: creditCode,
        credits_amount: math.creditsAmount,
      });
    } catch (err) {
      console.error('[create-payment] insert', err);
      return res.status(503).json(storeDownPayload(err, 'Order store is unavailable. Checkout was not started.'));
    }
    let creditsSaved = false;
    for (let i = 0; i < 5 && !creditsSaved; i++) {
      try {
        await insertCreditsRow({
          order_id: orderId,
          credit_code: creditCode,
          credits_amount: math.creditsAmount,
          remaining_balance: 0,
          status: 'pending',
        });
        creditsSaved = true;
      } catch (err) {
        const msg = String(err && err.message || '');
        if (/unique|duplicate/i.test(msg) && i < 4) {
          creditCode = credits.generateCreditCode();
          try {
            await db.query(
              `UPDATE orders SET credit_code = $1, wallet_address = $1, updated_at = ${nowExpr(db.driver)} WHERE id = $2`,
              [creditCode, orderId]
            );
          } catch (bindErr) {
            console.warn('[create-payment] recode', bindErr.message);
          }
          continue;
        }
        console.warn('[create-payment] credits row', err.message);
        break;
      }
    }
    let checkout;
    try {
      checkout = await whop.createCheckout({
        orderId,
        usdAmount: fiat,
        asset: 'CREDITS',
        creditCode: creditCode,
        creditsAmount: math.creditsAmount,
        redirectUrl: CLIENT_URL + '/success?order_id=' + orderId,
        cancelUrl: CLIENT_URL + '/?canceled=1',
      });
    } catch (err) {
      console.error('[create-payment] whop', err && err.message);
      return res.status(err && err.status && err.status < 500 ? err.status : 500).json({
        error: 'Failed to create payment session',
        detail: err.message,
        orderId,
      });
    }
    const purchaseUrl = checkout && (checkout.purchase_url || checkout.purchaseUrl);
    if (!purchaseUrl) {
      return res.status(500).json({
        error: 'Failed to create payment session',
        detail: 'missing purchase_url',
        orderId,
      });
    }
    try {
      await bindOrderSession(orderId, checkout.id, null);
    } catch (err) {
      console.error('[create-payment] bind session', err);
    }
    res.json({
      sessionId: checkout.id,
      url: purchaseUrl,
      purchase_url: purchaseUrl,
      orderId,
      creditCode,
      creditsAmount: math.creditsAmount,
      feeUsd: math.feeUsd,
      product: 'credits',
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
      if (quote.usdNotional < MIN_USD) {
        return res.status(400).json({ error: 'Minimum swap is $25 equivalent' });
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

app.post('/api/confirm-swap-tx', createLimiter, async (req, res) => {
  try {
    const orderId = String((req.body && req.body.orderId) || '').trim();
    const txHash = String((req.body && req.body.txHash) || '').trim();
    if (!orderId || !txHash) {
      return res.status(400).json({ error: 'orderId and txHash are required' });
    }
    if (!db || db.driver === 'down') {
      return res.status(503).json(storeDownPayload({ message: db && db.reason ? db.reason : 'store unavailable' }));
    }
    const order = await findOrder(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
    try {
      await swapSettle.attachDepositTx(db, order, txHash);
    } catch (err) {
      if (err && err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    const fresh = await getOrderById(order.id);
    const allowPayout = String(process.env.SWAP_PAYOUT_ON_API || '') === '1';
    try {
      await swapSettle.settleSwap(db, fresh, { allowPayout });
    } catch (err) {
      console.warn('[confirm-swap-tx] settle', err.message);
    }
    const out = await getOrderById(order.id);
    res.json(publicOrder(out));
  } catch (err) {
    console.error('[confirm-swap-tx]', err);
    const storeish = err && (err.code === 'STORE_DOWN' || /store /i.test(String(err.message || '')));
    res.status(storeish ? 503 : 500).json(
      storeish ? storeDownPayload(err) : { error: 'Failed to confirm swap transaction', detail: err.message }
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
    await maybeNotifyFromVerifiedStripe(order);
    if (credits.isCreditsOrder(order) && order.status === 'pending') {
      try {
        let paid = false;
        const sid = order.stripe_session_id;
        if (whop.configured() && sid && whop.isCheckoutId(sid)) {
          const listed = await whop.listPaymentsForCheckout(sid);
          const rows = (listed && listed.data) || [];
          paid = rows.some(function (row) { return whop.paymentSucceeded(row); });
        } else if (whop.configured() && order.stripe_payment_intent_id && whop.isPaymentId(order.stripe_payment_intent_id)) {
          const payment = await whop.retrievePayment(order.stripe_payment_intent_id);
          paid = whop.paymentSucceeded(payment);
        }
        if (paid) await creditPaidOrder(order);
      } catch (err) {
        console.warn('[order] credits verify', err.message);
      }
    }
    if (swapSettle.isSwap(order) && order.status !== 'completed' && order.status !== 'failed') {
      try {
        const allowPayout = String(process.env.SWAP_PAYOUT_ON_API || '') === '1';
        await swapSettle.settleSwap(db, order, { allowPayout });
      } catch (err) {
        console.warn('[order] settle', err.message);
      }
      const fresh = await withCredits(await getOrderById(order.id) || order);
      return res.json(publicOrder(fresh));
    }
    const enriched = await withCredits(await getOrderById(order.id) || order);
    res.json(publicOrder(enriched));
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
    const asset = String(req.query.asset || 'CREDITS').toUpperCase();
    const fiat = Number(req.query.usdAmount);
    if (!Number.isFinite(fiat) || fiat < MIN_USD) {
      return res.status(400).json({ error: 'Minimum purchase is $25' });
    }
    if (fiat > MAX_USD) {
      return res.status(400).json({ error: 'Maximum purchase is $5000' });
    }
    if (!asset || asset === 'CREDITS' || asset === 'CREDIT') {
      const math = credits.creditMath(fiat);
      return res.json({
        product: 'credits',
        asset: 'CREDITS',
        usdAmount: fiat,
        feeUsd: math.feeUsd,
        netUsd: math.creditsAmount,
        creditsAmount: math.creditsAmount,
        serviceFee: SERVICE_FEE,
        redeem_note: 'Redeem site coming soon',
      });
    }
    if (!ADDRESS_PATTERNS[asset]) {
      return res.status(400).json({ error: 'This site sells credits. Use asset=CREDITS.' });
    }
    const priceUsd = await getAssetPriceUsd(asset);
    const feeUsd = Number((fiat * SERVICE_FEE).toFixed(2));
    const netUsd = Number((fiat * (1 - SERVICE_FEE)).toFixed(2));
    const cryptoAmount = Number((netUsd / priceUsd).toFixed(8));
    const priced = priceCache.get(asset);
    res.json({
      asset,
      usdAmount: fiat,
      feeUsd,
      netUsd,
      priceUsd,
      cryptoAmount,
      priceSource: priced && priced.source ? priced.source : 'live',
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
    whop: whop.configured(),
    webhook: Boolean(whop.webhookSecret()) || Boolean(STRIPE_WEBHOOK_SECRET),
    telegram: telegram.configured(),
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
    console.log('Whop checkout: ' + (whop.configured() ? 'configured' : 'not configured'));
    console.log('Stripe mode: ' + (STRIPE_LIVE ? 'live' : 'not configured'));
    console.log('CORS origin: ' + CLIENT_URL);
    console.log('DB driver: ' + (db && db.driver ? db.driver : 'down'));
  });
}
