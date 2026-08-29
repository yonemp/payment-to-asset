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
          <p>Last updated August 29, 2026. Card to Crypto at cardtosol.com and cardtobtc.com.</p>
        </div>

        <div className="legal-body">
          <p>
            Card to Crypto is a card-to-crypto checkout. You pay in USD with a
            card. After Stripe confirms, we send ETH, SOL, or BTC to the wallet
            address you enter. This page says what we collect and why.
          </p>

          <h2>What we collect</h2>
          <p>When you place an order we store:</p>
          <ul>
            <li>The wallet address you typed</li>
            <li>The asset (ETH, SOL, or BTC) and the USD amount</li>
            <li>
              A Stripe checkout session id and payment status so we know the
              card charge succeeded
            </li>
            <li>
              Order status, the quoted amount, and — after we send the asset
              — the transaction hash and explorer link
            </li>
            <li>
              Basic server logs (time, path, error messages) so we can debug a
              failed send
            </li>
          </ul>
          <p>
            We do not store full card numbers. Card details are entered on
            Stripe Checkout. Stripe handles the charge.
          </p>
          <p>
            Your theme choice (light or dark) is saved in localStorage on your
            device (<span className="mono">pta-theme</span>). We do not send
            that to our servers.
          </p>

          <h2>What we do not collect</h2>
          <p>
            This site does not run its own analytics pixels, ad trackers, or a
            marketing email list. We do not ask you to create an account.
          </p>

          <h2>Why we collect it</h2>
          <p>
            We use this information to take payment, quote a conversion, send
            crypto to your wallet, and show you order status.
          </p>

          <h2>Payment processor</h2>
          <p>
            Stripe processes the card payment and has{' '}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              its own privacy policy</a>. We receive a session id and payment status, not your full card
            number. If Stripe asks you for billing or identity information, that
            exchange is with Stripe.
          </p>

          <h2>Price quotes</h2>
          <p>
            Estimated coin amounts come from a live quote on our server. That
            quote may call a market-data source such as CoinGecko. Those
            services have their own policies.
          </p>

          <h2>Cookies and local storage</h2>
          <p>
            This site uses localStorage for the theme toggle. Stripe Checkout
            may set its own cookies when you pay. We do not set advertising
            cookies.
          </p>

          <h2>How long we keep orders</h2>
          <p>
            Orders stay in our store so you can look them up later and so we
            have a record of what was paid and sent. We keep them until you ask
            us to delete an order we can still identify, or until we no longer
            need the record to operate the service.
          </p>

          <h2>We do not sell personal data</h2>
          <p>
            We do not sell your wallet address, order history, or other
            personal data.
          </p>

          <h2>Deletion and questions</h2>
          <p>
            If you want an order record removed, or you have a privacy question,
            contact us through the site at{' '}
            <a href="https://www.cardtosol.com/">www.cardtosol.com</a> or <a href="https://www.cardtobtc.com/">www.cardtobtc.com</a>. Include the
            order ID if you have one. We may need that ID to find the record.
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
