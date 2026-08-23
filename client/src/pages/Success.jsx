import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Timeline from '../components/Timeline';
import { fetchOrder } from '../lib/api';
import { formatCrypto, formatUsd, getAsset, shorten } from '../lib/assets';

export default function Success() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await fetchOrder(orderId);
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
      return undefined;
    }
    load();
    const interval = setInterval(() => {
      if (polling) load();
    }, 2000);
    return () => clearInterval(interval);
  }, [orderId, load, polling]);

  useEffect(() => {
    if (order && (order.status === 'completed' || order.status === 'failed')) {
      setPolling(false);
    }
  }, [order]);

  useEffect(() => {
    document.title = 'Your order — Card to Crypto';
  }, []);

  const meta = getAsset(order?.asset);
  const explorerUrl =
    order?.explorer_url ||
    (order?.tx_hash && meta ? meta.explorer(order.tx_hash) : null);

  return (
    <section className="section status-page">
      <div className="wrap status-wrap">
        <div className="section-head">
          <p className="kicker">// Order</p>
          <h1>Your order</h1>
          <p>Paid → Quoted → Broadcasting → Confirmed. This page updates until the transfer lands or fails.</p>
        </div>

        {!orderId && (
          <div className="ticket">
            <div className="banner error">No order ID in the URL.</div>
            <Link to="/lookup" className="btn btn-primary">
              Look up an order
            </Link>
          </div>
        )}

        {orderId && (
          <div className="status-grid">
            <div className="ticket">
              {error && (
                <div className="banner error" role="alert">
                  {error}
                </div>
              )}

              {!order && !error && (
                <div className="center-pad">
                  <span className="spinner" />
                  <p className="muted">Loading order…</p>
                </div>
              )}

              {order && (
                <>
                  <div className="ticket-top">
                    <span className={`status-pill ${order.status}`}>{order.status}</span>
                    <span className="pill">{order.asset}</span>
                  </div>
                  <Timeline order={order} />

                  {order.status === 'failed' && (
                    <div className="banner error">
                      Payout failed. The transfer was not broadcast. Contact support with this
                      order ID.
                    </div>
                  )}

                  {order.status === 'completed' && explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                    >
                      View on {meta.explorerName}
                    </a>
                  )}
                </>
              )}
            </div>

            <aside className="ticket ticket-side">
              <h2 className="ticket-kicker">Order</h2>
              {!order ? (
                <p className="muted mono">{orderId}</p>
              ) : (
                <>
                  <div className="detail-row">
                    <span>Order ID</span>
                    <span className="mono">{shorten(order.id, 10, 8)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Asset</span>
                    <span>{order.asset}</span>
                  </div>
                  <div className="detail-row">
                    <span>You paid</span>
                    <span>{formatUsd(order.fiat_amount)}</span>
                  </div>
                  <div className="detail-row">
                    <span>You get</span>
                    <span className="mono">{formatCrypto(order.crypto_amount, order.asset)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Wallet</span>
                    <span className="mono">{shorten(order.wallet_address, 10, 8)}</span>
                  </div>
                  {order.tx_hash && (
                    <div className="tx-box">
                      <span>Transaction</span>
                      <p className="mono">{order.tx_hash}</p>
                    </div>
                  )}
                </>
              )}
              <div className="side-links">
                <Link to="/buy/sol">Buy again</Link>
                <Link to="/lookup">Look up another</Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
