import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import CheckoutWidget from '../components/CheckoutWidget';
import PageHero from '../components/PageHero';
import { getAsset } from '../lib/assets';

const SLUGS = { sol: 'SOL', eth: 'ETH', btc: 'BTC' };

export default function Buy() {
  const { asset: slug } = useParams();
  const code = slug ? SLUGS[(slug || '').toLowerCase()] : 'SOL';

  useEffect(() => {
    document.title = 'Card to Crypto';
  }, []);

  if (slug && !SLUGS[(slug || '').toLowerCase()]) {
    return <Navigate to="/buy/sol" replace />;
  }

  const meta = getAsset(code || 'SOL');

  return (
    <>
      <PageHero
        kicker="// BUY"
        chips={['CARD', 'CREDITS', '14% FEE', 'TRUST']}
        title="Buy credits with a card"
        lede={`Pay in USD with a card. A 14% service fee is taken from the amount you type; the remaining 86% becomes credits ($1 net = 1 credit). Redeem later for ${meta.symbol} and other assets at https://www.insider.quest/. No wallet at checkout.`}
        aside={
          <div id="checkout">
            <CheckoutWidget />
          </div>
        }
      >
        <div className="actions">
          <a className="btn btn-primary" href="#checkout">
            Continue below
          </a>
          <Link className="btn btn-ghost" to="/fees">
            See fees
          </Link>
        </div>
        <p className="hero-fine mono">
          Card checkout · credits · Redeem credits at insider.quest
        </p>
      </PageHero>

      <section className="section band-soft">
        <div className="wrap">
          <p className="kicker">// AT A GLANCE</p>
          <div className="glance-grid">
            <article className="glance-card">
              <span className="mini-chip">PRODUCT</span>
              <strong>Credits</strong>
              <p>$1 net = 1 credit</p>
            </article>
            <article className="glance-card">
              <span className="mini-chip">FEE</span>
              <strong>14%</strong>
              <p>Taken from the USD you enter</p>
            </article>
            <article className="glance-card">
              <span className="mini-chip">PAY</span>
              <strong>Card</strong>
              <p>Credit or debit card</p>
            </article>
            <article className="glance-card">
              <span className="mini-chip">REDEEM</span>
              <strong>Later</strong>
              <p><a href="https://www.insider.quest/">Redeem credits</a></p>
            </article>
          </div>
        </div>
      </section>

      <section className="section band-white">
        <div className="wrap">
          <p className="kicker">// HOW IT WORKS</p>
          <h2>Three steps on this ticket</h2>
          <ol className="num-grid">
            <li className="num-card">
              <span className="num">01</span>
              <h3>Set USD</h3>
              <p>Enter how much you want to spend. Suggested amounts sit under the field.</p>
            </li>
            <li className="num-card">
              <span className="num">02</span>
              <h3>Pay with a card</h3>
              <p>Card checkout takes the card. No wallet address is required here.</p>
            </li>
            <li className="num-card">
              <span className="num">03</span>
              <h3>Copy your code</h3>
              <p>After payment, credits are issued to a credit code and order ID you can look up. Redeem for {meta.symbol} later at <a href="https://www.insider.quest/">insider.quest</a>.</p>
            </li>
          </ol>
          <p className="aside-note" style={{ marginTop: 28 }}>
            This site sells credits. It does not send crypto. Redemption is a
            separate service at{' '}
            <a href="https://www.insider.quest/">www.insider.quest</a>.
          </p>
        </div>
      </section>
    </>
  );
}
