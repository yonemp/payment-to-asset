import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AmountField from '../components/AmountField';
import AssetGlyph from '../components/AssetGlyph';
import AssetPicker from '../components/AssetPicker';
import FeeTicket from '../components/FeeTicket';
import WalletField from '../components/WalletField';
import { createPayment, fetchQuote } from '../lib/api';
import { ASSETS, feeMath, formatUsd, getAsset, MAX_USD, MIN_USD, validateAddress } from '../lib/assets';

const FAQ = [
  {
    q: 'How fast is delivery?',
    a: 'You pay on Stripe first. After the card confirms we broadcast the asset on the selected mainnet. Ethereum and Solana are typically minutes; Bitcoin depends on mempool conditions.',
  },
  {
    q: 'What is the fee?',
    a: 'A 2% service fee is taken from the USD you enter. The remaining 98% is converted at the live rate when the order is created.',
  },
  {
    q: 'Which networks are supported?',
    a: 'Ethereum mainnet, Solana mainnet, and Bitcoin mainnet. There is no testnet path.',
  },
  {
    q: 'What if I enter the wrong address?',
    a: 'The form checks format and length before checkout. After a transfer is broadcast it cannot be reversed. Double-check the destination.',
  },
  {
    q: 'Where does the quote come from?',
    a: 'The estimated amount is a live server quote from the same rate source used at payout. If a quote is unavailable we do not invent a coin amount.',
  },
];

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

export default function Home() {
  const [searchParams] = useSearchParams();
  const [asset, setAsset] = useState('ETH');
  const [wallet, setWallet] = useState('');
  const [usd, setUsd] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState(0);
  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState('idle');

  const meta = getAsset(asset);
  const fees = useMemo(() => feeMath(usd), [usd]);
  const addr = validateAddress(asset, wallet);
  const usdNum = Number(usd);
  const amountOk = Number.isFinite(usdNum) && usdNum >= MIN_USD && usdNum <= MAX_USD;
  const canPay = addr.ok && amountOk && !loading;

  useEffect(() => {
    document.title = `${meta.buyTitle} — Card to Crypto`;
  }, [meta.buyTitle]);

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

  return (
    <>
      <section className="buy-hero" id="checkout">
        <div className="wrap buy-hero-inner">
          <h1 className="buy-title">{meta.headline}</h1>

          <p className="buy-price">
            <AssetGlyph tint={meta.tint} size={22} />
            <span className="px">
              {quoteState === 'ready' && quote?.priceUsd
                ? formatUsd(quote.priceUsd)
                : quoteState === 'loading'
                  ? 'Live price…'
                  : `${meta.symbol} live price`}
            </span>
          </p>

          <p className="buy-lede">
            Buy {meta.name} ({meta.symbol}) with a credit or debit card in three
            steps. Pay in USD, receive on {meta.network}.
          </p>

          <ul className="buy-checks">
            <li><span className="chk" aria-hidden="true">✓</span> Card checkout via Stripe</li>
            <li><span className="chk" aria-hidden="true">✓</span> Mainnet delivery to your wallet</li>
            <li><span className="chk" aria-hidden="true">✓</span> 2% service fee, live quote</li>
          </ul>

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
                  <AssetPicker value={asset} onChange={setAsset} disabled={loading} />
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
          </form>

          <div className="pay-logos" aria-label="Payment">
            <span>Stripe</span>
            <span>Card</span>
          </div>
        </div>
      </section>

      <section id="how" className="section">
        <div className="wrap">
          <div className="section-head center">
            <h2>How to buy {meta.name} ({meta.symbol}) with a credit and debit card</h2>
            <p>Four steps from USD to a mainnet wallet. No extra apps.</p>
          </div>
          <ol className="how-grid">
            <li>
              <span className="how-num">1</span>
              <h3>Set the pair</h3>
              <p>Choose {meta.name}, enter how much USD you want to spend, and review the live quote.</p>
            </li>
            <li>
              <span className="how-num">2</span>
              <h3>Enter your wallet address</h3>
              <p>Provide a {meta.network} address. Make sure the wallet supports {meta.symbol} on mainnet.</p>
            </li>
            <li>
              <span className="how-num">3</span>
              <h3>Pay with your card</h3>
              <p>Continue to Stripe Checkout to pay with a credit or debit card. The order is stored as pending until the payment confirms.</p>
            </li>
            <li>
              <span className="how-num">✓</span>
              <h3>Confirm your payment</h3>
              <p>After Stripe confirms we broadcast {meta.symbol} to your address. The success page links the explorer when the hash exists.</p>
            </li>
          </ol>
        </div>
      </section>

      <section id="networks" className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head center">
            <h2>Networks we deliver on</h2>
            <p>Three mainnets. Destination is yours.</p>
          </div>
          <div className="net-grid">
            {ASSETS.map((a) => (
              <article key={a.value} className="net-card">
                <AssetGlyph tint={a.tint} size={40} />
                <h3>
                  {a.symbol} <span>{a.name}</span>
                </h3>
                <ul>
                  <li>{a.network}</li>
                  <li>Address · {a.addressHint}</li>
                  <li>Explorer · {a.explorerName}</li>
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head center">
            <h2>What can I do after I buy {meta.name}?</h2>
          </div>
          <div className="after-grid">
            <article className="after-card">
              <svg className="ico" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="10" r="5" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="11" cy="20" r="4" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="21" cy="20" r="4" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <h3>Hold</h3>
              <p>Keep {meta.symbol} in the wallet you entered — yours, not a custodial balance on this site.</p>
            </article>
            <article className="after-card">
              <svg className="ico" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M6 16h16M16 8l10 8-10 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3>Send</h3>
              <p>Once it lands on-chain you can send {meta.symbol} to anyone whose wallet supports the same network.</p>
            </article>
            <article className="after-card">
              <svg className="ico" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M8 22h16M8 16h16M12 10h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <h3>Use</h3>
              <p>Spend, swap, or hold — we only deliver the asset. What you do next is up to you.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" className="section" style={{ paddingTop: 0 }}>
        <div className="wrap faq-grid">
          <div className="section-head">
            <h2>Frequently asked questions</h2>
            <p>Before you pay.</p>
          </div>
          <div>
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className={`faq-item${open ? ' open' : ''}`}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? -1 : i)}
                  >
                    {item.q}
                    <span aria-hidden="true">{open ? '−' : '+'}</span>
                  </button>
                  {open && <p>{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
