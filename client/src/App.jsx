import { Routes, Route, useSearchParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';

const ASSETS = [
  { value: 'ETH', label: 'ETH (Ethereum mainnet)', explorer: (h) => `https://etherscan.io/tx/${h}` },
  { value: 'SOL', label: 'SOL (Solana mainnet)', explorer: (h) => `https://solscan.io/tx/${h}` },
  { value: 'BTC', label: 'BTC (Bitcoin mainnet)', explorer: (h) => `https://mempool.space/tx/${h}` },
];

const API = '/api';

function Home() {
  const [searchParams] = useSearchParams();
  const [asset, setAsset] = useState('ETH');
  const [wallet, setWallet] = useState('');
  const [usd, setUsd] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('canceled') === '1') {
      setError('Payment canceled. You can try again.');
    }
  }, [searchParams]);

  const placeholders = {
    ETH: 'e.g. 0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    SOL: 'e.g. 7EqQdEULxWcraVx3mXKJkd8YBmFjhWFdsNaAwAZr',
    BTC: 'e.g. bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  };

  async function handlePay(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          walletAddress: wallet.trim(),
          usdAmount: Number(usd),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <span className="badge">Mainnet</span>
        <h1 style={{ marginTop: '0.75rem' }}>Pay → Asset</h1>
        <p>Card payment delivers ETH, SOL, or BTC to your mainnet wallet.</p>
      </div>

      <div className="card">
        {error && <div className="error">{error}</div>}

        <form onSubmit={handlePay}>
          <div className="field">
            <label htmlFor="asset">Asset</label>
            <select
              id="asset"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              disabled={loading}
            >
              {ASSETS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="wallet">Wallet address</label>
            <input
              id="wallet"
              className="mono"
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder={placeholders[asset]}
              required
              disabled={loading}
              autoComplete="off"
            />
            <p className="hint">Must be a valid mainnet address for the selected asset.</p>
          </div>

          <div className="field">
            <label htmlFor="usd">USD amount</label>
            <input
              id="usd"
              type="number"
              min="1"
              max="10000"
              step="0.01"
              value={usd}
              onChange={(e) => setUsd(e.target.value)}
              required
              disabled={loading}
            />
            <p className="hint">A 2% service fee is applied before conversion.</p>
          </div>

          <button type="submit" className="btn" disabled={loading || !wallet.trim()}>
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Creating session…
              </>
            ) : (
              'Pay with Stripe'
            )}
          </button>
        </form>
      </div>

      <p className="footer-note">
        Live Stripe Checkout. Delivery is a real mainnet transfer after payment confirms.
      </p>
    </div>
  );
}

function Success() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`${API}/order/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order not found');
      setOrder(data);
      if (data.status === 'completed' || data.status === 'failed') {
        setPolling(false);
      }
    } catch (err) {
      setError(err.message);
      setPolling(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      setError('Missing order_id');
      setPolling(false);
      return;
    }
    fetchOrder();
    const interval = setInterval(() => {
      if (polling) fetchOrder();
    }, 2000);
    return () => clearInterval(interval);
  }, [orderId, fetchOrder, polling]);

  useEffect(() => {
    if (order && (order.status === 'completed' || order.status === 'failed')) {
      setPolling(false);
    }
  }, [order]);

  const assetMeta = ASSETS.find((a) => a.value === order?.asset);
  const explorerUrl =
    order?.explorer_url ||
    (order?.tx_hash && assetMeta ? assetMeta.explorer(order.tx_hash) : null);

  if (!orderId) {
    return (
      <div className="container">
        <div className="card center">
          <p className="error">No order ID in URL.</p>
          <Link to="/" className="btn btn-secondary" style={{ width: 'auto', padding: '0.6rem 1.2rem' }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <span className="badge">Mainnet</span>
        <h1 style={{ marginTop: '0.75rem' }}>Order status</h1>
      </div>

      <div className="card">
        {error && <div className="error">{error}</div>}

        {!order && !error && (
          <div className="center">
            <div className="spinner" />
            <p style={{ color: 'var(--muted)' }}>Loading order…</p>
          </div>
        )}

        {order && (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <span className={`status-pill ${order.status}`}>
                {order.status === 'processing' && (
                  <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                )}
                {order.status}
              </span>
            </div>

            <div className="detail-row">
              <span>Order ID</span>
              <span className="mono">{order.id}</span>
            </div>
            <div className="detail-row">
              <span>Asset</span>
              <span>{order.asset}</span>
            </div>
            <div className="detail-row">
              <span>Fiat paid</span>
              <span>${Number(order.fiat_amount).toFixed(2)}</span>
            </div>
            <div className="detail-row">
              <span>Crypto amount</span>
              <span className="mono">{order.crypto_amount}</span>
            </div>
            <div className="detail-row">
              <span>Wallet</span>
              <span className="mono">{order.wallet_address}</span>
            </div>

            {(order.status === 'pending' || order.status === 'processing') && (
              <div className="center" style={{ padding: '1.5rem 0' }}>
                <div className="spinner" />
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                  {order.status === 'pending'
                    ? 'Waiting for Stripe confirmation…'
                    : 'Broadcasting mainnet payout…'}
                </p>
              </div>
            )}

            {order.status === 'completed' && order.tx_hash && (
              <>
                <p style={{ marginTop: '1rem', fontWeight: 500, color: 'var(--success)' }}>
                  Delivery complete
                </p>
                <div className="tx-box">{order.tx_hash}</div>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ marginTop: '0.5rem' }}
                  >
                    View on explorer
                  </a>
                )}
              </>
            )}

            {order.status === 'failed' && (
              <div className="error" style={{ marginTop: '1rem' }}>
                Payout failed. The transfer was not broadcast. Contact support with this order ID.
              </div>
            )}
          </>
        )}
      </div>

      <p className="footer-note">
        <Link to="/">← New payment</Link>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/success" element={<Success />} />
    </Routes>
  );
}
