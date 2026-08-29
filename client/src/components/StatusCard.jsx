import { SERVICE_FEE } from '../lib/assets';

const RAILS = [
  { id: 'ETH', label: 'Ethereum', chain: 'Ethereum', tint: 'eth' },
  { id: 'SOL', label: 'Solana', chain: 'Solana', tint: 'sol' },
  { id: 'BTC', label: 'Bitcoin', chain: 'Bitcoin', tint: 'btc' },
];

export default function StatusCard({ health }) {
  const stripeLabel = health?.stripe
    ? 'Stripe live'
    : health
      ? 'Stripe key missing'
      : 'Stripe';
  const storeLabel = health?.store && health.store !== 'down' ? health.store : health ? 'store down' : '—';

  return (
    <aside className="glass mini-card status-float">
      <div className="mini-head">
        <h3>Live rails</h3>
        <span className="pill">
          <span className="live-dot" />
          {health?.ok ? 'health' : 'offline'}
        </span>
      </div>
      {RAILS.map((rail) => {
        const ready = health?.payouts?.[rail.id];
        return (
          <div key={rail.id} className="rail-row">
            <span className={`rail-dot ${rail.tint}`} />
            <div className="rail-copy">
              <strong>{rail.id}</strong>
              <span>{rail.label}</span>
            </div>
            <span className="rail-chip">
              {ready === true ? 'ready' : 'offline'}
            </span>
          </div>
        );
      })}
      <div className="detail-row" style={{ marginTop: 8, borderBottom: 0 }}>
        <span>Fee</span>
        <span className="accent">{Math.round(SERVICE_FEE * 100)}%</span>
      </div>
      <div className="detail-row" style={{ paddingTop: 0 }}>
        <span>Checkout</span>
        <span>{stripeLabel}</span>
      </div>
      <div className="detail-row" style={{ paddingTop: 0 }}>
        <span>Store</span>
        <span>{storeLabel}</span>
      </div>
    </aside>
  );
}
