/**
 * Whop one-time checkout. REST only. Do not log API keys.
 */
const crypto = require('crypto');

const WHOP_API = 'https://api.whop.com/api/v1';
const API_VERSION = '2026-07-01';

function apiKey() {
  return String(process.env.WHOP_API_KEY || '').trim();
}

function accountId() {
  return String(process.env.WHOP_ACCOUNT_ID || '').trim();
}

function webhookSecret() {
  return String(process.env.WHOP_WEBHOOK_SECRET || '').trim();
}

function configured() {
  return Boolean(apiKey() && accountId());
}

function isCheckoutId(id) {
  return /^ch_[A-Za-z0-9]+$/i.test(String(id || ''));
}

function isPaymentId(id) {
  return /^pay_[A-Za-z0-9]+$/i.test(String(id || ''));
}

function errorMessage(body, status) {
  if (!body) return 'Whop HTTP ' + status;
  if (typeof body.error === 'string') return body.error;
  if (body.error && typeof body.error.message === 'string') return body.error.message;
  if (typeof body.message === 'string') return body.message;
  return 'Whop HTTP ' + status;
}

async function whopFetch(path, opts) {
  const method = (opts && opts.method) || 'GET';
  const headers = {
    Authorization: 'Bearer ' + apiKey(),
    'Api-Version-Date': API_VERSION,
    Accept: 'application/json',
  };
  let body;
  if (opts && opts.body != null) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(WHOP_API + path, { method: method, headers: headers, body: body });
  const text = await res.text();
  let json = {};
  if (text) {
    try { json = JSON.parse(text); } catch { json = { error: text.slice(0, 240) }; }
  }
  if (!res.ok) {
    const err = new Error(errorMessage(json, res.status));
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function createCheckout({ orderId, usdAmount, asset, walletAddress, redirectUrl, cancelUrl }) {
  const acc = accountId();
  const amount = Number(usdAmount);
  const payload = {
    account_id: acc,
    redirect_url: redirectUrl,
    metadata: {
      order_id: orderId,
      asset: asset,
      wallet_address: walletAddress,
    },
    plan: {
      account_id: acc,
      company_id: acc,
      plan_type: 'one_time',
      initial_price: amount,
      currency: 'usd',
      visibility: 'hidden',
      release_method: 'buy_now',
      force_create_new_plan: true,
      title: String(asset) + ' delivery',
      product: {
        external_identifier: 'card-to-crypto',
        title: 'No KYC Card to Crypto',
        visibility: 'hidden',
        redirect_purchase_url: redirectUrl,
      },
    },
  };
  if (cancelUrl) {
    payload.metadata.cancel_url = cancelUrl;
  }
  return whopFetch('/checkout_configurations', { method: 'POST', body: payload });
}

async function retrievePayment(paymentId) {
  return whopFetch('/payments/' + encodeURIComponent(paymentId));
}

async function listPaymentsForCheckout(checkoutId) {
  const qs = new URLSearchParams();
  qs.append('checkout_configuration_ids[]', checkoutId);
  qs.append('first', '10');
  return whopFetch('/payments?' + qs.toString());
}

function paymentSucceeded(payment) {
  if (!payment) return false;
  const status = String(payment.status || '').toLowerCase();
  const sub = String(payment.substatus || '').toLowerCase();
  if (status === 'paid' || status === 'succeeded') return true;
  if (sub === 'succeeded') return true;
  if (payment.paid_at) return true;
  return false;
}

function orderIdFromPayment(payment) {
  if (!payment) return null;
  const meta = payment.metadata || {};
  if (meta.order_id) return String(meta.order_id);
  return null;
}

function verifyWebhook(rawBody, headers, secret) {
  const key = String(secret || webhookSecret() || '');
  if (!key) {
    const err = new Error('WHOP_WEBHOOK_SECRET not set');
    err.status = 503;
    throw err;
  }
  const id = headers['webhook-id'] || headers['Webhook-Id'] || '';
  const ts = headers['webhook-timestamp'] || headers['Webhook-Timestamp'] || '';
  const sigHeader = headers['webhook-signature'] || headers['Webhook-Signature'] || '';
  if (!id || !ts || !sigHeader) {
    const err = new Error('missing webhook signature headers');
    err.status = 400;
    throw err;
  }
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    const err = new Error('webhook timestamp out of range');
    err.status = 400;
    throw err;
  }
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const signed = id + '.' + ts + '.' + raw;
  const digest = crypto.createHmac('sha256', key).update(signed).digest('base64');
  const expected = Buffer.from('v1,' + digest);
  const candidates = String(sigHeader).split(/\s+/).filter(Boolean);
  let ok = false;
  for (let i = 0; i < candidates.length; i++) {
    const got = Buffer.from(String(candidates[i]));
    if (got.length === expected.length && crypto.timingSafeEqual(got, expected)) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    const err = new Error('invalid webhook signature');
    err.status = 400;
    throw err;
  }
  return JSON.parse(raw || '{}');
}

async function createWebhook({ url, events }) {
  return whopFetch('/webhooks', {
    method: 'POST',
    body: {
      url: url,
      events: events || ['payment.succeeded'],
      api_version: 'v1',
      api_version_date: API_VERSION,
    },
  });
}

module.exports = {
  configured,
  webhookSecret,
  apiKey,
  accountId,
  isCheckoutId,
  isPaymentId,
  createCheckout,
  retrievePayment,
  listPaymentsForCheckout,
  paymentSucceeded,
  orderIdFromPayment,
  verifyWebhook,
  createWebhook,
};
