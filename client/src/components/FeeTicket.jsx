import { formatUsd, getAsset, SERVICE_FEE } from '../lib/assets';

export default function FeeTicket({ asset, fees, quote, quoteState, mode = 'buy', fromAsset }) {
  const meta = getAsset(asset);
  let rate;
  if (mode === 'swap') {
    rate =
      quoteState === 'ready' && quote?.fromPriceUsd && quote?.toPriceUsd
        ? `1 ${fromAsset || quote.fromAsset} ≈ ${formatUsd(quote.fromPriceUsd)}`
        : quoteState === 'loading'
          ? 'Fetching live rates…'
          : 'Rate locked when the swap is created';
  } else {
    rate =
      quoteState === 'ready' && quote?.priceUsd
        ? `1 ${asset} ≈ ${formatUsd(quote.priceUsd)}`
        : quoteState === 'loading'
          ? 'Fetching live rate…'
          : 'Rate locked at checkout';
  }

  return (
    <div className="buy-meta" aria-live="polite">
      <div className="buy-meta-row">
        <span>Rate</span>
        <span>{rate}</span>
      </div>
      {mode === 'swap' && quoteState === 'ready' && quote?.toPriceUsd && (
        <div className="buy-meta-row">
          <span>You get rate</span>
          <span>1 {asset} ≈ {formatUsd(quote.toPriceUsd)}</span>
        </div>
      )}
      <div className="buy-meta-row">
        <span>Service fee</span>
        <span>{Math.round(SERVICE_FEE * 100)}%{fees.fee ? ` · ${formatUsd(fees.fee)}` : ''}</span>
      </div>
      <div className="buy-meta-row">
        <span>Estimated time</span>
        <span>{meta.eta}</span>
      </div>
    </div>
  );
}
