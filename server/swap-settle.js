const { nowExpr } = require('./db');
const {
  NETWORKS,
  verifyDepositTx,
  findDepositTx,
  sendPayout,
  payoutFundingState,
} = require('./payouts');

function isSwap(order) {
  if (!order) return false;
  if (order.kind === 'swap') return true;
  return String(order.stripe_session_id || '').startsWith('swap:');
}

async function saveSwapFields(db, orderId, fields) {
  const cols = [];
  const vals = [];
  function add(column, value) {
    if (value === undefined) return;
    vals.push(value);
    cols.push(column + ' = $' + vals.length);
  }
  add('status', fields.status);
  add('deposit_tx', fields.deposit_tx);
  add('payout_tx', fields.payout_tx);
  add('payout_note', fields.payout_note);
  add('tx_hash', fields.tx_hash);
  if (!cols.length) return;
  vals.push(orderId);
  const sql = 'UPDATE orders SET ' + cols.join(', ') + ', updated_at = ' + nowExpr(db.driver) + ' WHERE id = $' + vals.length;
  try {
    await db.query(sql, vals);
    return;
  } catch (err) {
    const msg = String(err && err.message || '');
    if (!/column|unknown|no such/i.test(msg)) throw err;
    const fallback = [];
    const fvals = [];
    if (fields.status !== undefined) {
      fvals.push(fields.status);
      fallback.push('status = $' + fvals.length);
    }
    if (fields.tx_hash !== undefined) {
      fvals.push(fields.tx_hash);
      fallback.push('tx_hash = $' + fvals.length);
    }
    if (!fallback.length) return;
    fvals.push(orderId);
    await db.query(
      'UPDATE orders SET ' + fallback.join(', ') + ', updated_at = ' + nowExpr(db.driver) + ' WHERE id = $' + fvals.length,
      fvals
    );
  }
}

async function attachDepositTx(db, order, txHash) {
  const hash = String(txHash || '').trim();
  if (!hash) throw Object.assign(new Error('Transaction hash required'), { status: 400 });
  if (!isSwap(order)) throw Object.assign(new Error('Not a swap order'), { status: 400 });
  if (order.status === 'completed') {
    return { order, verified: true, alreadyComplete: true };
  }
  const existing = String(order.deposit_tx || '').trim();
  if (existing && existing !== hash) {
    throw Object.assign(new Error('This swap already has a different deposit transaction'), { status: 409 });
  }
  await saveSwapFields(db, order.id, {
    deposit_tx: hash,
    status: order.status === 'pending' ? 'processing' : order.status,
  });
  return { order, saved: true };
}

async function discoverOrVerify(order) {
  const asset = String(order.from_asset || '').toUpperCase();
  const deposit = order.deposit_address;
  const amount = order.from_amount;
  if (!asset || !deposit) {
    return { confirmed: false, reason: 'missing deposit address' };
  }
  if (order.deposit_tx) {
    return verifyDepositTx({
      asset,
      txHash: order.deposit_tx,
      depositAddress: deposit,
      expectedAmount: amount,
    });
  }
  return findDepositTx({
    asset,
    depositAddress: deposit,
    expectedAmount: amount,
    sinceMs: order.created_at ? Date.parse(order.created_at) : Date.now() - 6 * 3600 * 1000,
  });
}

async function settleSwap(db, order, opts) {
  const allowPayout = opts && opts.allowPayout;
  if (!isSwap(order)) return { order, skipped: true };
  if (order.status === 'completed' && (order.payout_tx || order.tx_hash)) {
    return { order, alreadyComplete: true };
  }
  if (order.status === 'failed') return { order, skipped: true };

  const check = await discoverOrVerify(order);
  if (check && check.txHash && !order.deposit_tx) {
    await saveSwapFields(db, order.id, {
      deposit_tx: check.txHash,
      status: 'processing',
    });
    order.deposit_tx = check.txHash;
  }

  if (!check || !check.confirmed) {
    return { order, confirmed: false, reason: check && check.reason };
  }

  if (order.status === 'pending') {
    await saveSwapFields(db, order.id, { status: 'processing' });
    order.status = 'processing';
  }

  if (!allowPayout) {
    return { order, confirmed: true, payout: 'deferred' };
  }

  if (order.payout_tx || (order.tx_hash && order.status === 'completed')) {
    return { order, confirmed: true, alreadyPaid: true };
  }

  const toAsset = order.to_asset || order.asset;
  const funding = await payoutFundingState(toAsset, order.crypto_amount);
  if (!funding.ready) {
    const note = 'deposit seen, payout wallet needs funding';
    await saveSwapFields(db, order.id, {
      status: 'processing',
      payout_note: note,
    });
    return { order, confirmed: true, funded: false, note };
  }

  try {
    const result = await sendPayout({
      asset: toAsset,
      cryptoAmount: order.crypto_amount,
      walletAddress: order.wallet_address,
    });
    if (!result || !result.txHash) throw new Error('Payout broadcast returned no hash');
    await saveSwapFields(db, order.id, {
      status: 'completed',
      payout_tx: result.txHash,
      tx_hash: result.txHash,
      payout_note: null,
    });
    return { order, confirmed: true, payoutTx: result.txHash };
  } catch (err) {
    const msg = String(err && err.message || 'payout failed');
    const needsFunding = /insufficient|no balance|UTXO|required for|hot-wallet|not configured|too small/i.test(msg);
    const note = needsFunding ? 'deposit seen, payout wallet needs funding' : msg;
    await saveSwapFields(db, order.id, {
      status: 'processing',
      payout_note: note,
    });
    return { order, confirmed: true, funded: false, note, error: msg };
  }
}

function explorerFor(asset, hash) {
  const meta = NETWORKS[asset];
  if (!meta || !hash) return null;
  return meta.explorerTx(hash);
}

module.exports = {
  isSwap,
  saveSwapFields,
  attachDepositTx,
  discoverOrVerify,
  settleSwap,
  explorerFor,
};
