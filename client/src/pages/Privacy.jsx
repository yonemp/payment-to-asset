import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  useEffect(() => {
    document.title = 'No KYC Card to Crypto';
  }, []);

  return (
    <section className="section legal-page">
      <div className="wrap legal-wrap">
        <div className="section-head">
          <h1>Privacy Policy</h1>
          <p>Last updated September 3, 2026. Card to Crypto at cardtosol.com and cardtobtc.com.</p>
        </div>

        <div className="legal-body">
          <p>
            Card to Crypto on this site is a card-to-credits checkout. You pay
            in USD with a card. After the payment confirms we issue a credit
            balance to a credit code and order ID. This site does not send
            cryptocurrency. This page says what we collect and why.
          </p>

          <h2>What we collect</h2>
          <p>When you place an order we store:</p>
          <ul>
            <li>The USD amount, the 14% fee, and the resulting credit balance</li>
            <li>An order ID and a credit code so you can look up the balance</li>
            <li>
              A checkout session id and payment status so we know the card
              charge succeeded
            </li>
            <li>
              Order status and remaining credit balance
            </li>
            <li>
              Basic server logs (time, path, error messages) so we can debug a
              failed credit
            </li>
          </ul>
          <p>
            We do not store full card numbers. Card details are entered on
            the hosted card checkout. The payment processor handles the charge.
          </p>
          <p>
            Your theme choice (light or dark) is saved in localStorage on your
            device (<span className="mono">pta-theme</span>). We do not send
            that to our servers.
          </p>

          <h2>What we do not collect</h2>
          <p>
            This site does not run its own analytics pixels, ad trackers, or a
            marketing email list. We do not ask you to create an account. We
            do not require a wallet address to buy credits.
          </p>

          <h2>Why we collect it</h2>
          <p>
            We use this information to take payment, issue credits, and show
            you order status and remaining balance.
          </p>

          <h2>Payment processor</h2>
          <p>
            Whop processes the card payment and has its own privacy policy. We
            receive a session id and payment status, not your full card number.
            If the processor asks you for billing or identity information, that
            exchange is with the processor.
          </p>

          <h2>Cookies and local storage</h2>
          <p>
            This site uses localStorage for the theme toggle. The hosted
            checkout may set its own cookies when you pay. We do not set
            advertising cookies.
          </p>

          <h2>How long we keep orders</h2>
          <p>
            Orders stay in our store so you can look them up later and so we
            have a record of what was paid and credited. We keep them until you
            ask us to delete an order we can still identify, or until we no
            longer need the record to operate the service.
          </p>

          <h2>We do not sell personal data</h2>
          <p>
            We do not sell your credit code, order history, or other
            personal data.
          </p>

          <h2>Deletion and questions</h2>
          <p>
            If you want an order record removed, or you have a privacy question,
            contact us through the site at{' '}
            <a href="https://www.cardtosol.com/">www.cardtosol.com</a> or <a href="https://www.cardtobtc.com/">www.cardtobtc.com</a>. Include the
            order ID or credit code if you have one. We may need that ID to find the record.
          </p>

          <p className="legal-nav">
            <Link to="/terms">Terms of Use</Link>
            <Link to="/buy/sol">Back to buy</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
