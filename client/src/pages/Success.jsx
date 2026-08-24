import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Timeline from '../components/Timeline';
import { fetchOrder } from '../lib/api';
import { formatCrypto, formatUsd, getAsset, shorten } from '../lib/assets';

function CopyableId({ value, label }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="order-id-box">
      <span>{label}</span>
      <p className="mono">{value}</p>
      <button type="button" className="btn-copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy full ID'}
      </button>
    </div>
  );
}

export default function Success() {
  const [searchParams] = useSearchParams();
  const orderId = (searchParams.get('order_id') || '').trim();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await fetchOrder(orderId);
      setOrder(data);
      setError('');
      if (data.status === 'completed' || data.status === 'failed') {
        setPolling(false);
      }
    } catch (err) {
      setError(err.message);
      if (err.code === 'STORE_DOWN' || err.status === 503) {
        setPolling(true);
        return;
      }
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

  const isSwap = order && order.kind === 'swap';
  const toCode = (order && (order.to_asset || order.asset)) || 'SOL';
  const fromCode = (order && order.from_asset) || null;
  const meta = getAsset(toCode);
  const fromMeta = fromCode ? getAsset(fromCode) : null;
  const explorerUrl =
    order?.explorer_url ||
    (order?.tx_hash && meta ? meta.explorer(order.tx_hash) : null);
  const displayId = order?.id || orderId;

  return (
    <section className="section status-page">
      <div className="wrap status-wrap">
        <div className="section-head">
          <p className="kicker">// Order</p>
          <h1>Your order</h1>
          <p>
            {isSwap
              ? 'Deposit → Quoted → Settling → Delivered. This page updates until the outbound transfer lands or fails. We do not mark a swap complete until it actually settles.'
              : 'Paid → Quoted → Broadcasting → Confirmed. This page updates until the transfer lands or fails.'}
          </p>
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
                    <span className="pill">{isSwap ? `${order.from_asset} → ${toCode}` : order.asset}</span>
                  </div>
                  <Timeline order={order} />

                  {isSwap && order.status === 'pending' && order.deposit_address && (
                    <div className="deposit-box">
                      <CopyableId
                        value={order.deposit_address}
                        label={`Send ${formatCrypto(order.from_amount, order.from_asset)} to this address`}
                      />
                      <p className="deposit-help">
                        Send exactly that amount to this address. The swap stays pending until the deposit is seen. It is not complete yet.
                      </p>
                    </div>
                  )}

                  {isSwap && order.status === 'pending' && !order.deposit_address && (
                    <div className="banner error">
                      Deposit address not configured. This swap order is pending and was not completed. Set SWAP_DEPOSIT_{order.from_asset} (or the matching hot-wallet key) and try again.
                    </div>
                  )}

                  {order.status === 'failed' && (
                    <div className="banner error">
                      {isSwap ? 'Swap failed. The outbound transfer was not broadcast.' : 'Payout failed. The transfer was not broadcast.'}
                      {' '}Contact support with this order ID.
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
              {displayId && <CopyableId value={displayId} label="Order ID" />}
              {!order ? (
                <p className="muted">Save the full order ID. Use it on the lookup page if you come back later.</p>
              ) : (
                <>
                  {isSwap ? (
                    <>
                      <div className="detail-row">
                        <span>Kind</span>
                        <span>Swap</span>
                      </div>
                      <div className="detail-row">
                        <span>You send</span>
                        <span className="mono">{formatCrypto(order.from_amount, order.from_asset)}</span>
                      </div>
                      <div className="detail-row">
                        <span>You get</span>
                        <span className="mono">{formatCrypto(order.crypto_amount, toCode)}</span>
                      </div>
                      <div className="detail-row">
                        <span>USD notional</span>
                        <span>{formatUsd(order.fiat_amount)}</span>
                      </div>
                      {order.deposit_address && (
                        <div className="detail-row">
                          <span>Deposit {fromMeta ? fromMeta.symbol : ''}</span>
                          <span className="mono">{shorten(order.deposit_address, 10, 8)}</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span>Destination</span>
                        <span className="mono">{shorten(order.wallet_address, 10, 8)}</span>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
