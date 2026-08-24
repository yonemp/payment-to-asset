import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';

const ROWS = [
  { label: 'You enter', value: '$100.00' },
  { label: 'Service fee · 2%', value: '$2.00' },
  { label: 'Converted at live rate', value: '$98.00' },
];

export default function Fees() {
  useEffect(() => {
    document.title = 'No KYC Card to Crypto';
  }, []);

  return (
    <>
      <PageHero
        kicker="// FEES"
        chips={['2%', 'LIVE QUOTE', 'STRIPE']}
        title="2% from the amount you enter"
        lede="A 2% service fee is taken from the USD you type. The remaining 98% is converted at the live rate when the order is created. Card processing happens on Stripe. Minimum purchase is $10. Maximum purchase is $5000."
        aside={
          <div className="ticket">
            <p className="kicker">// EXAMPLE</p>
            <h2 style={{ fontSize: '1.4rem', marginBottom: 16 }}>One hundred dollars</h2>
            <div className="fee-table">
              {ROWS.map((row) => (
                <div key={row.label} className="fee-row">
                  <span>{row.label}</span>
                  <strong className="mono">{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <div className="actions">
          <Link className="btn btn-primary" to="/buy/sol">
            Buy Solana
          </Link>
          <Link className="btn btn-ghost" to="/faq">
            FAQ
          </Link>
        </div>
      </PageHero>

      <section className="section band-soft">
        <div className="wrap">
          <p className="kicker">// WHAT YOU PAY</p>
          <h2>The fee does not move</h2>
          <ol className="num-grid">
            <li className="num-card">
              <span className="num">01</span>
              <h3>Always 2%</h3>
              <p>Taken from the USD you enter — not from a hidden spread we invent.</p>
            </li>
            <li className="num-card">
              <span className="num">02</span>
              <h3>Stripe takes the card</h3>
              <p>We do not store the card number. The charge happens on Stripe Checkout.</p>
            </li>
            <li className="num-card">
              <span className="num">03</span>
              <h3>Quote is live</h3>
              <p>If a quote is unavailable we do not invent a coin amount.</p>
            </li>
            <li className="num-card">
              <span className="num">04</span>
              <h3>$10 to $5000</h3>
              <p>Minimum purchase is $10 so small orders do not lose money on fees. Maximum purchase is $5000.</p>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
