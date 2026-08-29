export const API = '/api';

export const SERVICE_FEE = 0.14;
export const MIN_USD = 10;
export const MAX_USD = 5000;
export const AMOUNT_CHIPS = [25, 50, 100, 250];

export const ADDRESS_PATTERNS = {
  ETH: /^0x[a-fA-F0-9]{40}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
};

export const ASSETS = [
  {
    value: 'ETH',
    name: 'Ethereum',
    symbol: 'ETH',
    network: 'Ethereum',
    chain: 'chainId 1',
    tint: 'eth',
    mark: '/asset-eth.png',
    explorerName: 'Etherscan',
    explorer: (h) => `https://etherscan.io/tx/${h}`,
    addressHint: '0x + 40 hex characters',
    placeholder: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    buyTitle: 'Buy Ethereum',
    headline: 'Buy Ethereum with a card',
    eta: '~5–15 min',
  },
  {
    value: 'SOL',
    name: 'Solana',
    symbol: 'SOL',
    network: 'Solana',
    chain: 'Solana',
    tint: 'sol',
    mark: '/asset-sol.png',
    explorerName: 'Solscan',
    explorer: (h) => `https://solscan.io/tx/${h}`,
    addressHint: 'Base58, 32–44 characters',
    placeholder: '7EqQdEULxWcraVx3mXKJkd8YBmFjhWFdsNaAwAZr',
    buyTitle: 'Buy Solana',
    headline: 'Buy Solana with a card',
    eta: '~2–5 min',
  },
  {
    value: 'BTC',
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'Bitcoin',
    chain: 'Bitcoin',
    tint: 'btc',
    mark: '/asset-btc.png',
    explorerName: 'mempool.space',
    explorer: (h) => `https://mempool.space/tx/${h}`,
    addressHint: 'bc1, 1, or 3 prefix',
    placeholder: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    buyTitle: 'Buy Bitcoin',
    headline: 'Buy Bitcoin with a card',
    eta: '~20–60 min',
  },
];

export function getAsset(value) {
  return ASSETS.find((a) => a.value === value) || ASSETS[0];
}

export function feeMath(usd) {
  const gross = Number(usd);
  if (!Number.isFinite(gross) || gross <= 0) {
    return { gross: 0, fee: 0, net: 0 };
  }
  const fee = Number((gross * SERVICE_FEE).toFixed(2));
  const net = Number((gross - fee).toFixed(2));
  return { gross, fee, net };
}

export function validateAddress(asset, raw) {
  const value = (raw || '').trim();
  const meta = getAsset(asset);

  if (!value) {
    return { ok: false, tone: 'idle', message: `Enter a ${meta.name} wallet address.` };
  }

  if (asset === 'ETH') {
    if (!value.startsWith('0x')) {
      return { ok: false, tone: 'warn', message: 'Ethereum addresses start with 0x.' };
    }
    const hex = value.slice(2);
    if (/[^a-fA-F0-9]/.test(hex)) {
      return { ok: false, tone: 'warn', message: 'Only 0–9 and a–f after 0x.' };
    }
    if (hex.length !== 40) {
      return {
        ok: false,
        tone: 'warn',
        message: `Needs 40 hex characters after 0x · ${hex.length}/40`,
      };
    }
    return { ok: true, tone: 'ok', message: 'Valid Ethereum wallet address.' };
  }

  if (asset === 'SOL') {
    if (/[0OIl]/.test(value)) {
      return { ok: false, tone: 'warn', message: 'Solana addresses are base58 — no 0, O, I, or l.' };
    }
    if (/[^1-9A-HJ-NP-Za-km-z]/.test(value)) {
      return { ok: false, tone: 'warn', message: 'Contains characters that are not base58.' };
    }
    if (value.length < 32) {
      return { ok: false, tone: 'warn', message: `Too short · ${value.length}/32–44` };
    }
    if (value.length > 44) {
      return { ok: false, tone: 'warn', message: `Too long for a Solana address · ${value.length}` };
    }
    if (ADDRESS_PATTERNS.SOL.test(value)) {
      return { ok: true, tone: 'ok', message: 'Valid Solana wallet address.' };
    }
    return { ok: false, tone: 'warn', message: 'Address format is not a valid Solana public key.' };
  }

  if (asset === 'BTC') {
    if (!/^(bc1|[13])/.test(value)) {
      return { ok: false, tone: 'warn', message: 'Bitcoin addresses start with bc1, 1, or 3.' };
    }
    if (value.length < 26) {
      return { ok: false, tone: 'warn', message: `Address looks incomplete · ${value.length} characters` };
    }
    if (ADDRESS_PATTERNS.BTC.test(value)) {
      return { ok: true, tone: 'ok', message: 'Valid Bitcoin wallet address.' };
    }
    return { ok: false, tone: 'warn', message: 'Not a recognized Bitcoin wallet address.' };
  }

  return { ok: false, tone: 'warn', message: 'Unsupported asset.' };
}

export function formatUsd(n) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCrypto(amount, symbol) {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return `${n.toFixed(8)} ${symbol}`;
}

export function shorten(value, left = 8, right = 6) {
  if (!value) return '';
  if (value.length <= left + right + 1) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}
