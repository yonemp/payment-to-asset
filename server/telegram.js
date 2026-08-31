/**
 * Telegram payment alerts. Fail open: never throw to callers.
 * Token and chat id come from env. Do not log them.
 */
function configured() {
  return Boolean(
    String(process.env.TELEGRAM_BOT_TOKEN || '').trim() &&
    String(process.env.TELEGRAM_CHAT_ID || '').trim()
  );
}

function isSwapLike(order) {
  if (!order) return true;
  if (order.kind === 'swap') return true;
  return String(order.stripe_session_id || '').startsWith('swap:');
}

function truncateWallet(address) {
  const s = String(address || '').trim();
  if (!s) return '(none)';
  if (s.length <= 12) return s;
  return s.slice(0, 6) + '\u2026\u2026' + s.slice(-4);
}

function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$?';
  return '$' + n.toFixed(2);
}

function paidMessage(order) {
  const asset = String((order && (order.asset || order.to_asset)) || 'ASSET').toUpperCase();
  return [
    'Card to Crypto \u2014 payment succeeded',
    formatUsd(order && order.fiat_amount) + ' \u2192 ' + asset,
    'Order: ' + (order && order.id ? order.id : '(unknown)'),
    'Wallet: ' + truncateWallet(order && order.wallet_address),
  ].join('\n');
}

async function sendMessage(text) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) {
    return { ok: false, skipped: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 5000);
  try {
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(function () { return {}; });
    if (!res.ok || !body.ok) {
      const err = new Error('telegram http ' + res.status);
      err.status = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function claimNotify(db, orderId, nowSql) {
  const result = await db.query(
    'UPDATE orders SET telegram_notified_at = ' + nowSql + ', updated_at = ' + nowSql +
      ' WHERE id = $1 AND telegram_notified_at IS NULL',
    [orderId]
  );
  return Number(result && result.rowCount ? result.rowCount : 0) > 0;
}

async function releaseNotify(db, orderId, nowSql) {
  await db.query(
    'UPDATE orders SET telegram_notified_at = NULL, updated_at = ' + nowSql + ' WHERE id = $1',
    [orderId]
  );
}

async function notifyPaidOrder(db, order, nowSql) {
  if (!order || !order.id || isSwapLike(order)) {
    return { sent: false, skipped: 'not-card' };
  }
  if (!configured()) {
    return { sent: false, skipped: 'unconfigured' };
  }
  if (order.telegram_notified_at) {
    return { sent: false, skipped: 'already' };
  }

  let claimed = false;
  let claimFailed = false;
  try {
    claimed = await claimNotify(db, order.id, nowSql);
    if (!claimed) {
      return { sent: false, skipped: 'already' };
    }
  } catch (err) {
    claimFailed = true;
    console.warn('[telegram] dedup claim failed:', err.message);
  }

  try {
    await sendMessage(paidMessage(order));
    console.log('[telegram] notified paid order ' + order.id);
    return { sent: true };
  } catch (err) {
    console.warn('[telegram] send failed:', err.message);
    if (claimed && !claimFailed) {
      try {
        await releaseNotify(db, order.id, nowSql);
      } catch (releaseErr) {
        console.warn('[telegram] release failed:', releaseErr.message);
      }
    }
    return { sent: false, error: err.message };
  }
}

module.exports = {
  configured,
  isSwapLike,
  paidMessage,
  sendMessage,
  notifyPaidOrder,
};
