import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import CheckoutWidget from '../components/CheckoutWidget';

const STEPS = [
  {
    n: '01',
    title: 'Pay',
    body: 'Enter USD and pay with a card checkout. No wallet on this site.',
  },
  {
    n: '02',
    title: 'Credits',
    body: 'A 14% fee comes out of the amount you type. The remaining 86% becomes your credit balance, $1 net = 1 credit.',
  },
  {
    n: '03',
    title: 'Redeem credits',
    body: 'Copy your credit code. Redeem for crypto at https://www.insider.quest/ (also https://insider.quest).',
  },
];

const TOPICS = [
  {
    n: '01',
    mark: '◎',
    to: '/buy/sol',
    title: 'Buy credits',
    body: 'Pay in USD with a card. Credits are issued after payment. Redeem for crypto later.',
    tags: 'Credits · card · 14% fee',
    wide: true,
    dark: true,
  },
  {
    n: '02',
    mark: '%',
    to: '/fees',
    title: 'Fees',
    body: 'A 14% service fee is taken from the USD you enter. The rest is your credit balance.',
    tags: '14% · $1 net = 1 credit',
  },
  {
    n: '03',
    mark: '?',
    to: '/faq',
    title: 'FAQ',
    body: 'How credits work, lookup, and what redeem later means.',
    tags: 'Answers · before you pay',
  },
  {
    n: '04',
    mark: '◇',
    to: '/lookup',
    title: 'Lookup',
    body: 'Find an order by ID or credit code. Balance and redeem status are on that page.',
    tags: 'Order ID · credit code',
  },
];

export default function Home() {
  useEffect(() => {
    document.title = 'Card to Crypto';
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-grid-bg" aria-hidden="true" />
        <p className="hero-float hero-float-tl mono" aria-hidden="true">$ cardtocrypto buy --credits</p>
        <p className="hero-float hero-float-tr mono" aria-hidden="true">const paid = true</p>
        <p className="hero-float hero-float-bl mono" aria-hidden="true">charge.credit()</p>
        <p className="hero-float hero-float-br mono" aria-hidden="true">code.copy()</p>
        <p className="hero-float hero-float-c mono" aria-hidden="true">CARD · CREDITS · REDEEM</p>

        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Buy credits with a card</p>
            <h1>
              Buy credits
              <br />
              with a card
            </h1>
            <p className="lede">
              Card to Crypto sells credits. Pay USD with a card. After the
              14% fee, the rest is credited to a code you can copy. Redeem
              for crypto at{' '}
              <a href="https://www.insider.quest/">www.insider.quest</a>.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href="#checkout">
                Buy credits
              </a>
              <Link className="btn btn-ghost" to="/fees">
                See fees
              </Link>
              <a className="btn btn-ghost" href="https://www.insider.quest/">
                Redeem credits
              </a>
            </div>
          </div>

          <aside className="hero-widget" id="checkout">
            <CheckoutWidget />
          </aside>
        </div>
      </section>

      <section className="section band-white" id="who">
        <div className="wrap center-head">
          <p className="kicker">// CREDITS</p>
          <h2>A card checkout that issues credits</h2>
          <p className="lede">
            You pay in USD. We take a 14% service fee. The remaining 86%
            becomes your credit balance. This site does not send crypto.
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
            <p className="kicker">// PAGES</p>
            <h2>What you can open</h2>
            <p className="lede">
              Each topic is its own page — not a jump link on this one.
            </p>
          </div>
          <Link className="text-link" to="/buy/sol">
            Buy credits →
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
            <h2>Want credits now?</h2>
            <p className="lede">
              Open checkout. Enter USD. Pay with a card. Copy your credit code when you are done.
            </p>
            <div className="actions center">
              <a className="btn btn-primary" href="#checkout">
                Buy credits
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
