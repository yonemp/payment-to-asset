import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AmountField from '../components/AmountField';
import AssetPicker from '../components/AssetPicker';
import FeeTicket from '../components/FeeTicket';
import WalletField from '../components/WalletField';
import { createPayment, fetchHealth, fetchQuote } from '../lib/api';
import { ASSETS, feeMath, getAsset, MAX_USD, MIN_USD, validateAddress } from '../lib/assets';

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

  return (
    <>
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <img src="/hero.png" alt="" />
        </div>
        <div className="wrap hero-copy">
          <p className="eyebrow">
            <span className="gold-dot" />
            Card to mainnet
          </p>
          <h1>
            Pay in dollars.
            <em> Receive the asset.</em>
          </h1>
          <p className="lede">
            Stripe Checkout for ETH, SOL, or BTC. Destination is yours. Settlement is on
            mainnet — not a voucher, not a testnet, not a simulated balance.
          </p>
          <div className="hero-actions">
            <a href="#checkout" className="btn">
              Build an order
            </a>
            <a href="#how" className="btn btn-ghost">
              See the path
            </a>
          </div>
          <dl className="hero-facts">
            <div>
              <dt>Networks</dt>
              <dd>ETH · SOL · BTC</dd>
            </div>
            <div>
              <dt>Fee</dt>
              <dd>2% service</dd>
            </div>
            <div>
              <dt>Checkout</dt>
              <dd>{health?.stripe ? 'Stripe live' : 'Stripe Checkout'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="checkout" className="section checkout">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Order ticket</p>
            <h2>Choose the asset. Name the destination.</h2>
            <p>The ticket is the whole order — asset, amount, address, and the 2% fee in plain numbers.</p>
          </div>

          <form className="checkout-grid" onSubmit={handlePay}>
            <div className="checkout-visual">
              <AssetPicker value={asset} onChange={setAsset} disabled={loading} />
              <div className="network-aside">
                <img src={meta.mark} alt="" width="48" height="48" />
                <div>
                  <strong>{meta.name}</strong>
                  <p>
                    {meta.network} · {meta.chain}. Explorer {meta.explorerName}.
                  </p>
                </div>
              </div>
            </div>

            <div className="ticket">
              <div className="ticket-top">
                <span className="ticket-kicker">Live checkout</span>
                <span className="pill">{meta.symbol} · mainnet</span>
              </div>

              {error && (
                <div className="banner error" role="alert">
                  {error}
                </div>
              )}

              <AmountField value={usd} onChange={setUsd} disabled={loading} />
              <WalletField asset={asset} value={wallet} onChange={setWallet} disabled={loading} />
              <FeeTicket asset={asset} fees={fees} quote={quote} quoteState={quoteState} />

              <button type="submit" className="btn btn-pay" disabled={!canPay}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    Opening Stripe…
                  </>
                ) : (
                  <>Continue to Stripe{amountOk ? ` · $${usdNum.toFixed(2)}` : ''}</>
                )}
              </button>
              <p className="fineprint">
                You will pay on Stripe. We broadcast {meta.symbol} to the address above after
                the payment confirms.
              </p>
            </div>
          </form>
        </div>
      </section>

      <section id="how" className="section how">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Path</p>
            <h2>Four steps. No theater.</h2>
          </div>
          <ol className="how-grid">
            <li>
              <span className="how-num">01</span>
              <h3>Ticket</h3>
              <p>Pick ETH, SOL, or BTC. Enter a mainnet address and a USD amount.</p>
            </li>
            <li>
              <span className="how-num">02</span>
              <h3>Pay</h3>
              <p>Stripe Checkout takes the card. The order is stored as pending until the webhook fires.</p>
            </li>
            <li>
              <span className="how-num">03</span>
              <h3>Convert</h3>
              <p>Net of the 2% fee, USD is sized at the live rate used by the payout desk.</p>
            </li>
            <li>
              <span className="how-num">04</span>
              <h3>Broadcast</h3>
              <p>A real mainnet transfer. The success page links the explorer when the hash exists.</p>
            </li>
          </ol>
        </div>
      </section>

      <section id="networks" className="section networks">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Rails</p>
            <h2>Three mainnets. Nothing else.</h2>
          </div>
          <div className="net-grid">
            {ASSETS.map((a) => (
              <article key={a.value} className={`net-card tint-${a.tint}`}>
                <img src={a.mark} alt="" width="64" height="64" />
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
            <h2>Before you pay.</h2>
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
