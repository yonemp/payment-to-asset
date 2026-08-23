import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';

const STEPS = [
  {
    n: '01',
    title: 'Set the pair',
    body: 'Open Buy Solana (or ETH / BTC). Enter how much USD you want to spend and review the live quote. The amount you receive is estimated — we do not invent a price.',
  },
  {
    n: '02',
    title: 'Enter your wallet',
    body: 'Paste an address you control for that asset. The form checks format and length before checkout. After a transfer is broadcast it cannot be reversed.',
  },
  {
    n: '03',
    title: 'Pay with your card',
    body: 'Continue to Stripe Checkout. Pay with a credit or debit card. The order is stored as pending until the payment confirms.',
  },
  {
    n: '04',
    title: 'Receive the asset',
    body: 'After Stripe confirms we broadcast to your address. The success page updates through paid, quoted, broadcasting, and confirmed, and links the explorer when a hash exists.',
  },
];

export default function HowItWorks() {
  useEffect(() => {
    document.title = 'How it works — Card to Crypto';
  }, []);

  return (
    <>
      <PageHero
        kicker="// HOW IT WORKS"
        chips={['CARD', 'QUOTE', 'WALLET']}
        title="Four steps from card to wallet"
        lede="No extra app. You pay in USD. We send SOL, ETH, or BTC to the address you enter after Stripe confirms."
        aside={
          <aside className="term" aria-hidden="true">
            <div className="term-bar">
              <span className="term-dots"><i /><i /><i /></span>
              <span>flow</span>
            </div>
            <pre className="term-body">
              <span className="term-dim">01</span> pay usd on stripe{'\n'}
              <span className="term-dim">02</span> take 2% service fee{'\n'}
              <span className="term-dim">03</span> quote remaining 98%{'\n'}
              <span className="term-dim">04</span> send to your wallet
            </pre>
          </aside>
        }
      >
        <div className="actions">
          <Link className="btn btn-primary" to="/buy/sol">
            Buy Solana
          </Link>
          <Link className="btn btn-ghost" to="/fees">
            See fees
          </Link>
        </div>
      </PageHero>

      <section className="section band-soft">
        <div className="wrap">
          <p className="kicker">// STEPS</p>
          <h2>From the amount you type to the hash</h2>
          <ol className="step-list">
            {STEPS.map((step) => (
              <li key={step.n} className="step-row">
                <span className="num">{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
