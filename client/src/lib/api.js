import { API } from './assets';

export async function createPayment({ asset, walletAddress, usdAmount }) {
  const res = await fetch(`${API}/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset, walletAddress, usdAmount }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to create session');
  return data;
}

export async function fetchOrder(id) {
  const res = await fetch(`${API}/order/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Order not found');
  return data;
}

export async function fetchQuote(asset, usdAmount, signal) {
  const params = new URLSearchParams({
    asset,
    usdAmount: String(usdAmount),
  });
  const res = await fetch(`${API}/quote?${params}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Quote unavailable');
  return data;
}

export async function fetchHealth() {
  const res = await fetch(`${API}/health`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Health check failed');
  return data;
}
