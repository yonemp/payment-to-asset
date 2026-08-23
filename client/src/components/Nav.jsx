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
          <a href="/#checkout">Checkout</a>
          <a href="/#how">Path</a>
          <a href="/#networks">Networks</a>
          <NavLink to="/lookup">Lookup</NavLink>
        </nav>

        <div className="nav-end">
          <a href="/#checkout" className="nav-cta">
            Pay now →
          </a>
        </div>
      </div>
    </header>
  );
}
