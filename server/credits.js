/**
 * Site credits: 1 credit = $1 of net USD after the 14% fee.
 * User enters $100, fee $14, balance 86 credits. No wallet at checkout.
 */
const crypto = require('crypto');

const SERVICE_FEE = 0.14;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^CTC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/i;

function creditMath(usd) {
  const gross = Number(usd);
  if (!Number.isFinite(gross) || gross <= 0) {
    return { gross: 0, feeUsd: 0, creditsAmount: 0 };
  }
  const feeUsd = Number((gross * SERVICE_FEE).toFixed(2));
  const creditsAmount = Number((gross - feeUsd).toFixed(2));
  return { gross, feeUsd, creditsAmount };
}

function generateCreditCode() {
  const bytes = crypto.randomBytes(12);
  let raw = '';
  for (let i = 0; i < 12; i++) {
    raw += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return 'CTC-' + raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12);
}

function isCreditCode(id) {
  return CODE_RE.test(String(id || '').trim());
}

function normalizeCreditCode(id) {
  const s = String(id || '').trim().toUpperCase();
  return isCreditCode(s) ? s : null;
}

function isCreditsOrder(order) {
  if (!order) return false;
  if (order.kind === 'credits') return true;
  if (String(order.asset || '').toUpperCase() === 'CREDITS') return true;
  if (order.credit_code) return true;
  return false;
}

module.exports = {
  SERVICE_FEE,
  CODE_RE,
  creditMath,
  generateCreditCode,
  isCreditCode,
  normalizeCreditCode,
  isCreditsOrder,
};
