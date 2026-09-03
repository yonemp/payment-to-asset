import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';

const ROWS = [
  { label: 'You enter', value: '$100.00' },
  { label: 'Service fee · 14%', value: '$14.00' },
  { label: 'Credits issued', value: '86.00 credits' },
];

export default function Fees() {
  useEffect(() => {
    document.title = 'Card to Crypto';
  }, []);

  return (
    <>
      <PageHero
        kicker="// FEES"
        chips={['14%', 'CREDITS', 'CARD']}
        title="14% from the amount you enter"
        lede="A 14% service fee is taken from the USD you type. The remaining 86% becomes your credit balance: $1 net = 1 credit. Card processing happens on card checkout. Minimum purchase is $25. Maximum purchase is $5000."
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
            Buy credits
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
              <h3>Always 14%</h3>
              <p>Taken from the USD you enter — not added on top of the amount you type.</p>
            </li>
            <li className="num-card">
              <span className="num">02</span>
              <h3>Card checkout</h3>
              <p>We do not store the card number. The charge happens on a hosted card checkout.</p>
            </li>
            <li className="num-card">
              <span className="num">03</span>
              <h3>$1 net = 1 credit</h3>
              <p>Credits are a site balance. Crypto redemption is a separate service at <a href="https://www.insider.quest/">insider.quest</a>.</p>
            </li>
            <li className="num-card">
              <span className="num">04</span>
              <h3>$25 to $5000</h3>
              <p>Minimum purchase is $25 so small orders do not lose money on fees. Maximum purchase is $5000.</p>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
