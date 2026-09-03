import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = 'Card to Crypto';
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="shell">
      <a href="#main" className="skip">Skip to content</a>
      <Nav />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
