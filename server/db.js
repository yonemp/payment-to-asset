const path = require('path');

const STORE_TIMEOUT_MS = 8000;

function envUrl() {
  return (process.env.DATABASE_URL || '').trim();
}

function driverOf(url) {
  if (!url) return 'sqlite';
  if (/^postgres(ql)?:\/\//i.test(url)) return 'pg';
  if (/^https?:\/\//i.test(url)) return 'http';
  return 'sqlite';
}

function storeError(message) {
  const err = new Error(message || 'store unavailable');
  err.code = 'STORE_DOWN';
  return err;
}

class DownAdapter {
  constructor(reason) {
    this.driver = 'down';
    this.reason = reason || 'store unavailable';
  }

  async exec() {
    throw storeError(this.reason);
  }

  async query() {
    throw storeError(this.reason);
  }

  async get() {
    throw storeError(this.reason);
  }
}

class SqliteAdapter {
  constructor() {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (err) {
      throw new Error('sqlite unavailable: ' + err.message);
    }
    const dbPath =
      process.env.DATABASE_PATH ||
      (process.env.VERCEL ? path.join('/tmp', 'orders.db') : path.join(__dirname, 'orders.db'));
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.driver = 'sqlite';
  }

  _sql(text) {
    return String(text).replace(/\$[0-9]+/g, '?');
  }

  async exec(sql) {
    this.db.exec(sql);
  }

  async query(text, values = []) {
    const stmt = this.db.prepare(this._sql(text));
    const isSelect = /^\s*select/i.test(text);
    if (isSelect) {
      const rows = stmt.all(...values);
      return { rows, rowCount: rows.length };
    }
    const info = stmt.run(...values);
    return { rows: [], rowCount: info.changes || 0 };
  }

  async get(text, values = []) {
    const stmt = this.db.prepare(this._sql(text));
    return stmt.get(...values) || null;
  }
}

class PgAdapter {
  constructor(url) {
    const { Pool } = require('pg');
    this.pool = new Pool({ connectionString: url, max: 4 });
    this.driver = 'pg';
  }

  async exec(sql) {
    await this.pool.query(sql);
  }

  async query(text, values = []) {
    const result = await this.pool.query(text, values);
    return { rows: result.rows || [], rowCount: result.rowCount || 0 };
  }

  async get(text, values = []) {
    const result = await this.pool.query(text, values);
    return result.rows[0] || null;
  }
}

class HttpAdapter {
  constructor(url, token) {
    this.url = String(url || '').replace(/\/$/, '');
    this.token = token || '';
    this.driver = 'http';
  }

  async exec(sql) {
    await this.query(sql, []);
  }

  async query(text, values = []) {
    if (!this.token) {
      throw storeError('DATABASE_TOKEN required for https DATABASE_URL');
    }
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, STORE_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(this.url + '/sql', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text, values: values }),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
      const code = aborted
        ? 'ETIMEDOUT'
        : (err.cause && err.cause.code ? err.cause.code : err.message);
      throw storeError('store unreachable: ' + code);
    } finally {
      clearTimeout(timer);
    }
    const body = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw storeError(body.error || ('store http ' + res.status));
    }
    return { rows: body.rows || [], rowCount: Number(body.rowCount || 0) };
  }

  async get(text, values = []) {
    const result = await this.query(text, values);
    return result.rows[0] || null;
  }
}

function createDb() {
  try {
    const url = envUrl();
    const driver = driverOf(url);
    if (driver === 'pg') return new PgAdapter(url);
    if (driver === 'http') return new HttpAdapter(url, process.env.DATABASE_TOKEN);
    if (process.env.VERCEL) {
      return new DownAdapter('sqlite is not available on Vercel; set DATABASE_URL');
    }
    return new SqliteAdapter();
  } catch (err) {
    console.warn('[db] createDb failed:', err.message);
    return new DownAdapter(err.message);
  }
}

function schemaSql(driver) {
  if (driver === 'down') return '';
  if (driver === 'sqlite') {
    return [
      'CREATE TABLE IF NOT EXISTS orders (',
      '  id TEXT PRIMARY KEY,',
      '  asset TEXT NOT NULL,',
      '  fiat_amount REAL NOT NULL,',
      '  crypto_amount REAL,',
      '  wallet_address TEXT NOT NULL,',
      '  status TEXT NOT NULL DEFAULT \'pending\',',
      '  stripe_session_id TEXT,',
      '  tx_hash TEXT,',
      '  kind TEXT NOT NULL DEFAULT \'buy\',',
      '  from_asset TEXT,',
      '  to_asset TEXT,',
      '  from_amount REAL,',
      '  deposit_address TEXT,',
      '  deposit_tx TEXT,',
      '  payout_tx TEXT,',
      '  payout_note TEXT,',
      '  telegram_notified_at TEXT,',
      '  created_at TEXT NOT NULL DEFAULT (datetime(\'now\')),',
      '  updated_at TEXT NOT NULL DEFAULT (datetime(\'now\'))',
      ');',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);',
      'CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);',
    ].join('\n');
  }
  return [
    'CREATE TABLE IF NOT EXISTS orders (',
    '  id TEXT PRIMARY KEY,',
    '  asset TEXT NOT NULL,',
    '  fiat_amount DOUBLE PRECISION NOT NULL,',
    '  crypto_amount DOUBLE PRECISION,',
    '  wallet_address TEXT NOT NULL,',
    '  status TEXT NOT NULL DEFAULT \'pending\',',
    '  stripe_session_id TEXT,',
    '  tx_hash TEXT,',
    '  kind TEXT NOT NULL DEFAULT \'buy\',',
    '  from_asset TEXT,',
    '  to_asset TEXT,',
    '  from_amount DOUBLE PRECISION,',
    '  deposit_address TEXT,',
    '  telegram_notified_at TIMESTAMPTZ,',
    '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
    '  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);',
    'CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);',
  ].join('\n');
}

function migrateSql(driver) {
  if (driver === 'down') return [];
  if (driver === 'sqlite') {
    return [
      'ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT',
      "ALTER TABLE orders ADD COLUMN kind TEXT DEFAULT 'buy'",
      'ALTER TABLE orders ADD COLUMN from_asset TEXT',
      'ALTER TABLE orders ADD COLUMN to_asset TEXT',
      'ALTER TABLE orders ADD COLUMN from_amount REAL',
      'ALTER TABLE orders ADD COLUMN deposit_address TEXT',
      'ALTER TABLE orders ADD COLUMN deposit_tx TEXT',
      'ALTER TABLE orders ADD COLUMN payout_tx TEXT',
      'ALTER TABLE orders ADD COLUMN payout_note TEXT',
      'ALTER TABLE orders ADD COLUMN telegram_notified_at TEXT',
    ];
  }
  return [
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT',
    'CREATE INDEX IF NOT EXISTS idx_orders_pi ON orders(stripe_payment_intent_id)',
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'buy'",
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS from_asset TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_asset TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS from_amount DOUBLE PRECISION',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_address TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_tx TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payout_tx TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payout_note TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS telegram_notified_at TIMESTAMPTZ',
  ];
}

function nowExpr(driver) {
  return driver === 'sqlite' ? "datetime('now')" : 'NOW()';
}

module.exports = { createDb, schemaSql, nowExpr, migrateSql, driverOf, envUrl, DownAdapter, storeError };
