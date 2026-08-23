import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AmountField from '../components/AmountField';
import AssetGlyph from '../components/AssetGlyph';
import AssetPicker from '../components/AssetPicker';
import FeeTicket from '../components/FeeTicket';
import MetricRack from '../components/MetricRack';
import RadarBg from '../components/RadarBg';
import StatusCard from '../components/StatusCard';
import WalletField from '../components/WalletField';
import { createPayment, fetchHealth, fetchQuote } from '../lib/api';
import { ASSETS, feeMath, formatCrypto, getAsset, MAX_USD, MIN_USD, validateAddress } from '../lib/assets';

const FAQ = [
  {
    q: 'How fast is delivery?',
    a: 'Stripe confirms first. The payout then broadcasts on the selected mainnet. Ethereum and Solana are typically minutes; Bitcoin depends on mempool conditions.',
  },
  {
    q: 'What is the fee?',
    a: 'A 2% service fee is taken from the USD you enter. The remaining 98% is converted at the live rate when the order is created.',
  },
  {
    q: 'Which networks are supported?',
    a: 'Ethereum mainnet (chainId 1), Solana mainnet-beta, and Bitcoin mainnet. There is no testnet path.',
  },
  {
    q: 'What if I enter the wrong address?',
    a: 'The form checks format and length before checkout. After a transfer is broadcast, it cannot be reversed. Double-check the destination.',
  },
  {
    q: 'Do you show live balances or prices?',
    a: 'The ticket can show a server quote from the same rate source used at payout. If a quote is unavailable, you still see fee math — never a fabricated coin amount.',
  },
];

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
  const [health, setHealth] = useState(null);

  const meta = getAsset(asset);
  const fees = useMemo(() => feeMath(usd), [usd]);
  const addr = validateAddress(asset, wallet);
  const usdNum = Number(usd);
  const amountOk = Number.isFinite(usdNum) && usdNum >= MIN_USD && usdNum <= MAX_USD;
  const canPay = addr.ok && amountOk && !loading;

  useEffect(() => {
    if (searchParams.get('canceled') === '1') {
      setError('Payment canceled. The ticket is still here if you want to continue.');
    }
  }, [searchParams]);

  useEffect(() => {
    let ignore = false;
    fetchHealth()
      .then((data) => {
        if (!ignore) setHealth(data);
      })
      .catch(() => {
        if (!ignore) setHealth(null);
      });
    return () => {
      ignore = true;
    };
  }, []);

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
      ? formatCrypto(quote.cryptoAmount, asset)
      : quoteState === 'loading'
        ? 'Quoting…'
        : '—';

  return (
    <>
      <section className="hero" id="checkout">
        <RadarBg />
        <div className="wrap hero-stack">
          <div className="hero-copy">
            <p className="live-badge">
              <span className="live-dot" />
              card → mainnet
            </p>
            <h1 className="hero-word">CONVERT</h1>
            <p className="hero-sub">
              pay in <em className="c-pink">dollars</em>. settle on{' '}
              <em className="c-cyan">mainnet</em>. receive <em className="c-lime">on-chain</em>.
            </p>
            <p className="lede">
              Stripe Checkout for ETH, SOL, or BTC. Destination is yours. Settlement is on
              mainnet — not a voucher, not a testnet, not a simulated balance.
            </p>
            <div className="hero-actions">
              <a href="#ticket" className="btn">
                Open ticket →
              </a>
              <a href="#how" className="btn btn-ghost">
                See the path
              </a>
            </div>
          </div>

          <div className="hero-widgets">
            <StatusCard health={health} />

            <form id="ticket" className="ticket ticket-float" onSubmit={handlePay}>
              <div className="ticket-top">
                <span className="ticket-kicker">You pay → they receive</span>
                <span className="pill">{meta.symbol} · mainnet</span>
              </div>

              {error && (
                <div className="banner error" role="alert">
                  {error}
                </div>
              )}

              <div className="xfer">
                <div className="xfer-pane">
                  <span className="xfer-label">You pay</span>
                  <AmountField value={usd} onChange={setUsd} disabled={loading} />
                </div>
                <div className="xfer-swap" aria-hidden="true">↓</div>
                <div className="xfer-pane">
                  <span className="xfer-label">They receive</span>
                  <div className="recv">
                    <span className="recv-amt">{recvAmount}</span>
                    <span className="recv-meta">
                      {quoteState === 'ready' && quote?.priceUsd
                        ? `live · ${asset}`
                        : 'sized at payout'}
                    </span>
                  </div>
                </div>
              </div>

              <AssetPicker value={asset} onChange={setAsset} disabled={loading} />
              <WalletField asset={asset} value={wallet} onChange={setWallet} disabled={loading} />
              <FeeTicket asset={asset} fees={fees} quote={quote} quoteState={quoteState} />

              <button type="submit" className="btn btn-pay" disabled={!canPay}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    Opening Stripe…
                  </>
                ) : (
                  <>Pay now{amountOk ? ` · $${usdNum.toFixed(2)}` : ''} →</>
                )}
              </button>
              <p className="fineprint">
                You will pay on Stripe. We broadcast {meta.symbol} to the address above after
                the payment confirms.
              </p>
            </form>

            <MetricRack asset={asset} fees={fees} quote={quote} quoteState={quoteState} />
          </div>
        </div>

        <div className="trust-bar">
          <p>Settlement rails</p>
          <div className="trust-logos">
            <span>Stripe</span>
            <span>ETH mainnet</span>
            <span>SOL mainnet</span>
            <span>BTC mainnet</span>
            <span>2% fee</span>
          </div>
        </div>
      </section>

      <section id="how" className="section how">
        <div className="wrap">
          <div className="section-head center">
            <p className="eyebrow">Path</p>
            <h2>four steps. no theater.</h2>
          </div>
          <ol className="how-grid">
            <li>
              <span className="how-num">01</span>
              <h3>ticket</h3>
              <p>Pick ETH, SOL, or BTC. Enter a mainnet address and a USD amount.</p>
            </li>
            <li>
              <span className="how-num">02</span>
              <h3>pay</h3>
              <p>Stripe Checkout takes the card. The order is stored as pending until the webhook fires.</p>
            </li>
            <li>
              <span className="how-num">03</span>
              <h3>convert</h3>
              <p>Net of the 2% fee, USD is sized at the live rate used by the payout desk.</p>
            </li>
            <li>
              <span className="how-num">04</span>
              <h3>broadcast</h3>
              <p>A real mainnet transfer. The success page links the explorer when the hash exists.</p>
            </li>
          </ol>
        </div>
      </section>

      <section id="networks" className="section networks">
        <div className="wrap">
          <div className="section-head center">
            <p className="eyebrow">Rails</p>
            <h2>three mainnets. nothing else.</h2>
          </div>
          <div className="net-grid">
            {ASSETS.map((a) => (
              <article key={a.value} className={`net-card tint-${a.tint}`}>
                <AssetGlyph tint={a.tint} size={40} />
                <h3>
                  {a.symbol} <span>{a.name}</span>
                </h3>
                <ul>
                  <li>{a.network}</li>
                  <li>{a.chain}</li>
                  <li>Address · {a.addressHint}</li>
                  <li>Explorer · {a.explorerName}</li>
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="section faq">
        <div className="wrap faq-grid">
          <div className="section-head">
            <p className="eyebrow">Questions</p>
            <h2>before you pay.</h2>
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
