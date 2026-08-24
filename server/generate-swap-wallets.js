/**
 * Isolated onetwo only. Writes deposit + payout wallets under data/wallets.
 * Prints PUBLIC addresses only. Never logs private keys.
 */
const fs = require('fs');
const path = require('path');

const DIR = process.env.SWAP_DATA_DIR || '/home/vboxuser/apps/payment-to-asset/data/wallets';

function writeSecret(file, obj) {
  const dest = path.join(DIR, file);
  if (fs.existsSync(dest)) return false;
  fs.writeFileSync(dest, JSON.stringify(obj, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(dest, 0o600);
  return true;
}

function readPublic(file) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
    return String(j.public || j.address || '');
  } catch {
    return '';
  }
}

function makeEth() {
  const { ethers } = require('ethers');
  const w = ethers.Wallet.createRandom();
  return { public: w.address, secret: w.privateKey };
}

function makeSol() {
  const nacl = require('tweetnacl');
  const bs58 = require('bs58');
  const pair = nacl.sign.keyPair();
  return {
    public: bs58.encode(Buffer.from(pair.publicKey)),
    secret: bs58.encode(Buffer.from(pair.secretKey)),
  };
}

function makeBtc() {
  const bitcoin = require('bitcoinjs-lib');
  const { ECPairFactory } = require('ecpair');
  const ecc = require('@bitcoinerlab/secp256k1');
  bitcoin.initEccLib(ecc);
  const ECPair = ECPairFactory(ecc);
  const network = bitcoin.networks.bitcoin;
  const keyPair = ECPair.makeRandom({ network });
  const pubkey = Buffer.from(keyPair.publicKey);
  const payment = bitcoin.payments.p2wpkh({ pubkey, network });
  return { public: payment.address, secret: keyPair.toWIF() };
}

function main() {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(DIR, 0o700); } catch { /* ignore */ }

  const makers = { ETH: makeEth, SOL: makeSol, BTC: makeBtc };
  const created = [];
  ['deposit', 'payout'].forEach((role) => {
    ['SOL', 'ETH', 'BTC'].forEach((asset) => {
      const file = role + '-' + asset.toLowerCase() + '.json';
      if (fs.existsSync(path.join(DIR, file))) return;
      const made = makers[asset]();
      writeSecret(file, { asset, role, public: made.public, secret: made.secret });
      created.push(file);
    });
  });

  const deposit = {
    SOL: readPublic('deposit-sol.json'),
    ETH: readPublic('deposit-eth.json'),
    BTC: readPublic('deposit-btc.json'),
  };
  const payout = {
    SOL: readPublic('payout-sol.json'),
    ETH: readPublic('payout-eth.json'),
    BTC: readPublic('payout-btc.json'),
  };
  const pubPath = path.join(DIR, 'public-addresses.json');
  fs.writeFileSync(pubPath, JSON.stringify({ deposit, payout }, null, 2) + '\n', { mode: 0o644 });

  const parentPublic = path.join(path.dirname(DIR), 'public-deposit.json');
  fs.writeFileSync(parentPublic, JSON.stringify(deposit, null, 2) + '\n', { mode: 0o644 });

  console.log('SWAP_WALLET_DIR=' + DIR);
  console.log('CREATED=' + (created.length ? created.join(',') : 'none (already present)'));
  console.log('DEPOSIT_SOL=' + deposit.SOL);
  console.log('DEPOSIT_ETH=' + deposit.ETH);
  console.log('DEPOSIT_BTC=' + deposit.BTC);
  console.log('PAYOUT_SOL=' + payout.SOL);
  console.log('PAYOUT_ETH=' + payout.ETH);
  console.log('PAYOUT_BTC=' + payout.BTC);
}

main();
