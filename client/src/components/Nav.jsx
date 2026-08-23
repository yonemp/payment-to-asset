import { Link, NavLink } from 'react-router-dom';
import BrandMark from './BrandMark';

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="Pay to Asset home">
          <BrandMark />
          <span className="brand-word">
            Pay <span className="brand-arrow" aria-hidden="true">→</span> Asset
          </span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <a href="/#checkout">Buy</a>
          <a href="/#how">How it works</a>
          <a href="/#networks">Networks</a>
          <a href="/#faq">FAQ</a>
          <NavLink to="/lookup">Lookup</NavLink>
        </nav>

        <div className="nav-end">
          <a href="/#checkout" className="nav-cta">
            Buy crypto
          </a>
        </div>
      </div>
    </header>
  );
}
