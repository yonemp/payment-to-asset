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
            Card payment, mainnet delivery. ETH, SOL, and BTC settle on-chain after Stripe
            confirms. A 2% service fee is taken before conversion.
          </p>
        </div>

        <div>
          <h2 className="footer-head">Product</h2>
          <ul>
            <li><a href="/#checkout">Checkout</a></li>
            <li><a href="/#how">Path</a></li>
            <li><a href="/#networks">Networks</a></li>
            <li><Link to="/lookup">Order lookup</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="footer-head">Settlement</h2>
          <ul>
            <li>Ethereum · chainId 1</li>
            <li>Solana · mainnet-beta</li>
            <li>Bitcoin · mainnet</li>
            <li>Stripe Checkout</li>
          </ul>
        </div>

        <div>
          <h2 className="footer-head">Note</h2>
          <p className="footer-note-copy">
            Addresses are validated before checkout. A mistyped destination cannot be reversed
            after broadcast. Production funds only — this is not a testnet.
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
