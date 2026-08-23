import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <div className="brand footer-lockup">
            <BrandMark size={32} />
            <span className="brand-word">
              Pay <span className="brand-arrow" aria-hidden="true">→</span> Asset
            </span>
          </div>
          <p>
            Buy ETH, SOL, or BTC with a card. You pay in USD, we send the asset
            to your wallet after Stripe confirms. A 2% service fee is taken from
            the amount you enter.
          </p>
        </div>

        <div>
          <h2 className="footer-head">Product</h2>
          <ul>
            <li><a href="/#checkout">Buy</a></li>
            <li><a href="/#how">How it works</a></li>
            <li><a href="/#networks">Networks</a></li>
            <li><Link to="/lookup">Order lookup</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="footer-head">Networks</h2>
          <ul>
            <li>Ethereum · mainnet</li>
            <li>Solana · mainnet</li>
            <li>Bitcoin · mainnet</li>
            <li>Card via Stripe</li>
          </ul>
        </div>

        <div>
          <h2 className="footer-head">Note</h2>
          <p className="footer-note-copy">
            Double-check the destination address. Transfers cannot be reversed
            after they are broadcast. This is a live on-ramp, not a testnet.
          </p>
        </div>
      </div>
      <div className="wrap footer-bar">
        <span>© {new Date().getFullYear()} Pay → Asset</span>
        <span className="mono muted">payment-to-asset.vercel.app</span>
      </div>
    </footer>
  );
}
