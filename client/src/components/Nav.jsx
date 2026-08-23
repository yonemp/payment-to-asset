import { Link, NavLink } from 'react-router-dom';

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="Pay to Asset home">
          <img src="/mark.png" alt="" width="36" height="36" className="brand-mark" />
          <span className="brand-word">
            Pay <span className="brand-arrow" aria-hidden="true">→</span> Asset
          </span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <a href="/#checkout">Checkout</a>
          <a href="/#how">How it works</a>
          <a href="/#networks">Networks</a>
          <NavLink to="/lookup">Lookup</NavLink>
        </nav>

        <div className="nav-end">
          <span className="pill" title="Production mainnet delivery">Mainnet</span>
          <a href="/#checkout" className="nav-cta">
            Open ticket
          </a>
        </div>
      </div>
    </header>
  );
}
