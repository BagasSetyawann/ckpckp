const { Pool, types } = require('pg');
const { SCHEMA_SQL } = require('./schema');

// Kembalikan angka sebagai number (bukan string) agar perilaku sama seperti SQLite
types.setTypeParser(20, v => parseInt(v, 10));   // int8 / BIGINT (hasil COUNT, SUM integer)
types.setTypeParser(1700, v => parseFloat(v));   // NUMERIC
// Kembalikan TIMESTAMP sebagai string "YYYY-MM-DD HH:MM:SS" seperti SQLite
types.setTypeParser(1114, v => v);

let _pool = null;
let _db = null;
let _initPromise = null;

function getPool() {
  if (_pool) return _pool;
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL belum diset. Isi dengan connection string database Supabase.');
  }
  // Hapus sslmode dari URL agar opsi ssl di bawah yang dipakai (hindari error self-signed cert)
  try {
    const u = new URL(connectionString);
    u.searchParams.delete('sslmode');
    connectionString = u.toString();
  } catch { /* biarkan apa adanya */ }

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  _pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: parseInt(process.env.PG_POOL_MAX || '3', 10),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
  });
  _pool.on('error', err => console.error('PG pool error:', err.message));
  return _pool;
}

// Konversi SQL gaya SQLite ke PostgreSQL:
//  - placeholder ? -> $1, $2, ...
//  - INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
//  - INSERT otomatis ditambah RETURNING id (pengganti lastInsertRowid)
function convertSql(sql) {
  let s = sql.trim().replace(/;\s*$/, '');
  let orIgnore = false;
  if (/^INSERT\s+OR\s+IGNORE\s+INTO/i.test(s)) {
    s = s.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    orIgnore = true;
  }
  let i = 0;
  s = s.replace(/\?/g, () => `$${++i}`);
  if (orIgnore) s += ' ON CONFLICT DO NOTHING';
  if (/^INSERT\s/i.test(s) && !/\bRETURNING\b/i.test(s)) s += ' RETURNING id';
  return s;
}

function normalizeParam(p) {
  if (p === undefined || p === '') return null;
  if (typeof p === 'number' && Number.isNaN(p)) return null;
  if (typeof p === 'boolean') return p ? 1 : 0;
  return p;
}

function flatten(params) {
  const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  return flat.map(normalizeParam);
}

function createDbWrapper(pool) {
  function prepare(sql) {
    const pgSql = convertSql(sql);
    return {
      async get(...params) {
        const r = await pool.query(pgSql, flatten(params));
        return r.rows[0];
      },
      async all(...params) {
        const r = await pool.query(pgSql, flatten(params));
        return r.rows;
      },
      async run(...params) {
        const r = await pool.query(pgSql, flatten(params));
        return { lastInsertRowid: r.rows[0]?.id, changes: r.rowCount };
      },
    };
  }

  async function exec(sql) {
    await pool.query(sql);
  }

  async function query(sql, params = []) {
    return pool.query(sql, params);
  }

  return { prepare, exec, query };
}

function getDb() {
  if (!_db) _db = createDbWrapper(getPool());
  return _db;
}

// Membuat tabel (jika belum ada) dan seed data awal. Aman dipanggil berulang kali.
async function initDatabase() {
  if (!_initPromise) {
    _initPromise = (async () => {
      const db = getDb();
      await db.exec(SCHEMA_SQL);
      const roleCount = await db.prepare('SELECT COUNT(*) as count FROM roles').get();
      if (!roleCount || roleCount.count === 0) {
        const seed = require('./seed');
        await seed.seedInitialData(db);
      }
      console.log('✅ Database siap (PostgreSQL / Supabase)');
      return db;
    })().catch(err => {
      _initPromise = null;
      throw err;
    });
  }
  return _initPromise;
}

async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
    _initPromise = null;
  }
}

// saveDb dipertahankan agar kompatibel dengan kode lama (PostgreSQL menyimpan otomatis)
function saveDb() {}

module.exports = { getDb, initDatabase, closeDb, saveDb };
