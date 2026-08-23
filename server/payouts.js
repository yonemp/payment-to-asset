/**
 * Mainnet payouts. Broadcasts real transfers; never fakes a tx hash.
 * Fail clearly if the matching hot-wallet key or RPC is missing.
 */
const { ethers } = require('ethers');
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('@bitcoinerlab/secp256k1');
const bs58 = require('bs58');

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const NETWORKS = {
  ETH: {
    id: 'ETH',
    chainId: 1,
    network: 'mainnet',
    symbol: 'ETH',
    explorerTx: (h) => `https://etherscan.io/tx/${h}`,
  },
  SOL: {
    id: 'SOL',
    chainId: null,
    network: 'mainnet-beta',
    symbol: 'SOL',
    explorerTx: (h) => `https://solscan.io/tx/${h}`,
  },
  BTC: {
    id: 'BTC',
    chainId: null,
    network: 'mainnet',
    symbol: 'BTC',
    explorerTx: (h) => `https://mempool.space/tx/${h}`,
  },
};

const ADDRESS_PATTERNS = {
  ETH: /^0x[a-fA-F0-9]{40}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
};

const FALLBACK_PRICES_USD = {
  ETH: 3200.0,
  SOL: 145.0,
  BTC: 65000.0,
};

const COINGECKO_IDS = {
  ETH: 'ethereum',
  SOL: 'solana',
  BTC: 'bitcoin',
};

const EXAMPLE_ETH_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function isConfiguredDummy(value) {
  const v = String(value || '').trim().replace(/^0x/i, '').toLowerCase();
  return !v || v === EXAMPLE_ETH_KEY;
}

function envTrim(name) {
  return String(process.env[name] || '').trim();
}

function validateWalletAddress(asset, address) {
  const pattern = ADDRESS_PATTERNS[asset];
  if (!pattern) return { valid: false, error: 'Unsupported asset. Use ETH, SOL, or BTC' };
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Wallet address required' };
  }
  const trimmed = address.trim();
  if (!pattern.test(trimmed)) {
    return { valid: false, error: `Invalid ${asset} mainnet address format` };
  }
  return { valid: true };
}

function payoutReady() {
  const ethKey = envTrim('ETH_HOT_WALLET_PRIVATE_KEY') || envTrim('HOT_WALLET_PRIVATE_KEY');
  const solKey = envTrim('SOL_HOT_WALLET_SECRET') || envTrim('HOT_WALLET_PRIVATE_KEY');
  const btcKey = envTrim('BTC_HOT_WALLET_WIF');
  return {
    ETH: !isConfiguredDummy(ethKey) && /^(0x)?[0-9a-fA-F]{64}$/.test(ethKey),
    SOL: !isConfiguredDummy(solKey),
    BTC: Boolean(btcKey) && !isConfiguredDummy(btcKey),
  };
}

async function sendEth({ walletAddress, cryptoAmount }) {
  const raw = envTrim('ETH_HOT_WALLET_PRIVATE_KEY') || envTrim('HOT_WALLET_PRIVATE_KEY');
  if (isConfiguredDummy(raw) || !/^(0x)?[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('HOT_WALLET_PRIVATE_KEY (32-byte hex) is required for Ethereum mainnet payouts');
  }
  const rpc = envTrim('ETH_RPC_URL') || 'https://cloudflare-eth.com';
  const provider = new ethers.JsonRpcProvider(rpc, 1);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 1) {
    throw new Error(`ETH_RPC_URL is not Ethereum mainnet (chainId ${network.chainId})`);
  }
  const wallet = new ethers.Wallet(raw.startsWith('0x') ? raw : `0x${raw}`, provider);
  const value = ethers.parseEther(String(cryptoAmount));
  if (value <= 0n) throw new Error('ETH amount is too small to send');
  const tx = await wallet.sendTransaction({ to: walletAddress, value, chainId: 1 });
  return { txHash: tx.hash };
}

function loadSolanaKeypair() {
  const raw = envTrim('SOL_HOT_WALLET_SECRET') || envTrim('HOT_WALLET_PRIVATE_KEY');
  if (isConfiguredDummy(raw)) {
    throw new Error('SOL_HOT_WALLET_SECRET is required for Solana mainnet payouts');
  }
  if (raw.startsWith('[')) {
    const bytes = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(bytes);
  }
  const hex = raw.replace(/^0x/i, '');
  if (/^[0-9a-fA-F]{128}$/.test(hex)) {
    return Keypair.fromSecretKey(Buffer.from(hex, 'hex'));
  }
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Keypair.fromSeed(Buffer.from(hex, 'hex'));
  }
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    throw new Error('SOL_HOT_WALLET_SECRET must be a Solana secret key (base58, hex, or JSON byte array)');
  }
}

async function sendSol({ walletAddress, cryptoAmount }) {
  const keypair = loadSolanaKeypair();
  const rpc = envTrim('SOL_RPC_URL') || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpc, 'confirmed');
  const toPubkey = new PublicKey(walletAddress);
  const lamports = Math.round(Number(cryptoAmount) * LAMPORTS_PER_SOL);
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('SOL amount is too small to send');
  }
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey,
      lamports,
    })
  );
  tx.feePayer = keypair.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.sign(keypair);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  // Do not wait for full confirmation — serverless time budget.
  void lastValidBlockHeight;
  return { txHash: sig };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${text.slice(0, 180)}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function sendBtc({ walletAddress, cryptoAmount }) {
  const wif = envTrim('BTC_HOT_WALLET_WIF');
  if (!wif) {
    throw new Error('BTC_HOT_WALLET_WIF (mainnet WIF) is required for Bitcoin mainnet payouts');
  }
  const network = bitcoin.networks.bitcoin;
  let keyPair;
  try {
    keyPair = ECPair.fromWIF(wif, network);
  } catch {
    throw new Error('BTC_HOT_WALLET_WIF must be a Bitcoin mainnet WIF private key');
  }

  const pubkey = Buffer.from(keyPair.publicKey);
  const payment = keyPair.compressed
    ? bitcoin.payments.p2wpkh({ pubkey, network })
    : bitcoin.payments.p2pkh({ pubkey, network });
  const fromAddress = payment.address;
  if (!fromAddress) throw new Error('Could not derive Bitcoin hot-wallet address');

  const api = (envTrim('BTC_API_URL') || 'https://mempool.space/api').replace(/\/$/, '');
  const utxos = await fetchJson(`${api}/address/${fromAddress}/utxo`);
  if (!Array.isArray(utxos) || utxos.length === 0) {
    throw new Error(`No Bitcoin UTXOs available for hot wallet ${fromAddress}`);
  }

  const satoshis = Math.round(Number(cryptoAmount) * 1e8);
  if (!Number.isFinite(satoshis) || satoshis < 546) {
    throw new Error('BTC amount is below the dust limit');
  }

  let feeRate = 8;
  try {
    const fees = await fetchJson(`${api}/v1/fees/recommended`);
    if (fees && Number(fees.halfHourFee) > 0) feeRate = Number(fees.halfHourFee);
  } catch {
    try {
      const estimates = await fetchJson(`${api}/fee-estimates`);
      const v = estimates && (estimates['3'] || estimates['6']);
      if (Number(v) > 0) feeRate = Number(v);
    } catch {
      /* keep default */
    }
  }

  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected = [];
  let totalIn = 0;
  const outCount = 2;
  const vbytesFor = (nIn) => Math.ceil(10.5 + nIn * (keyPair.compressed ? 68 : 148) + outCount * 31);
  for (const u of sorted) {
    selected.push(u);
    totalIn += Number(u.value);
    const fee = vbytesFor(selected.length) * feeRate;
    if (totalIn >= satoshis + fee) break;
  }
  const fee = vbytesFor(selected.length) * feeRate;
  if (totalIn < satoshis + fee) {
    throw new Error(`Insufficient Bitcoin hot-wallet balance (need ${satoshis + fee} sats, have ${totalIn})`);
  }

  const psbt = new bitcoin.Psbt({ network });
  for (const u of selected) {
    const prevHex = await fetchJson(`${api}/tx/${u.txid}/hex`);
    if (typeof prevHex !== 'string' || !/^[0-9a-fA-F]+$/.test(prevHex)) {
      throw new Error(`Could not load previous Bitcoin tx ${u.txid}`);
    }
    const input = {
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(prevHex, 'hex'),
    };
    if (keyPair.compressed) {
      input.witnessUtxo = { script: payment.output, value: Number(u.value) };
    }
    psbt.addInput(input);
  }
  psbt.addOutput({ address: walletAddress, value: satoshis });
  const change = totalIn - satoshis - fee;
  if (change >= 546) {
    psbt.addOutput({ address: fromAddress, value: change });
  }
  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();
  const rawTx = psbt.extractTransaction().toHex();

  const broadcast = await fetch(`${api}/tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: rawTx,
  });
  const body = await broadcast.text();
  if (!broadcast.ok) {
    throw new Error(`Bitcoin broadcast failed: ${broadcast.status} ${body.slice(0, 180)}`);
  }
  const txHash = body.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error(`Bitcoin broadcast returned an unexpected payload: ${txHash.slice(0, 80)}`);
  }
  return { txHash };
}

async function sendPayout({ asset, cryptoAmount, walletAddress }) {
  const addr = validateWalletAddress(asset, walletAddress);
  if (!addr.valid) throw new Error(addr.error);
  const amount = Number(cryptoAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid payout amount');
  }
  if (asset === 'ETH') return sendEth({ walletAddress: walletAddress.trim(), cryptoAmount: amount });
  if (asset === 'SOL') return sendSol({ walletAddress: walletAddress.trim(), cryptoAmount: amount });
  if (asset === 'BTC') return sendBtc({ walletAddress: walletAddress.trim(), cryptoAmount: amount });
  throw new Error('Unsupported asset');
}

module.exports = {
  NETWORKS,
  ADDRESS_PATTERNS,
  FALLBACK_PRICES_USD,
  COINGECKO_IDS,
  validateWalletAddress,
  payoutReady,
  sendPayout,
};
