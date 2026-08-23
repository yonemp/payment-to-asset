import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Lookup from './pages/Lookup';
import Privacy from './pages/Privacy';
import Success from './pages/Success';
import Terms from './pages/Terms';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/success" element={<Success />} />
        <Route path="/lookup" element={<Lookup />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Route>
    </Routes>
  );
}
