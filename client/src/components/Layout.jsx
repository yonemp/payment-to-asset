import { Outlet } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';

export default function Layout() {
  return (
    <div className="shell">
      <div className="page-glow" aria-hidden="true" />
      <a href="#main" className="skip">Skip to content</a>
      <Nav />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
