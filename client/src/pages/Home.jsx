import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CheckoutWidget from '../components/CheckoutWidget';

const STEPS = [
  {
    n: '01',
    title: 'Pay',
    body: 'Enter USD, pick SOL, ETH, or BTC, and pay with a card on Stripe Checkout.',
  },
  {
    n: '02',
    title: 'Quote',
    body: 'A 2% fee comes out of the amount you type. The remaining 98% is sized at the live rate.',
  },
  {
    n: '03',
    title: 'Deliver',
    body: 'After the card confirms we broadcast to the wallet address you entered.',
  },
];

const TOPICS = [
  {
    n: '01',
    mark: '◎',
    to: '/buy/sol',
    title: 'Buy Solana',
    body: 'The featured product. Pay in USD with a card. SOL lands in the wallet you name.',
    tags: 'SOL · Stripe · 2% fee',
    wide: true,
    dark: true,
  },
  {
    n: '02',
    mark: '◇',
    to: '/buy/eth',
    title: 'Buy Ethereum',
    body: 'Same checkout, different asset. Card payment, live quote, delivery to your address.',
    tags: 'ETH · Stripe · wallet',
  },
  {
    n: '03',
    mark: '⬡',
    to: '/buy/btc',
    title: 'Buy Bitcoin',
    body: 'Buy BTC with a credit or debit card. We send to a bc1, 1, or 3 address you control.',
    tags: 'BTC · Stripe · on-chain',
  },
  {
    n: '04',
    mark: '%',
    to: '/fees',
    title: 'Fees',
    body: 'A 2% service fee is taken from the USD you enter. The rest converts at the live rate.',
    tags: '2% · live quote',
  },
  {
    n: '05',
    mark: '?',
    to: '/faq',
    title: 'FAQ',
    body: 'Delivery time, wallets, quotes, and what happens if an address is wrong.',
    tags: 'Answers · before you pay',
  },
];

export default function Home() {
  const [asset, setAsset] = useState('SOL');

  useEffect(() => {
    document.title = 'No KYC Card to Crypto';
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-grid-bg" aria-hidden="true" />
        <p className="hero-float hero-float-tl mono" aria-hidden="true">$ cardtocrypto buy --sol</p>
        <p className="hero-float hero-float-tr mono" aria-hidden="true">const paid = true</p>
        <p className="hero-float hero-float-bl mono" aria-hidden="true">quote.charge.deliver()</p>
        <p className="hero-float hero-float-br mono" aria-hidden="true">await wallet.receive()</p>
        <p className="hero-float hero-float-c mono" aria-hidden="true">CARD · QUOTE · WALLET</p>

        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">The only true · no KYC · tackers.xyz</p>
            <h1>
              Buy crypto
              <br />
              with a card
            </h1>
            <p className="lede">
              Card to Crypto turns a card payment into SOL, ETH, or BTC in the
              wallet you name. You send USD. You get the asset. Solana is the
              featured product.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href="#checkout">
                Buy Solana
              </a>
              <Link className="btn btn-ghost" to="/fees">
                See fees
              </Link>
            </div>
          </div>

          <aside className="hero-widget" id="checkout">
            <CheckoutWidget asset={asset} onAssetChange={setAsset} />
          </aside>
        </div>
      </section>

      <section className="section band-white" id="who">
        <div className="wrap center-head">
          <p className="kicker">// THE ON-RAMP</p>
          <h2>A card checkout that delivers crypto</h2>
          <p className="lede">
            You pay in USD. We quote at the live rate, take a 2% service fee,
            and send the asset to your wallet after Stripe confirms.
          </p>
        </div>
        <div className="wrap num-grid">
          {STEPS.map((step) => (
            <article key={step.n} className="num-card">
              <span className="num">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section band-soft" id="what">
        <div className="wrap section-split">
          <div>
            <p className="kicker">// PRODUCTS</p>
            <h2>What you can open</h2>
            <p className="lede">
              Each topic is its own page — not a jump link on this one.
            </p>
          </div>
          <Link className="text-link" to="/buy/sol">
            Buy Solana →
          </Link>
        </div>
        <div className="wrap topic-bento">
          {TOPICS.map((topic) => (
            <Link
              key={topic.n}
              to={topic.to}
              className={`topic-card${topic.wide ? ' is-wide' : ''}${topic.dark ? ' is-dark' : ''}`}
            >
              <div className="topic-top">
                <span className="topic-mark" aria-hidden="true">{topic.mark}</span>
                <span className="num">{topic.n}</span>
              </div>
              <h3>{topic.title}</h3>
              <p>{topic.body}</p>
              <span className="topic-tags">{topic.tags}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta-band">
            <p className="kicker">// READY</p>
            <h2>Want SOL now?</h2>
            <p className="lede">
              Open the Solana checkout. Enter a wallet you control. Pay with a card.
            </p>
            <div className="actions center">
              <a className="btn btn-primary" href="#checkout">
                Buy Solana
              </a>
              <Link className="btn btn-ghost" to="/faq">
                Read the FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
