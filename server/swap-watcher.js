/**
 * Isolated onetwo swap watcher. Confirms deposits and pays out with local keys.
 * Does not print private keys.
 */
require('dotenv').config();
const { createDb, schemaSql, migrateSql } = require('./db');
const { settleSwap } = require('./swap-settle');

const INTERVAL_MS = Number(process.env.SWAP_WATCH_MS || 20000);

async function migrate(db) {
  if (!db || db.driver === 'down') throw new Error(db && db.reason ? db.reason : 'store down');
  const sql = schemaSql(db.driver);
  if (sql) await db.exec(sql);
  const extras = typeof migrateSql === 'function' ? migrateSql(db.driver) : [];
  for (const stmt of extras) {
    try { await db.exec(stmt); } catch (err) {
      console.warn('[swap-watcher] migrate', err.message);
    }
  }
}

async function tick(db) {
  const result = await db.query(
    `SELECT * FROM orders WHERE COALESCE(kind, '') = 'swap' AND status IN ('pending', 'processing') ORDER BY created_at ASC LIMIT 25`
  );
  const rows = (result && result.rows) || [];
  for (const order of rows) {
    try {
      const out = await settleSwap(db, order, { allowPayout: true });
      if (out && out.payoutTx) {
        console.log('[swap-watcher] paid', order.id, 'payout_set=yes');
      } else if (out && out.confirmed && out.note) {
        console.log('[swap-watcher] deposit seen', order.id, out.note);
      } else if (out && out.confirmed) {
        console.log('[swap-watcher] confirmed', order.id);
      }
    } catch (err) {
      console.warn('[swap-watcher] order', order.id, err.message);
    }
  }
}

async function main() {
  const db = createDb();
  await migrate(db);
  console.log('[swap-watcher] driver=' + db.driver + ' interval=' + INTERVAL_MS);
  async function loop() {
    try { await tick(db); } catch (err) { console.warn('[swap-watcher]', err.message); }
  }
  await loop();
  setInterval(loop, INTERVAL_MS);
}

main().catch((err) => {
  console.error('[swap-watcher] fatal', err.message);
  process.exit(1);
});
