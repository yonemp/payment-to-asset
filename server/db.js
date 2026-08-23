const path = require('path');

function envUrl() {
  return (process.env.DATABASE_URL || '').trim();
}

function driverOf(url) {
  if (!url) return 'sqlite';
  if (/^postgres(ql)?:\/\//i.test(url)) return 'pg';
  if (/^https?:\/\//i.test(url)) return 'http';
  return 'sqlite';
}

class SqliteAdapter {
  constructor() {
    const Database = require('better-sqlite3');
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
    this.url = url.replace(/\/$/, '');
    this.token = token || '';
    this.driver = 'http';
    if (!this.token) {
      throw new Error('DATABASE_TOKEN required for https DATABASE_URL');
    }
  }

  async exec(sql) {
    await this.query(sql, []);
  }

  async query(text, values = []) {
    const res = await fetch(this.url + '/sql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text, values: values }),
    });
    const body = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(body.error || ('store http ' + res.status));
    }
    return { rows: body.rows || [], rowCount: Number(body.rowCount || 0) };
  }

  async get(text, values = []) {
    const result = await this.query(text, values);
    return result.rows[0] || null;
  }
}

function createDb() {
  const url = envUrl();
  const driver = driverOf(url);
  if (driver === 'pg') return new PgAdapter(url);
  if (driver === 'http') return new HttpAdapter(url, process.env.DATABASE_TOKEN);
  return new SqliteAdapter();
}

function schemaSql(driver) {
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
    '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
    '  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);',
    'CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);',
  ].join('\n');
}

function nowExpr(driver) {
  return driver === 'sqlite' ? "datetime('now')" : 'NOW()';
}

module.exports = { createDb, schemaSql, nowExpr, driverOf, envUrl };
