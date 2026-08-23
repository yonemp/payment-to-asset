import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Lookup from './pages/Lookup';
import Success from './pages/Success';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/success" element={<Success />} />
        <Route path="/lookup" element={<Lookup />} />
      </Route>
    </Routes>
  );
}
