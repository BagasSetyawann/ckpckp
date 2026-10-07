const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/si_ckp.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

let _db = null;
let _rawDb = null;
let _SQL = null;

// Save DB to disk every 5 seconds if dirty
let _dirty = false;
setInterval(() => {
  if (_dirty && _db) {
    try {
      const data = _db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
      _dirty = false;
    } catch (e) { /* ignore */ }
  }
}, 5000);

function saveDb() {
  if (_rawDb) {
    try {
      const data = _rawDb.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
      _dirty = false;
    } catch (e) { console.error('Save error:', e.message); }
  }
}

// Wrapper to make sql.js look like better-sqlite3 API
function createDbWrapper(sqlJsDb) {
  function prepare(sql) {
    return {
      get(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = sqlJsDb.prepare(sql);
        stmt.bind(flatParams.map(p => p === undefined ? null : p));
        const cols = stmt.getColumnNames();
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = sqlJsDb.prepare(sql);
        stmt.bind(flatParams.map(p => p === undefined ? null : p));
        const results = [];
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
      },
      run(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        sqlJsDb.run(sql, flatParams.map(p => p === undefined ? null : p));
        _dirty = true;
        return { lastInsertRowid: sqlJsDb.exec('SELECT last_insert_rowid()')[0]?.values[0][0] };
      },
    };
  }

  function exec(sql) {
    sqlJsDb.run(sql);
    _dirty = true;
  }

  function transaction(fn) {
    return (...args) => {
      sqlJsDb.run('BEGIN');
      try {
        fn(...args);
        sqlJsDb.run('COMMIT');
        _dirty = true;
      } catch (e) {
        sqlJsDb.run('ROLLBACK');
        throw e;
      }
    };
  }

  function pragma(str) {
    try { sqlJsDb.run(`PRAGMA ${str}`); } catch {}
  }

  return { prepare, exec, transaction, pragma };
}

async function initDatabase() {
  if (_db) return _db;

  _SQL = await initSqlJs();

  let sqlJsDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new _SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new _SQL.Database();
  }

  sqlJsDb.run('PRAGMA foreign_keys = ON');
  sqlJsDb.run('PRAGMA journal_mode = MEMORY');

  _rawDb = sqlJsDb;
  _db = createDbWrapper(sqlJsDb);

  // Create schema
  _db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      nip TEXT,
      nama TEXT NOT NULL,
      jabatan TEXT,
      unit_kerja TEXT,
      golongan TEXT,
      email TEXT,
      foto TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      tahun INTEGER NOT NULL,
      bulan INTEGER NOT NULL,
      tanggal_mulai TEXT NOT NULL,
      tanggal_akhir TEXT NOT NULL,
      batas_pengisian TEXT,
      status TEXT DEFAULT 'aktif',
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS performance_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      period_id INTEGER NOT NULL,
      kode TEXT,
      nama TEXT NOT NULL,
      deskripsi TEXT,
      indikator TEXT,
      target REAL NOT NULL,
      satuan TEXT NOT NULL,
      bobot REAL DEFAULT 0,
      status TEXT DEFAULT 'aktif',
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (period_id) REFERENCES periods(id)
    );

    CREATE TABLE IF NOT EXISTS daily_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      performance_plan_id INTEGER,
      period_id INTEGER NOT NULL,
      tanggal TEXT NOT NULL,
      nama_kegiatan TEXT NOT NULL,
      deskripsi TEXT,
      target REAL,
      satuan TEXT,
      realisasi REAL,
      persentase_capaian REAL,
      status_kegiatan TEXT DEFAULT 'selesai',
      catatan TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (performance_plan_id) REFERENCES performance_plans(id),
      FOREIGN KEY (period_id) REFERENCES periods(id)
    );

    CREATE TABLE IF NOT EXISTS activity_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      jenis TEXT DEFAULT 'file',
      nama_file TEXT,
      path_file TEXT,
      ukuran_file INTEGER,
      mime_type TEXT,
      keterangan TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (activity_id) REFERENCES daily_activities(id)
    );

    CREATE TABLE IF NOT EXISTS evidence_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      judul TEXT NOT NULL,
      url TEXT NOT NULL,
      platform TEXT,
      keterangan TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (activity_id) REFERENCES daily_activities(id)
    );

    CREATE TABLE IF NOT EXISTS verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      verified_by INTEGER NOT NULL,
      status TEXT DEFAULT 'terverifikasi',
      catatan TEXT,
      verified_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (activity_id) REFERENCES daily_activities(id),
      FOREIGN KEY (verified_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS behavior_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      period_id INTEGER NOT NULL,
      assessed_by INTEGER NOT NULL,
      orientasi_pelayanan REAL DEFAULT 0,
      akuntabel REAL DEFAULT 0,
      kompeten REAL DEFAULT 0,
      harmonis REAL DEFAULT 0,
      loyal REAL DEFAULT 0,
      adaptif REAL DEFAULT 0,
      kolaboratif REAL DEFAULT 0,
      nilai_akhir REAL DEFAULT 0,
      catatan TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (period_id) REFERENCES periods(id)
    );

    CREATE TABLE IF NOT EXISTS ckp_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      deskripsi TEXT,
      is_active INTEGER DEFAULT 1,
      urutan INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ckp_weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      component_id INTEGER NOT NULL,
      bobot REAL NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(period_id, component_id),
      FOREIGN KEY (period_id) REFERENCES periods(id),
      FOREIGN KEY (component_id) REFERENCES ckp_components(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_pk_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      period_id INTEGER NOT NULL,
      performance_plan_id INTEGER NOT NULL,
      target REAL,
      realisasi REAL,
      persentase_capaian REAL,
      nilai_pk REAL,
      catatan TEXT,
      calculated_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(employee_id, period_id, performance_plan_id)
    );

    CREATE TABLE IF NOT EXISTS monthly_ckp_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      period_id INTEGER NOT NULL,
      nilai_pk REAL DEFAULT 0,
      nilai_perilaku REAL DEFAULT 0,
      nilai_ckp REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      catatan TEXT,
      calculated_at DATETIME DEFAULT (datetime('now')),
      finalized_at DATETIME,
      UNIQUE(employee_id, period_id)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      judul TEXT NOT NULL,
      pesan TEXT NOT NULL,
      jenis TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      old_data TEXT,
      new_data TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  saveDb();
  console.log('✅ Database initialized (sql.js / WebAssembly SQLite)');

  // Seed if needed
  const roleCount = _db.prepare('SELECT COUNT(*) as count FROM roles').get();
  if (roleCount && roleCount.count === 0) {
    const seed = require('./seed');
    seed.seedInitialData(_db);
    saveDb();
  }

  return _db;
}

function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

// Graceful shutdown - save DB
process.on('SIGINT', () => { saveDb(); process.exit(0); });
process.on('SIGTERM', () => { saveDb(); process.exit(0); });

module.exports = { getDb, initDatabase, saveDb };
