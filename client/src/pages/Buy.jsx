import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import CheckoutWidget from '../components/CheckoutWidget';
import PageHero from '../components/PageHero';
import { getAsset } from '../lib/assets';

const SLUGS = { sol: 'SOL', eth: 'ETH', btc: 'BTC' };

export default function Buy() {
  const { asset: slug } = useParams();
  const navigate = useNavigate();
  const code = SLUGS[(slug || '').toLowerCase()];

  useEffect(() => {
    document.title = 'No KYC Card to Crypto';
  }, []);

  if (!code) {
    return <Navigate to="/buy/sol" replace />;
  }

  const meta = getAsset(code);

  return (
    <>
      <PageHero
        kicker="// BUY"
        chips={['CARD', 'NO KYC', '14% FEE', 'TRUST']}
        title={`Buy ${meta.name} with a card`}
        lede={`Pay in USD with a card. Receive ${meta.symbol} at the wallet address you enter. A 14% service fee is taken from the amount you type; the rest converts at the live rate.`}
        aside={
          <div id="checkout">
            <CheckoutWidget
              asset={code}
              onAssetChange={(next) => navigate(`/buy/${next.toLowerCase()}`)}
            />
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
          Card checkout · No KYC · live quote · {meta.eta} typical
        </p>
      </PageHero>

      <section className="section band-soft">
        <div className="wrap">
          <p className="kicker">// AT A GLANCE</p>
          <div className="glance-grid">
            <article className="glance-card">
              <span className="mini-chip">ASSET</span>
              <strong>{meta.name}</strong>
              <p>{meta.symbol} · {meta.network}</p>
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
              <span className="mini-chip">TIME</span>
              <strong>{meta.eta}</strong>
              <p>After the card confirms</p>
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
              <h3>Name the wallet</h3>
              <p>Paste a {meta.name} address you control. Format is checked before checkout.</p>
            </li>
            <li className="num-card">
              <span className="num">03</span>
              <h3>Pay with a card</h3>
              <p>Card checkout takes the card. After it confirms we send {meta.symbol} to that address.</p>
            </li>
          </ol>
          <p className="aside-note" style={{ marginTop: 28 }}>
            Quotes come from the same live source used at payout. If a quote
            is unavailable we do not invent a coin amount.
          </p>
        </div>
      </section>
    </>
  );
}
