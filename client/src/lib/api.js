import { API } from './assets';

function messageFromApi(res, data, fallback) {
  const detail = data && typeof data.detail === 'string' && data.detail.trim() ? data.detail.trim() : '';
  if (data && data.code === 'STORE_DOWN') {
    return (data.error && data.error.trim()) || 'Order store is unavailable (STORE_DOWN)';
  }
  if (data && typeof data.error === 'string' && data.error.trim()) {
    if (res.status >= 500 || res.status === 503) {
      return detail ? data.error + ' — ' + detail : data.error;
    }
    return data.error;
  }
  if (res.status === 503) {
    if (/stripe|whop|checkout/i.test(fallback)) {
      return 'Checkout is unavailable (503). Card checkout is not configured — add WHOP_API_KEY and WHOP_ACCOUNT_ID in Vercel Production.';
    }
    return fallback + ' (503). The order store is down or unreachable.';
  }
  if (res.status === 400) {
    return fallback + ' (bad request). Check the amount.';
  }
  if (res.status >= 500) {
    return fallback + ' (server ' + res.status + '). The API crashed or is misconfigured — this is not a wallet-validation error.';
  }
  if (res.status === 404) {
    return fallback;
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

export async function createPayment({ usdAmount }) {
  const res = await fetch(`${API}/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usdAmount }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Failed to create session'));
  return data;
}

export async function createSwap({ fromAsset, toAsset, fromAmount, walletAddress }) {
  const res = await fetch(`${API}/create-swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromAsset, toAsset, fromAmount, walletAddress }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Failed to create swap'));
  return data;
}

export async function fetchOrder(id) {
  const trimmed = String(id || '').trim();
  const res = await fetch(`${API}/order/${encodeURIComponent(trimmed)}`);
  const data = await readJson(res);
  if (!res.ok) {
    const err = new Error(messageFromApi(res, data, 'Order not found'));
    err.status = res.status;
    err.code = data && data.code ? data.code : null;
    err.detail = data && data.detail ? data.detail : null;
    throw err;
  }
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

export async function fetchSwapQuote({ fromAsset, toAsset, fromAmount, signal }) {
  const params = new URLSearchParams({
    fromAsset,
    toAsset,
    fromAmount: String(fromAmount),
  });
  const res = await fetch(`${API}/quote-swap?${params}`, { signal });
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Swap quote unavailable'));
  return data;
}

export async function confirmSwapTx({ orderId, txHash }) {
  const res = await fetch(`${API}/confirm-swap-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, txHash }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Failed to save deposit transaction'));
  return data;
}

export async function fetchHealth() {
  const res = await fetch(`${API}/health`);
  const data = await readJson(res);
  if (!res.ok) throw new Error(messageFromApi(res, data, 'Health check failed'));
  return data;
}
