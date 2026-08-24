import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AmountField from './AmountField';
import AssetPicker from './AssetPicker';
import FeeTicket from './FeeTicket';
import SwapWalletBar from './SwapWalletBar';
import WalletField from './WalletField';
import { confirmSwapTx, createPayment, createSwap, fetchQuote, fetchSwapQuote } from '../lib/api';
import { sendDeposit } from '../lib/sendDeposit';
import { useSwapSender } from '../lib/wallets';
import { feeMath, formatUsd, getAsset, MAX_USD, MIN_USD, validateAddress } from '../lib/assets';

function ChipRow({ value, onChange, disabled, prefix = '$' }) {
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
          {prefix}{amt}
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

function defaultTo(from) {
  if (from === 'SOL') return 'ETH';
  if (from === 'ETH') return 'SOL';
  return 'SOL';
}

function defaultFromAmount(asset) {
  if (asset === 'ETH') return '0.05';
  if (asset === 'BTC') return '0.002';
  return '1';
}

function cryptoFromUsd(usd, price) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return '';
  const n = Number(usd) / p;
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1) return n.toFixed(4).replace(/\.?0+$/, '');
  if (n >= 0.01) return n.toFixed(6).replace(/\.?0+$/, '');
  return n.toFixed(8).replace(/\.?0+$/, '');
}

function ModeTabs({ tab, onChange }) {
  return (
    <div className="mode-tabs" role="tablist" aria-label="Buy or Swap">
      <button
        type="button"
        role="tab"
        id="tab-buy"
        aria-selected={tab === 'buy'}
        aria-controls="panel-buy"
        className={`mode-tab${tab === 'buy' ? ' is-on' : ''}`}
        onClick={() => onChange('buy')}
      >
        Buy
        <span className="no-kyc-pill">No KYC</span>
      </button>
      <button
        type="button"
        role="tab"
        id="tab-swap"
        aria-selected={tab === 'swap'}
        aria-controls="panel-swap"
        className={`mode-tab${tab === 'swap' ? ' is-on' : ''}`}
        onClick={() => onChange('swap')}
      >
        Swap
      </button>
    </div>
  );
}

function BuyPanel({ asset, onAssetChange }) {
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
  const belowMin = Number.isFinite(usdNum) && usdNum < MIN_USD;
  const aboveMax = Number.isFinite(usdNum) && usdNum > MAX_USD;
  const amountOk = Number.isFinite(usdNum) && usdNum >= MIN_USD && usdNum <= MAX_USD;
  const amountMessage = belowMin
    ? 'Minimum purchase is $10'
    : aboveMax
      ? 'Maximum purchase is $5000'
      : '';
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
    if (belowMin) {
      setError('Minimum purchase is $10');
      return;
    }
    if (aboveMax) {
      setError('Maximum purchase is $5000');
      return;
    }
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
    <form className="buy-form" id="panel-buy" role="tabpanel" aria-labelledby="tab-buy" onSubmit={handlePay}>
      <div className="step-head">
        <p>1/3 Select pair</p>
        <span className="step-help" title="Choose how much you pay and which asset you get.">?</span>
      </div>
      <div className="step-bar" aria-hidden="true">
        <i className="on" />
        <i />
        <i />
      </div>

      {(error || amountMessage) && (
        <div className="banner error" role="alert">
          {error || amountMessage}
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

      <p className="no-kyc-line mono">No KYC</p>

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

function SwapPanel({ asset, onAssetChange }) {
  const navigate = useNavigate();
  const [fromAsset, setFromAsset] = useState(asset || 'SOL');
  const [toAsset, setToAsset] = useState(defaultTo(asset || 'SOL'));
  const [fromAmount, setFromAmount] = useState(defaultFromAmount(asset || 'SOL'));
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState('idle');
  const sender = useSwapSender(fromAsset);

  useEffect(() => {
    if (asset && asset !== fromAsset) {
      setFromAsset(asset);
      setToAsset((prev) => (prev === asset ? defaultTo(asset) : prev));
      setFromAmount(defaultFromAmount(asset));
    }
  }, [asset]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromMeta = getAsset(fromAsset);
  const toMeta = getAsset(toAsset);
  const addr = validateAddress(toAsset, wallet);
  const fromNum = Number(fromAmount);
  const amountPositive = Number.isFinite(fromNum) && fromNum > 0;
  const usdNotional = quote && Number.isFinite(Number(quote.usdNotional)) ? Number(quote.usdNotional) : null;
  const belowMin = usdNotional != null && usdNotional < MIN_USD;
  const aboveMax = usdNotional != null && usdNotional > MAX_USD;
  const amountOk = amountPositive && usdNotional != null && usdNotional >= MIN_USD && usdNotional <= MAX_USD;
  const pairOk = fromAsset !== toAsset;
  const amountMessage = !pairOk
    ? 'Choose a different asset to receive.'
    : belowMin
      ? 'Minimum swap is $10 equivalent'
      : aboveMax
        ? 'Maximum swap is $5000 equivalent'
        : '';
  const formReady = addr.ok && amountOk && pairOk && quoteState === 'ready' && !loading;
  const needsConnect = sender.needsWallet && !sender.isConnected;
  const canSubmit = needsConnect ? !loading && !sender.connecting : formReady;

  useEffect(() => {
    if (!pairOk || !amountPositive) {
      setQuote(null);
      setQuoteState('idle');
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoteState('loading');
      try {
        const data = await fetchSwapQuote({
          fromAsset,
          toAsset,
          fromAmount: fromNum,
          signal: controller.signal,
        });
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
  }, [fromAsset, toAsset, fromNum, amountPositive, pairOk]);

  function handleFrom(next) {
    if (next === toAsset) setToAsset(defaultTo(next));
    setFromAsset(next);
    setFromAmount(defaultFromAmount(next));
    if (onAssetChange) onAssetChange(next);
  }

  function handleTo(next) {
    if (next === fromAsset) return;
    setToAsset(next);
  }

  function applyUsdChip(usd) {
    const price = quote && quote.fromPriceUsd;
    const next = cryptoFromUsd(usd, price);
    if (next) setFromAmount(next);
  }

  async function handleSwap(e) {
    e.preventDefault();
    setError('');
    if (needsConnect) {
      try {
        await sender.connectWallet();
      } catch (err) {
        setError(err.message || 'Wallet connect failed');
      }
      return;
    }
    if (!pairOk) {
      setError('Choose a different asset to receive.');
      return;
    }
    if (belowMin) {
      setError('Minimum swap is $10 equivalent');
      return;
    }
    if (aboveMax) {
      setError('Maximum swap is $5000 equivalent');
      return;
    }
    if (!formReady) return;
    setLoading(true);
    let orderId = null;
    try {
      const data = await createSwap({
        fromAsset,
        toAsset,
        fromAmount: fromNum,
        walletAddress: wallet.trim(),
      });
      orderId = data && data.orderId ? data.orderId : null;
      if (!orderId) throw new Error('Swap order was created without an id.');
      const depositAddress = data.depositAddress;
      if (!depositAddress) {
        throw new Error('Deposit address not configured. Swap was created but cannot take funds yet.');
      }
      if (fromAsset !== 'BTC') {
        const txHash = await sendDeposit({
          fromAsset,
          depositAddress,
          fromAmount: fromNum,
          publicKey: sender.solPublicKey,
          sendTransaction: sender.sendTransaction,
        });
        if (!txHash) throw new Error('Wallet did not return a transaction hash.');
        await confirmSwapTx({ orderId, txHash });
      }
      navigate(`/success?order_id=${encodeURIComponent(orderId)}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      if (orderId) {
        setError((err.message || 'Wallet send failed') + ' — order ' + orderId + ' is pending. Open status to see the deposit address.');
      }
    }
  }

  const recvAmount =
    quoteState === 'ready' && quote
      ? formatGet(quote.toAmount)
      : quoteState === 'loading'
        ? 'Quoting…'
        : quoteState === 'unavailable'
          ? '—'
          : '—';

  const fees = useMemo(() => {
    if (quote && Number.isFinite(Number(quote.usdNotional))) {
      return feeMath(quote.usdNotional);
    }
    return feeMath(0);
  }, [quote]);

  const usdLabel = quoteState === 'ready' && quote
    ? `≈ ${formatUsd(quote.usdNotional)} · $10–$5000`
    : quoteState === 'loading'
      ? 'Converting to USD…'
      : amountPositive
        ? 'Live USD equivalent needed for limits'
        : 'Enter an amount';

  const cta = needsConnect
    ? (sender.connecting ? 'Connecting…' : 'Connect wallet')
    : loading
      ? (fromAsset === 'BTC' ? 'Creating swap…' : 'Confirm in wallet…')
      : `Swap ${fromMeta.symbol} → ${toMeta.symbol}`;

  return (
    <form className="buy-form" id="panel-swap" role="tabpanel" aria-labelledby="tab-swap" onSubmit={handleSwap}>
      <div className="step-head">
        <p>1/3 Swap pair</p>
        <span className="step-help" title="Connect a wallet, send one asset, receive another. Same 2% fee on the USD value.">?</span>
      </div>
      <div className="step-bar" aria-hidden="true">
        <i className="on" />
        <i />
        <i />
      </div>

      {(error || amountMessage || sender.error) && (
        <div className="banner error" role="alert">
          {error || amountMessage || sender.error}
        </div>
      )}

      <SwapWalletBar
        fromAsset={fromAsset}
        needsWallet={sender.needsWallet}
        isConnected={sender.isConnected}
        displayAddress={sender.displayAddress}
        connecting={sender.connecting}
        onConnect={() => sender.connectWallet().catch((err) => setError(err.message))}
        onDisconnect={() => sender.disconnectWallet()}
      />

      <div className="xfer">
        <div className="xfer-pane">
          <span className="xfer-label">You send</span>
          <div className="xfer-row">
            <AssetPicker value={fromAsset} onChange={handleFrom} disabled={loading} exclude={toAsset} />
            <AmountField
              id="from-amt"
              ariaLabel={`Amount in ${fromMeta.symbol}`}
              value={fromAmount}
              onChange={setFromAmount}
              disabled={loading}
              min="0"
              step="any"
            />
          </div>
          <p className="xfer-sub">{usdLabel}</p>
          <ChipRow
            value={usdNotional != null ? String(Math.round(usdNotional)) : ''}
            onChange={applyUsdChip}
            disabled={loading || !quote || !quote.fromPriceUsd}
          />
        </div>

        <div className="xfer-pane">
          <span className="xfer-label">You get</span>
          <div className="xfer-row">
            <AssetPicker value={toAsset} onChange={handleTo} disabled={loading} exclude={fromAsset} />
            <span className={`recv-amt${quoteState === 'ready' ? '' : ' is-wait'}`}>
              {recvAmount}
            </span>
          </div>
        </div>
      </div>

      <WalletField
        asset={toAsset}
        value={wallet}
        onChange={setWallet}
        disabled={loading}
        inputId="swap-wallet"
        label={`Destination ${toMeta.symbol} wallet`}
      />

      <button type="submit" className="btn btn-pay" disabled={!canSubmit}>
        {loading || sender.connecting ? (
          <>
            <span className="spinner" />
            {cta}
          </>
        ) : (
          cta
        )}
      </button>

      <FeeTicket
        asset={toAsset}
        fromAsset={fromAsset}
        fees={fees}
        quote={quote}
        quoteState={quoteState}
        mode="swap"
      />

      <p className="widget-foot mono">
        $ swap --from {fromMeta.symbol.toLowerCase()} --to {toMeta.symbol.toLowerCase()}
        {quoteState === 'ready' && quote?.usdNotional != null
          ? `  ·  ${formatUsd(quote.usdNotional)}`
          : quoteState === 'loading'
            ? '  ·  live…'
            : ''}
      </p>
    </form>
  );
}

export default function CheckoutWidget({ asset, onAssetChange }) {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'swap' ? 'swap' : 'buy';
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="buy-card">
      <ModeTabs tab={tab} onChange={setTab} />
      {tab === 'buy' ? (
        <BuyPanel asset={asset} onAssetChange={onAssetChange} />
      ) : (
        <SwapPanel asset={asset} onAssetChange={onAssetChange} />
      )}
    </div>
  );
}
