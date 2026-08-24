import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { ethers } from 'ethers';
import { SOL_ENDPOINT } from './wallets';

function solLamports(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid SOL amount');
  const lamports = Math.round(n * 1e9);
  if (!Number.isFinite(lamports) || lamports <= 0) throw new Error('SOL amount is too small to send');
  return lamports;
}

async function sendSol(depositAddress, fromAmount, { publicKey, sendTransaction }) {
  const to = new PublicKey(depositAddress);
  const from = publicKey || (window.solana && window.solana.publicKey) || (window.solflare && window.solflare.publicKey);
  if (!from) throw new Error('Connect Phantom or Solflare first.');
  const fromPubkey = from instanceof PublicKey ? from : new PublicKey(String(from));
  const connection = new Connection(SOL_ENDPOINT, 'confirmed');
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey: to,
      lamports: solLamports(fromAmount),
    })
  );
  tx.feePayer = fromPubkey;
  const latest = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = latest.blockhash;

  if (typeof sendTransaction === 'function' && publicKey) {
    const sig = await sendTransaction(tx, connection, { skipPreflight: false });
    if (!sig) throw new Error('Solana wallet returned an empty signature.');
    return String(sig);
  }
  if (window.solana && window.solana.signAndSendTransaction) {
    const signed = await window.solana.signAndSendTransaction(tx);
    const sig = signed && (signed.signature || signed);
    if (!sig) throw new Error('Phantom returned an empty signature.');
    return String(sig);
  }
  if (window.solflare && window.solflare.signAndSendTransaction) {
    const signed = await window.solflare.signAndSendTransaction(tx);
    const sig = signed && (signed.signature || signed);
    if (!sig) throw new Error('Solflare returned an empty signature.');
    return String(sig);
  }
  throw new Error('No Solana wallet available to sign the transfer.');
}

async function sendEth(depositAddress, fromAmount) {
  if (!window.ethereum) throw new Error('Install MetaMask to send ETH.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const from = accounts && accounts[0];
  if (!from) throw new Error('ETH wallet did not return an address.');
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
    });
  } catch (err) {
    if (err && err.code === 4001) throw new Error('Switch to Ethereum to send this deposit.');
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 1) {
    throw new Error('Switch your wallet to Ethereum (chain 1) to send this deposit.');
  }
  const signer = await provider.getSigner();
  const value = ethers.parseEther(String(fromAmount));
  if (value <= 0n) throw new Error('ETH amount is too small to send');
  const tx = await signer.sendTransaction({
    to: depositAddress,
    value,
    chainId: 1,
  });
  if (!tx || !tx.hash) throw new Error('ETH wallet did not return a transaction hash.');
  return tx.hash;
}

export async function sendDeposit({ fromAsset, depositAddress, fromAmount, publicKey, sendTransaction }) {
  const asset = String(fromAsset || '').toUpperCase();
  if (!depositAddress) throw new Error('Deposit address is not configured.');
  if (asset === 'SOL') return sendSol(depositAddress, fromAmount, { publicKey, sendTransaction });
  if (asset === 'ETH') return sendEth(depositAddress, fromAmount);
  if (asset === 'BTC') {
    throw new Error('Bitcoin has no in-browser wallet here. Send to the deposit address shown next.');
  }
  throw new Error('Unsupported asset');
}
