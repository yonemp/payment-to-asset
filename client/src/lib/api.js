import { API } from './assets';

function messageFromApi(res, data, fallback) {
  if (data && typeof data.error === 'string' && data.error.trim()) {
    if (res.status === 503 && /stripe/i.test(data.error)) {
      return data.error;
    }
    return data.error;
  }
  if (res.status === 503) {
    return 'Checkout is unavailable (503). Stripe live mode is not configured — add a rotated STRIPE_SECRET_KEY (sk_live_...) in Vercel Production.';
  }
  if (res.status === 400) {
    return fallback + ' (bad request). Check the wallet address and amount.';
  }
  if (res.status >= 500) {
    return fallback + ' (server ' + res.status + '). The API crashed or is misconfigured — this is not a wallet-validation error.';
  }
  return fallback + ' (HTTP ' + res.status + ')';
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 180) };
  }
}

export async function createPayment({ asset, walletAddress, usdAmount }) {
  const res = await fetch(`${API}/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset, walletAddress, usdAmount }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Failed to create session'));
  return data;
}

export async function fetchOrder(id) {
  const res = await fetch(`${API}/order/${encodeURIComponent(id)}`);
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Order not found'));
  return data;
}

export async function fetchQuote(asset, usdAmount, signal) {
  const params = new URLSearchParams({
    asset,
    usdAmount: String(usdAmount),
  });
  const res = await fetch(`${API}/quote?${params}`, { signal });
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Quote unavailable'));
  return data;
}

export async function fetchHealth() {
  const res = await fetch(`${API}/health`);
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Health check failed'));
  return data;
}
