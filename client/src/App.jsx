import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Buy from './pages/Buy';
import HowItWorks from './pages/HowItWorks';
import Fees from './pages/Fees';
import Faq from './pages/Faq';
import Lookup from './pages/Lookup';
import Privacy from './pages/Privacy';
import Success from './pages/Success';
import Terms from './pages/Terms';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/buy" element={<Navigate to="/buy/sol" replace />} />
        <Route path="/buy/:asset" element={<Buy />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/fees" element={<Fees />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/success" element={<Success />} />
        <Route path="/lookup" element={<Lookup />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Route>
    </Routes>
  );
}
