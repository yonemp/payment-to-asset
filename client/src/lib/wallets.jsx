import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

const SOL_ENDPOINT = 'https://api.mainnet-beta.solana.com';

export function WalletProviders({ children }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter({ network: WalletAdapterNetwork.Mainnet }),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet }),
    ],
    []
  );
  return (
    <ConnectionProvider endpoint={SOL_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function truncateAddr(value) {
  const s = String(value || '');
  if (s.length <= 12) return s;
  return s.slice(0, 4) + '…' + s.slice(-4);
}

export function useSwapSender(fromAsset) {
  const {
    wallets,
    select,
    connect,
    disconnect: disconnectSol,
    connected,
    publicKey,
    sendTransaction,
    connecting,
  } = useWallet();
  const [ethAddress, setEthAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return undefined;
    let cancelled = false;
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accs) => {
        if (!cancelled && accs && accs[0]) setEthAddress(accs[0]);
      })
      .catch(() => {});
    function onAccounts(accs) {
      setEthAddress(accs && accs[0] ? accs[0] : '');
    }
    if (window.ethereum.on) window.ethereum.on('accountsChanged', onAccounts);
    return () => {
      cancelled = true;
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', onAccounts);
      }
    };
  }, []);

  const solAddress = connected && publicKey ? publicKey.toBase58() : '';
  const needsWallet = fromAsset === 'SOL' || fromAsset === 'ETH';
  const address = fromAsset === 'ETH' ? ethAddress : fromAsset === 'SOL' ? solAddress : '';
  const isConnected = needsWallet ? Boolean(address) : false;
  const walletLabel = fromAsset === 'ETH'
    ? (ethAddress ? 'MetaMask' : 'MetaMask')
    : fromAsset === 'SOL'
      ? (connected ? 'Phantom / Solflare' : 'Phantom')
      : 'Bitcoin';

  const connectWallet = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      if (fromAsset === 'ETH') {
        if (!window.ethereum) {
          throw new Error('Install MetaMask (or another injected wallet) to send ETH.');
        }
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accs || !accs[0]) throw new Error('ETH wallet did not return an address.');
        setEthAddress(accs[0]);
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x1' }],
          });
        } catch (err) {
          if (err && err.code !== 4001 && err.code !== 4902) {
            throw err;
          }
        }
        return accs[0];
      }
      if (fromAsset === 'SOL') {
        const installed = wallets.find((w) => w.readyState === 'Installed');
        const phantom = wallets.find((w) => w.adapter && w.adapter.name === 'Phantom');
        const solflare = wallets.find((w) => w.adapter && w.adapter.name === 'Solflare');
        const pick = installed || phantom || solflare;
        if (window.solana && window.solana.isPhantom) {
          const resp = await window.solana.connect();
          if (phantom) select(phantom.adapter.name);
          return resp && resp.publicKey ? resp.publicKey.toString() : '';
        }
        if (window.solflare && window.solflare.connect) {
          await window.solflare.connect();
          if (solflare) select(solflare.adapter.name);
          return window.solflare.publicKey ? window.solflare.publicKey.toString() : '';
        }
        if (!pick) {
          window.open('https://phantom.app/', '_blank', 'noopener,noreferrer');
          throw new Error('Install Phantom or Solflare to send SOL.');
        }
        select(pick.adapter.name);
        await connect();
        return publicKey ? publicKey.toBase58() : '';
      }
      throw new Error('Bitcoin uses a deposit address and QR — no browser wallet to connect.');
    } catch (err) {
      const msg = err && err.message ? err.message : 'Wallet connect failed';
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [fromAsset, wallets, select, connect, publicKey]);

  const disconnectWallet = useCallback(async () => {
    setError('');
    if (fromAsset === 'ETH') {
      setEthAddress('');
      return;
    }
    if (fromAsset === 'SOL') {
      try {
        if (window.solana && window.solana.disconnect) await window.solana.disconnect();
      } catch {
        /* ignore */
      }
      try {
        await disconnectSol();
      } catch {
        /* ignore */
      }
    }
  }, [fromAsset, disconnectSol]);

  return {
    needsWallet,
    isConnected,
    address,
    displayAddress: truncateAddr(address),
    walletLabel,
    connecting: busy || connecting,
    error,
    connectWallet,
    disconnectWallet,
    sendTransaction,
    solPublicKey: publicKey,
    truncateAddr,
  };
}

export { truncateAddr, SOL_ENDPOINT };
