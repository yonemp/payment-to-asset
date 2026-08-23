import { Link, NavLink } from 'react-router-dom';
import BrandMark from './BrandMark';
import ThemeToggle from './ThemeToggle';

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="Card to Crypto home">
          <BrandMark />
          <span className="brand-word">
            Card <span className="brand-arrow">to</span> Crypto
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
          <ThemeToggle />
          <a href="/#checkout" className="nav-cta">
            Buy now
          </a>
        </div>
      </div>
    </header>
  );
}
