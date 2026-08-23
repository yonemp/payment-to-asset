import { formatUsd } from '../lib/assets';

const CONFIRM = {
  ETH: 'minutes',
  SOL: 'minutes',
  BTC: 'mempool',
};

export default function MetricRack({ asset, fees, quote, quoteState }) {
  const rate = quoteState === 'ready' && quote?.priceUsd ? formatUsd(quote.priceUsd) : null;
  const bars = [40, 55, 48, 70, 62, 80, 74, 90];

  return (
    <aside className="glass mini-card metrics-float">
      <div className="mini-head">
        <h3>Ticket math</h3>
        <span className="pill">{asset}</span>
      </div>

      <div className="metric-block">
        <dt>Live rate</dt>
        <dd className="mono">
          {rate ? `${rate}` : quoteState === 'loading' ? '…' : 'at payout'}
        </dd>
        {rate && (
          <div className="metric-spark" aria-hidden="true">
            {bars.map((h, i) => (
              <i key={i} style={{ height: `${h}%`, opacity: 0.35 + i * 0.08 }} />
            ))}
          </div>
        )}
      </div>

      <div className="metric-block">
        <dt>Service fee</dt>
        <dd>{formatUsd(fees.fee)}</dd>
        <div className="fee-bar" aria-hidden="true">
          <span className="net" />
          <span className="fee" />
        </div>
      </div>

      <div className="metric-block">
        <dt>Confirm target</dt>
        <dd>{CONFIRM[asset] || 'mainnet'}</dd>
      </div>
    </aside>
  );
}
