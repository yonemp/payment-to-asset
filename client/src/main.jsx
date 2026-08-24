import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WalletProviders } from './lib/wallets';
import '@solana/wallet-adapter-react-ui/styles.css';
import './index.css';

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WalletProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WalletProviders>
  </React.StrictMode>
);
