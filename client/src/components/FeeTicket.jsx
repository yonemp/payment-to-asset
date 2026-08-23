import { formatUsd, getAsset } from '../lib/assets';

export default function FeeTicket({ asset, fees, quote, quoteState }) {
  const meta = getAsset(asset);
  const rate =
    quoteState === 'ready' && quote?.priceUsd
      ? `1 ${asset} ≈ ${formatUsd(quote.priceUsd)}`
      : quoteState === 'loading'
        ? 'Fetching live rate…'
        : 'Rate locked at checkout';

  return (
    <div className="buy-meta" aria-live="polite">
      <div className="buy-meta-row">
        <span>Rate</span>
        <span>{rate}</span>
      </div>
      <div className="buy-meta-row">
        <span>Service fee</span>
        <span>2%{fees.fee ? ` · ${formatUsd(fees.fee)}` : ''}</span>
      </div>
      <div className="buy-meta-row">
        <span>Estimated time</span>
        <span>{meta.eta}</span>
      </div>
    </div>
  );
}
