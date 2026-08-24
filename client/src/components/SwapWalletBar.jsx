export default function SwapWalletBar({
  fromAsset,
  needsWallet,
  isConnected,
  displayAddress,
  connecting,
  disabled,
  onConnect,
  onDisconnect,
}) {
  if (fromAsset === 'BTC') {
    return (
      <div className="wallet-bar" role="status">
        <div className="wallet-bar-copy">
          <strong>Bitcoin deposit</strong>
          <span>No browser wallet. After you start the swap we show a deposit address and QR.</span>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="wallet-bar is-on" role="status">
        <div className="wallet-bar-copy">
          <strong>Connected</strong>
          <span className="mono">{displayAddress}</span>
        </div>
        <button type="button" className="btn-wallet-ghost" onClick={onDisconnect} disabled={connecting || disabled}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-bar">
      <div className="wallet-bar-copy">
        <strong>Connect wallet</strong>
        <span>
          {fromAsset === 'ETH'
            ? 'MetaMask or another injected Ethereum wallet sends the deposit.'
            : 'Phantom or Solflare sends the SOL deposit.'}
        </span>
      </div>
      <button type="button" className="btn-wallet" onClick={onConnect} disabled={connecting || disabled}>
        {connecting ? 'Connecting…' : 'Connect wallet'}
      </button>
    </div>
  );
}
