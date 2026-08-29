import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import BrandMark from './BrandMark';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/buy/sol', label: 'Buy', match: '/buy' },
  { to: '/fees', label: 'Fees' },
  { to: '/faq', label: 'FAQ' },
  { to: '/lookup', label: 'Lookup' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  function close() {
    setOpen(false);
  }

  return (
    <header className="site-nav">
      <div className="wrap nav-row">
        <Link to="/" className="brand" aria-label="Card to Crypto home" onClick={close}>
          <BrandMark />
          <span className="brand-lockup">
            <span className="brand-word">Card to Crypto</span>
            <span className="brand-tag">The only true · no KYC ·<br />cardtosol.com · cardtobtc.com</span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((link) => {
            const active = link.match
              ? pathname.startsWith(link.match)
              : link.end
                ? pathname === '/'
                : pathname === link.to;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={active ? 'is-active' : undefined}
                end={!!link.end}
              >
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="nav-end">
          <ThemeToggle />
          <Link to="/buy/sol" className="btn btn-nav">
            Buy now
          </Link>
          <button
            type="button"
            className="nav-burger"
            aria-expanded={open}
            aria-controls="nav-panel"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className={`nav-panel${open ? ' is-open' : ''}`} id="nav-panel">
        {LINKS.map((link) => (
          <Link key={link.to} to={link.to} onClick={close}>
            {link.label}
          </Link>
        ))}
        <Link to="/buy/sol" className="btn btn-primary" onClick={close}>
          Buy now
        </Link>
      </div>
    </header>
  );
}
