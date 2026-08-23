import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AmountField from './AmountField';
import AssetGlyph from './AssetGlyph';
import AssetPicker from './AssetPicker';
import FeeTicket from './FeeTicket';
import WalletField from './WalletField';
import { createPayment, fetchQuote } from '../lib/api';
import { feeMath, formatUsd, getAsset, MAX_USD, MIN_USD, validateAddress } from '../lib/assets';

function ChipRow({ value, onChange, disabled }) {
  const n = Number(value);
  const chips = [25, 50, 100, 250];
  return (
    <div className="chip-row" role="group" aria-label="Suggested amounts">
      {chips.map((amt) => (
        <button
          key={amt}
          type="button"
          className={`chip${n === amt ? ' selected' : ''}`}
          onClick={() => onChange(String(amt))}
          disabled={disabled}
        >
          ${amt}
        </button>
      ))}
    </div>
  );
}

function formatGet(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  if (n >= 100) return `~ ${n.toFixed(2)}`;
  if (n >= 1) return `~ ${n.toFixed(4)}`;
  return `~ ${n.toFixed(6)}`;
}

export default function CheckoutWidget({ asset, onAssetChange }) {
  const [searchParams] = useSearchParams();
  const [wallet, setWallet] = useState('');
  const [usd, setUsd] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState('idle');

  const meta = getAsset(asset);
  const fees = useMemo(() => feeMath(usd), [usd]);
  const addr = validateAddress(asset, wallet);
  const usdNum = Number(usd);
  const amountOk = Number.isFinite(usdNum) && usdNum >= MIN_USD && usdNum <= MAX_USD;
  const canPay = addr.ok && amountOk && !loading;

  useEffect(() => {
    if (searchParams.get('canceled') === '1') {
      setError('Payment canceled. You can adjust the ticket and try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!amountOk) {
      setQuote(null);
      setQuoteState('idle');
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoteState('loading');
      try {
        const data = await fetchQuote(asset, usdNum, controller.signal);
        setQuote(data);
        setQuoteState('ready');
      } catch (err) {
        if (err.name === 'AbortError') return;
        setQuote(null);
        setQuoteState('unavailable');
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [asset, usdNum, amountOk]);

  async function handlePay(e) {
    e.preventDefault();
    setError('');
    if (!canPay) return;
    setLoading(true);
    try {
      const data = await createPayment({
        asset,
        walletAddress: wallet.trim(),
        usdAmount: usdNum,
      });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const recvAmount =
    quoteState === 'ready' && quote
      ? formatGet(quote.cryptoAmount)
      : quoteState === 'loading'
        ? 'Quoting…'
        : '—';

  const offerAmt =
    quoteState === 'ready' && quote ? formatGet(quote.cryptoAmount) : '—';

  function handleAsset(next) {
    if (onAssetChange) onAssetChange(next);
  }

  return (
    <form className="buy-card" onSubmit={handlePay}>
      <div className="step-head">
        <p>1/3 Select pair</p>
        <span className="step-help" title="Choose how much you pay and which asset you get.">?</span>
      </div>
      <div className="step-bar" aria-hidden="true">
        <i className="on" />
        <i />
        <i />
      </div>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      <div className="xfer">
        <div className="xfer-pane">
          <span className="xfer-label">You send</span>
          <div className="xfer-row">
            <div className="pair-left">
              <span className="pair-code">
                <svg className="flag" viewBox="0 0 24 24" aria-hidden="true">
                  <rect width="24" height="24" rx="12" fill="#3c3b6e" />
                  <rect y="9" width="24" height="3" fill="#fff" />
                  <rect y="15" width="24" height="3" fill="#b22234" />
                  <rect y="6" width="24" height="3" fill="#b22234" />
                  <rect width="11" height="10" fill="#3c3b6e" />
                </svg>
                USD
                <span className="chev">▾</span>
              </span>
              <span className="pair-name">US Dollar</span>
            </div>
            <AmountField value={usd} onChange={setUsd} disabled={loading} />
          </div>
          <ChipRow value={usd} onChange={setUsd} disabled={loading} />
        </div>

        <div className="xfer-pane">
          <span className="xfer-label">You get</span>
          <div className="xfer-row">
            <AssetPicker value={asset} onChange={handleAsset} disabled={loading} />
            <span className={`recv-amt${quoteState === 'ready' ? '' : ' is-wait'}`}>
              {recvAmount}
            </span>
          </div>
        </div>
      </div>

      <div className="pay-with">
        <div className="pay-with-head">
          <span>Pay with</span>
          <span>Card · Stripe</span>
        </div>
        <div className="offer-row">
          <span className="offer-logo" aria-hidden="true">S</span>
          <div className="offer-copy">
            <strong>Stripe</strong>
            <span>Credit / debit card</span>
          </div>
          <span className="offer-amt">{offerAmt}</span>
        </div>
      </div>

      <WalletField asset={asset} value={wallet} onChange={setWallet} disabled={loading} />

      <button type="submit" className="btn btn-pay" disabled={!canPay}>
        {loading ? (
          <>
            <span className="spinner" />
            Opening Stripe…
          </>
        ) : (
          `Buy ${meta.symbol}`
        )}
      </button>

      <FeeTicket asset={asset} fees={fees} quote={quote} quoteState={quoteState} />

      <p className="widget-foot mono">
        $ quote --asset {meta.symbol.toLowerCase()}
        {quoteState === 'ready' && quote?.priceUsd
          ? `  ·  ${formatUsd(quote.priceUsd)}`
          : quoteState === 'loading'
            ? '  ·  live…'
            : ''}
      </p>
    </form>
  );
}
