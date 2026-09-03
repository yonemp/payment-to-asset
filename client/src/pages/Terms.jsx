import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  useEffect(() => {
    document.title = 'Card to Crypto';
  }, []);

  return (
    <section className="section legal-page">
      <div className="wrap legal-wrap">
        <div className="section-head">
          <h1>Terms of Use</h1>
          <p>Last updated September 3, 2026. Card to Crypto at cardtosol.com and cardtobtc.com.</p>
        </div>

        <div className="legal-body">
          <p>
            These terms cover your use of Card to Crypto at{' '}
            <a href="https://www.cardtosol.com/">www.cardtosol.com</a> or <a href="https://www.cardtobtc.com/">www.cardtobtc.com</a>.
          </p>

          <h2>The service</h2>
          <p>
            Card to Crypto on this site sells credits. You pay USD with a
            credit or debit card. A 14% service fee is taken from the USD
            amount you enter. The remaining 86% is credited as a site balance
            ($1 net = 1 credit) to a credit code and order ID. This site does
            not send cryptocurrency and does not sell ETH, SOL, or BTC here.
          </p>
          <p>
            Crypto redemption is a separate service at{' '}
            <a href="https://www.insider.quest/">www.insider.quest</a>
            {' '}(also <a href="https://insider.quest">insider.quest</a>).
            It is not part of this checkout. Conversion rates, if any, are
            set on the redeem service under its own terms.
          </p>
          <p>
            Card checkout is handled by the payment processor. This site sells
            credits. Crypto redemption is a separate service at{' '}
            <a href="https://www.insider.quest/">www.insider.quest</a>. The
            payment processor or redeem service may collect billing or identity
            information.
          </p>

          <h2>Credit codes</h2>
          <p>
            After payment you receive an order ID and a credit code. You must
            save them. Anyone with the code can look up the balance. We are
            not responsible if you lose the code or share it.
          </p>

          <h2>Quotes and price</h2>
          <p>
            Credits are issued 1:1 with net USD after the 14% fee. We do not
            quote a live crypto amount on this site. If you later redeem
            credits, that conversion happens on the redeem service under its
            own terms.
          </p>

          <h2>Orders we may refuse</h2>
          <p>
            We may refuse, delay, or cancel an order if the payment does not
            clear, we cannot issue credits, or we believe the order is
            fraudulent or not allowed.
          </p>

          <h2>What you may not do</h2>
          <p>
            You may not use this site for illegal activity, fraud, or to send
            value to or from sanctioned jurisdictions or sanctioned people. You
            must be allowed to use a card checkout under the laws that apply to
            you.
          </p>

          <h2>Liability</h2>
          <p>
            The service is provided as is. To the fullest extent allowed by
            applicable law, Card to Crypto and the operators of cardtosol.com and cardtobtc.com are
            not liable for a lost credit code, payment processor declines or
            holds, or downtime.
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
            <a href="https://www.cardtosol.com/">www.cardtosol.com</a> or <a href="https://www.cardtobtc.com/">www.cardtobtc.com</a>.
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
