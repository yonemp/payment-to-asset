import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';
import { FAQ } from '../lib/faq';

export default function Faq() {
  const [open, setOpen] = useState(0);

  useEffect(() => {
    document.title = 'No KYC Card to Crypto';
  }, []);

  return (
    <>
      <PageHero
        kicker="// FAQ"
        chips={['DELIVERY', 'FEES', 'WALLETS']}
        title="Before you pay"
        lede="Delivery, fees, wallets, and quotes. If you already have an order ID, use Lookup."
      >
        <div className="actions">
          <Link className="btn btn-primary" to="/buy/sol">
            Buy Solana
          </Link>
          <Link className="btn btn-ghost" to="/lookup">
            Lookup
          </Link>
        </div>
      </PageHero>

      <section className="section band-soft">
        <div className="wrap faq-page">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={`faq-item${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  {item.q}
                  <span aria-hidden="true">{isOpen ? '–' : '+'}</span>
                </button>
                {isOpen && <p>{item.a}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
