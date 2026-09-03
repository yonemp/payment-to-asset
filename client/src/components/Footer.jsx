import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';
import { REDEEM_URL } from '../lib/redeem';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link to="/" className="brand footer-lockup">
            <BrandMark size={28} />
            <span className="brand-word">Card to Crypto</span>
          </Link>
          <p>Buy credits with a card. <a href={REDEEM_URL}>Redeem credits</a>.</p>
          <p className="footer-tag">
            <a href="https://www.cardtosol.com/">cardtosol.com</a> · <a href="https://www.cardtobtc.com/">cardtobtc.com</a> · <a href={REDEEM_URL}>insider.quest</a>
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
            <li><Link to="/buy/sol">Credits</Link></li>
            <li><Link to="/fees">Fees</Link></li>
            <li><Link to="/lookup">Lookup</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="footer-head">Legal</h2>
          <ul>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/terms">Terms</Link></li>
          </ul>
        </div>
        <p className="footer-mark" aria-hidden="true">cardtosol · cardtobtc · insider.quest</p>
      </div>
      <div className="wrap footer-bar">
        <span>© {new Date().getFullYear()} Card to Crypto. All rights reserved.</span>
        <span className="footer-legal">
          <Link to="/privacy">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms">Terms</Link>
        </span>
        <span className="footer-domains"><a className="footer-domain" href="https://www.cardtosol.com/">cardtosol.com</a><span aria-hidden="true"> · </span><a className="footer-domain" href="https://www.cardtobtc.com/">cardtobtc.com</a><span aria-hidden="true"> · </span><a className="footer-domain" href={REDEEM_URL}>insider.quest</a></span>
      </div>
    </footer>
  );
}
