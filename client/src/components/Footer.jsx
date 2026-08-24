import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link to="/" className="brand footer-lockup">
            <BrandMark size={28} />
            <span className="brand-word">Card to Crypto</span>
          </Link>
          <p>
            Card checkout that delivers SOL, ETH, or BTC to the wallet you
            enter. Solana is the featured product.
          </p>
          <p className="footer-tag mono">CARD · QUOTE · WALLET</p>
          <p className="footer-url">
            <a href="https://tackers.xyz">tackers.xyz</a>
          </p>
        </div>
        <div>
          <h2 className="footer-head">Pages</h2>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/buy/sol">Buy</Link></li>
            <li><Link to="/fees">Fees</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
            <li><Link to="/lookup">Lookup</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="footer-head">Buy</h2>
          <ul>
            <li><Link to="/buy/sol">Solana</Link></li>
            <li><Link to="/buy/eth">Ethereum</Link></li>
            <li><Link to="/buy/btc">Bitcoin</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="footer-head">Legal</h2>
          <ul>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/terms">Terms</Link></li>
          </ul>
        </div>
        <p className="footer-mark" aria-hidden="true">tackers.xyz</p>
      </div>
      <div className="wrap footer-bar">
        <span>© {new Date().getFullYear()} Card to Crypto. All rights reserved.</span>
        <span className="footer-legal">
          <Link to="/privacy">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms">Terms</Link>
        </span>
        <a className="footer-domain" href="https://tackers.xyz">tackers.xyz</a>
      </div>
    </footer>
  );
}
