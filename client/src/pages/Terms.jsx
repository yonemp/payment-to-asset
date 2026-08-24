import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  useEffect(() => {
    document.title = 'No KYC Card to Crypto';
  }, []);

  return (
    <section className="section legal-page">
      <div className="wrap legal-wrap">
        <div className="section-head">
          <h1>Terms of Use</h1>
          <p>Last updated August 23, 2026. Card to Crypto at tackers.xyz.</p>
        </div>

        <div className="legal-body">
          <p>
            These terms cover your use of Card to Crypto at{' '}
            <a href="https://www.tackers.xyz">www.tackers.xyz</a>.
          </p>

          <h2>The service</h2>
          <p>
            Card to Crypto lets you pay USD with a credit or debit card. After
            Stripe confirms the payment, we send ETH, SOL, or BTC to the wallet
            address you enter. A 2% service fee is taken from the USD amount you
            enter. The remaining 98% is converted at the live rate when the
            order is created.
          </p>
          <p>
            This site does not run its own identity-check program. The payment
            processor may collect billing or identity information as part of
            the card charge.
          </p>

          <h2>Your wallet</h2>
          <p>
            You must enter a wallet address you control for the asset you pick.
            We send to the address as typed. If the address is wrong, belongs to
            someone else, or does not support that asset, the funds are likely
            gone. Transfers cannot be reversed after they are broadcast.
          </p>

          <h2>Quotes and price</h2>
          <p>
            The amount shown before you pay is an estimate from a live quote.
            Crypto prices move. We do not guarantee the final amount, a fill
            price, or a delivery time. Delivery depends on the card payment
            clearing and on network conditions.
          </p>

          <h2>Crypto risk</h2>
          <p>
            Crypto is volatile. This site is a checkout, not investment advice,
            not a broker, and not a custodial wallet. Once the asset arrives, it
            is yours to hold, send, or use.
          </p>

          <h2>Orders we may refuse</h2>
          <p>
            We may refuse, delay, or cancel an order if the payment does not
            clear, the address fails checks, the send cannot be broadcast, or we
            believe the order is fraudulent or not allowed.
          </p>

          <h2>What you may not do</h2>
          <p>
            You may not use this site for illegal activity, fraud, or to send
            value to or from sanctioned jurisdictions or sanctioned people. You
            must be allowed to use a card on-ramp under the laws that apply to
            you.
          </p>

          <h2>Liability</h2>
          <p>
            The service is provided as is. To the fullest extent allowed by
            applicable law, Card to Crypto and the operators of tackers.xyz are
            not liable for lost funds from a wrong address, network delays or
            congestion, price movement between quote and send, Stripe declines
            or holds, or downtime.
          </p>
          <p>
            Our total liability for a given order is limited to the USD amount
            you paid for that order, except where the law does not allow that
            limit.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of the State of New York, USA,
            without regard to conflict-of-law rules.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms. The date at the top is the latest
            version. Continued use of the site after a change means you accept
            the new terms.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms: use the site at{' '}
            <a href="https://www.tackers.xyz">www.tackers.xyz</a>.
          </p>

          <p className="legal-nav">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/buy/sol">Back to buy</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
