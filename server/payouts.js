/**
 * Mainnet payouts. Broadcasts real transfers; never fakes a tx hash.
 * Heavy chain libs are lazy-required so /api/health stays up if one fails.
 */
function loadBs58() {
  return require('bs58');
}

const NETWORKS = {
  ETH: { id: 'ETH', chainId: 1, network: 'mainnet', symbol: 'ETH', explorerTx: (h) => 'https://etherscan.io/tx/' + h },
  SOL: { id: 'SOL', chainId: null, network: 'mainnet-beta', symbol: 'SOL', explorerTx: (h) => 'https://solscan.io/tx/' + h },
  BTC: { id: 'BTC', chainId: null, network: 'mainnet', symbol: 'BTC', explorerTx: (h) => 'https://mempool.space/tx/' + h },
};

const ADDRESS_PATTERNS = {
  ETH: /^0x[a-fA-F0-9]{40}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
};

const FALLBACK_PRICES_USD = { ETH: 3200.0, SOL: 145.0, BTC: 65000.0 };
const COINGECKO_IDS = { ETH: 'ethereum', SOL: 'solana', BTC: 'bitcoin' };
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
  if (!address || typeof address !== 'string') return { valid: false, error: 'Wallet address required' };
  if (!pattern.test(address.trim())) return { valid: false, error: 'Invalid ' + asset + ' address format' };
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
  const { ethers } = require('ethers');
  const raw = envTrim('ETH_HOT_WALLET_PRIVATE_KEY') || envTrim('HOT_WALLET_PRIVATE_KEY');
  if (isConfiguredDummy(raw) || !/^(0x)?[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('HOT_WALLET_PRIVATE_KEY (32-byte hex) is required for Ethereum mainnet payouts');
  }
  const rpc = envTrim('ETH_RPC_URL') || 'https://cloudflare-eth.com';
  const provider = new ethers.JsonRpcProvider(rpc, 1);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 1) {
    throw new Error('ETH_RPC_URL is not Ethereum mainnet (chainId ' + network.chainId + ')');
  }
  const wallet = new ethers.Wallet(raw.startsWith('0x') ? raw : ('0x' + raw), provider);
  const value = ethers.parseEther(String(cryptoAmount));
  if (value <= 0n) throw new Error('ETH amount is too small to send');
  const tx = await wallet.sendTransaction({ to: walletAddress, value, chainId: 1 });
  return { txHash: tx.hash };
}

function compactU16(n) {
  const out = [];
  let rem = n >>> 0;
  while (true) {
    let elem = rem & 0x7f;
    rem >>>= 7;
    if (rem === 0) { out.push(elem); break; }
    out.push(elem | 0x80);
  }
  return Buffer.from(out);
}

function loadSolanaKeypair() {
  const nacl = require('tweetnacl');
  const raw = envTrim('SOL_HOT_WALLET_SECRET') || envTrim('HOT_WALLET_PRIVATE_KEY');
  if (isConfiguredDummy(raw)) throw new Error('SOL_HOT_WALLET_SECRET is required for Solana mainnet payouts');
  let secret;
  if (raw.startsWith('[')) {
    secret = Uint8Array.from(JSON.parse(raw));
  } else {
    const hex = raw.replace(/^0x/i, '');
    if (/^[0-9a-fA-F]{128}$/.test(hex)) {
      secret = Uint8Array.from(Buffer.from(hex, 'hex'));
    } else if (/^[0-9a-fA-F]{64}$/.test(hex)) {
      secret = nacl.sign.keyPair.fromSeed(Uint8Array.from(Buffer.from(hex, 'hex'))).secretKey;
    } else {
      try { secret = Uint8Array.from(loadBs58().decode(raw)); }
      catch (err) { throw new Error('SOL_HOT_WALLET_SECRET must be a Solana secret key (base58, hex, or JSON byte array)'); }
    }
  }
  if (secret.length === 32) secret = nacl.sign.keyPair.fromSeed(secret).secretKey;
  if (secret.length !== 64) throw new Error('SOL_HOT_WALLET_SECRET must decode to 32 or 64 bytes');
  const pair = nacl.sign.keyPair.fromSecretKey(secret);
  return { secretKey: pair.secretKey, publicKey: Buffer.from(pair.publicKey) };
}

async function solRpc(method, params) {
  const rpc = envTrim('SOL_RPC_URL') || 'https://api.mainnet-beta.solana.com';
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error('Solana RPC ' + method + ' failed: ' + ((body.error && body.error.message) || res.status));
  }
  return body.result;
}

async function sendSol({ walletAddress, cryptoAmount }) {
  const nacl = require('tweetnacl');
  const kp = loadSolanaKeypair();
  let toPub;
  try { toPub = Buffer.from(loadBs58().decode(walletAddress)); }
  catch (err) { throw new Error('Invalid Solana destination address'); }
  if (toPub.length !== 32) throw new Error('Invalid Solana destination address');
  const lamports = Math.round(Number(cryptoAmount) * 1e9);
  if (!Number.isFinite(lamports) || lamports <= 0) throw new Error('SOL amount is too small to send');
  const latest = await solRpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const blockhash = latest && latest.value ? latest.value.blockhash : latest && latest.blockhash;
  if (!blockhash) throw new Error('Solana getLatestBlockhash returned no blockhash');
  const recent = Buffer.from(loadBs58().decode(blockhash));
  if (recent.length !== 32) throw new Error('Invalid Solana blockhash');
  const systemProgram = Buffer.alloc(32);
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2, 0);
  data.writeBigUInt64LE(BigInt(lamports), 4);
  const ix = Buffer.concat([Buffer.from([2]), compactU16(2), Buffer.from([0, 1]), compactU16(data.length), data]);
  const message = Buffer.concat([Buffer.from([1, 0, 1]), compactU16(3), kp.publicKey, toPub, systemProgram, recent, compactU16(1), ix]);
  const sig = Buffer.from(nacl.sign.detached(message, kp.secretKey));
  const raw = Buffer.concat([compactU16(1), sig, message]);
  const sigB58 = await solRpc('sendTransaction', [raw.toString('base64'), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
  if (!sigB58) throw new Error('Solana sendTransaction returned empty signature');
  return { txHash: sigB58 };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(url + ' -> ' + res.status + ' ' + text.slice(0, 180));
  if (!text) return null;
  try { return JSON.parse(text); } catch (err) { return text; }
}

async function sendBtc({ walletAddress, cryptoAmount }) {
  const bitcoin = require('bitcoinjs-lib');
  const { ECPairFactory } = require('ecpair');
  const ecc = require('@bitcoinerlab/secp256k1');
  bitcoin.initEccLib(ecc);
  const ECPair = ECPairFactory(ecc);
  const wif = envTrim('BTC_HOT_WALLET_WIF');
  if (!wif) throw new Error('BTC_HOT_WALLET_WIF (mainnet WIF) is required for Bitcoin mainnet payouts');
  const network = bitcoin.networks.bitcoin;
  let keyPair;
  try { keyPair = ECPair.fromWIF(wif, network); }
  catch (err) { throw new Error('BTC_HOT_WALLET_WIF must be a Bitcoin mainnet WIF private key'); }
  const pubkey = Buffer.from(keyPair.publicKey);
  const payment = keyPair.compressed ? bitcoin.payments.p2wpkh({ pubkey, network }) : bitcoin.payments.p2pkh({ pubkey, network });
  const fromAddress = payment.address;
  if (!fromAddress) throw new Error('Could not derive Bitcoin hot-wallet address');
  const api = (envTrim('BTC_API_URL') || 'https://mempool.space/api').replace(/\/$/, '');
  const utxos = await fetchJson(api + '/address/' + fromAddress + '/utxo');
  if (!Array.isArray(utxos) || utxos.length === 0) throw new Error('No Bitcoin UTXOs available for hot wallet ' + fromAddress);
  const satoshis = Math.round(Number(cryptoAmount) * 1e8);
  if (!Number.isFinite(satoshis) || satoshis < 546) throw new Error('BTC amount is below the dust limit');
  let feeRate = 8;
  try {
    const fees = await fetchJson(api + '/v1/fees/recommended');
    if (fees && Number(fees.halfHourFee) > 0) feeRate = Number(fees.halfHourFee);
  } catch (err) {
    try {
      const estimates = await fetchJson(api + '/fee-estimates');
      const v = estimates && (estimates['3'] || estimates['6']);
      if (Number(v) > 0) feeRate = Number(v);
    } catch (err2) { /* default */ }
  }
  const sorted = utxos.slice().sort((a, b) => b.value - a.value);
  const selected = [];
  let totalIn = 0;
  const vbytesFor = (nIn) => Math.ceil(10.5 + nIn * (keyPair.compressed ? 68 : 148) + 62);
  for (const u of sorted) {
    selected.push(u);
    totalIn += Number(u.value);
    if (totalIn >= satoshis + vbytesFor(selected.length) * feeRate) break;
  }
  const fee = vbytesFor(selected.length) * feeRate;
  if (totalIn < satoshis + fee) throw new Error('Insufficient Bitcoin hot-wallet balance (need ' + (satoshis + fee) + ' sats, have ' + totalIn + ')');
  const psbt = new bitcoin.Psbt({ network });
  for (const u of selected) {
    const prevHex = await fetchJson(api + '/tx/' + u.txid + '/hex');
    if (typeof prevHex !== 'string' || !/^[0-9a-fA-F]+$/.test(prevHex)) throw new Error('Could not load previous Bitcoin tx ' + u.txid);
    const input = { hash: u.txid, index: u.vout, nonWitnessUtxo: Buffer.from(prevHex, 'hex') };
    if (keyPair.compressed) input.witnessUtxo = { script: payment.output, value: Number(u.value) };
    psbt.addInput(input);
  }
  psbt.addOutput({ address: walletAddress, value: satoshis });
  const change = totalIn - satoshis - fee;
  if (change >= 546) psbt.addOutput({ address: fromAddress, value: change });
  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();
  const rawTx = psbt.extractTransaction().toHex();
  const broadcast = await fetch(api + '/tx', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: rawTx });
  const body = await broadcast.text();
  if (!broadcast.ok) throw new Error('Bitcoin broadcast failed: ' + broadcast.status + ' ' + body.slice(0, 180));
  const txHash = body.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('Bitcoin broadcast returned an unexpected payload: ' + txHash.slice(0, 80));
  return { txHash };
}

async function sendPayout({ asset, cryptoAmount, walletAddress }) {
  const addr = validateWalletAddress(asset, walletAddress);
  if (!addr.valid) throw new Error(addr.error);
  const amount = Number(cryptoAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid payout amount');
  if (asset === "ETH") return sendEth({ walletAddress: walletAddress.trim(), cryptoAmount: amount });
  if (asset === "SOL") return sendSol({ walletAddress: walletAddress.trim(), cryptoAmount: amount });
  if (asset === "BTC") return sendBtc({ walletAddress: walletAddress.trim(), cryptoAmount: amount });
  throw new Error('Unsupported asset');
}


function deriveEthAddress() {
  try {
    const { ethers } = require('ethers');
    const raw = envTrim('ETH_HOT_WALLET_PRIVATE_KEY') || envTrim('HOT_WALLET_PRIVATE_KEY');
    if (isConfiguredDummy(raw) || !/^(0x)?[0-9a-fA-F]{64}$/.test(raw)) return null;
    return new ethers.Wallet(raw.startsWith('0x') ? raw : ('0x' + raw)).address;
  } catch (err) {
    console.warn('[swap] derive ETH deposit', err.message);
    return null;
  }
}

function deriveSolAddress() {
  try {
    const kp = loadSolanaKeypair();
    return loadBs58().encode(kp.publicKey);
  } catch (err) {
    console.warn('[swap] derive SOL deposit', err.message);
    return null;
  }
}

function deriveBtcAddress() {
  try {
    const bitcoin = require('bitcoinjs-lib');
    const { ECPairFactory } = require('ecpair');
    const ecc = require('@bitcoinerlab/secp256k1');
    bitcoin.initEccLib(ecc);
    const ECPair = ECPairFactory(ecc);
    const wif = envTrim('BTC_HOT_WALLET_WIF');
    if (!wif || isConfiguredDummy(wif)) return null;
    const network = bitcoin.networks.bitcoin;
    const keyPair = ECPair.fromWIF(wif, network);
    const pubkey = Buffer.from(keyPair.publicKey);
    const payment = keyPair.compressed
      ? bitcoin.payments.p2wpkh({ pubkey, network })
      : bitcoin.payments.p2pkh({ pubkey, network });
    return payment.address || null;
  } catch (err) {
    console.warn('[swap] derive BTC deposit', err.message);
    return null;
  }
}

function depositAddressFor(asset) {
  const code = String(asset || '').toUpperCase();
  const explicit = envTrim('SWAP_DEPOSIT_' + code);
  if (explicit) {
    const check = validateWalletAddress(code, explicit);
    if (check.valid) return explicit.trim();
    console.warn('[swap] SWAP_DEPOSIT_' + code + ' failed address check');
  }
  if (code === 'ETH') return deriveEthAddress();
  if (code === 'SOL') return deriveSolAddress();
  if (code === 'BTC') return deriveBtcAddress();
  return null;
}

module.exports = {
  NETWORKS,
  ADDRESS_PATTERNS,
  FALLBACK_PRICES_USD,
  COINGECKO_IDS,
  validateWalletAddress,
  payoutReady,
  sendPayout,
  depositAddressFor,
};
