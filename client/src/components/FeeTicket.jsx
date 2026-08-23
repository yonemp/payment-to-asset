import { formatCrypto, formatUsd } from '../lib/assets';

export default function FeeTicket({ asset, fees, quote, quoteState }) {
  return (
    <div className="ticket-break" aria-live="polite">
      <div className="detail-row">
        <span>You pay</span>
        <span>{formatUsd(fees.gross)}</span>
      </div>
      <div className="detail-row">
        <span>Service fee · 2%</span>
        <span className="muted">−{formatUsd(fees.fee)}</span>
      </div>
      <div className="detail-row">
        <span>Net converted</span>
        <span className="accent">{formatUsd(fees.net)}</span>
      </div>
      <div className="detail-row">
        <span>Estimated {asset}</span>
        <span className="mono">
          {quoteState === 'ready' && quote
            ? formatCrypto(quote.cryptoAmount, asset)
            : quoteState === 'loading'
              ? 'Quoting…'
              : 'Converted at payout'}
        </span>
      </div>
      {quoteState === 'ready' && quote?.priceUsd ? (
        <p className="hint">
          Indicative at {formatUsd(quote.priceUsd)} / {asset}. Locked when you start checkout.
        </p>
      ) : (
        <p className="hint">
          Asset amount is calculated at payout from the live rate. No estimated size is shown
          unless the server returns a quote.
        </p>
      )}
    </div>
  );
}
