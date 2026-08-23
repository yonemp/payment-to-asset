const RAILS = [
  { id: 'ETH', label: 'Ethereum', chain: 'mainnet · chainId 1', tint: 'eth' },
  { id: 'SOL', label: 'Solana', chain: 'mainnet-beta', tint: 'sol' },
  { id: 'BTC', label: 'Bitcoin', chain: 'mainnet', tint: 'btc' },
];

export default function StatusCard({ health }) {
  return (
    <aside className="glass mini-card status-float">
      <div className="mini-head">
        <h3>Live rails</h3>
        <span className="pill">
          <span className="live-dot" />
          {health?.ok ? 'health' : 'mainnet'}
        </span>
      </div>
      {RAILS.map((rail) => {
        const ready = health?.payouts?.[rail.id];
        const chain = health?.networks?.[rail.id];
        return (
          <div key={rail.id} className="rail-row">
            <span className={`rail-dot ${rail.tint}`} />
            <div className="rail-copy">
              <strong>{rail.id}</strong>
              <span>{chain?.network || rail.chain}</span>
            </div>
            <span className="rail-chip">
              {ready === true ? 'ready' : 'mainnet'}
            </span>
          </div>
        );
      })}
      <div className="detail-row" style={{ marginTop: 8, borderBottom: 0 }}>
        <span>Fee</span>
        <span className="accent">2%</span>
      </div>
      <div className="detail-row" style={{ paddingTop: 0 }}>
        <span>Checkout</span>
        <span>{health?.stripe ? 'Stripe live' : 'Stripe'}</span>
      </div>
    </aside>
  );
}
