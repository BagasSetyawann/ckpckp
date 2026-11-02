// Skema PostgreSQL untuk Supabase (dikonversi dari SQLite).
// Disimpan sebagai string JS agar ikut ter-bundle di Vercel Serverless Function.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  is_active INTEGER DEFAULT 1,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  nip TEXT,
  nama TEXT NOT NULL,
  jabatan TEXT,
  unit_kerja TEXT,
  golongan TEXT,
  email TEXT,
  foto TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS periods (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  tahun INTEGER NOT NULL,
  bulan INTEGER NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_akhir TEXT NOT NULL,
  batas_pengisian TEXT,
  status TEXT DEFAULT 'aktif',
  is_active INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_plans (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  period_id INTEGER NOT NULL REFERENCES periods(id),
  kode TEXT,
  nama TEXT NOT NULL,
  deskripsi TEXT,
  indikator TEXT,
  target DOUBLE PRECISION NOT NULL,
  satuan TEXT NOT NULL,
  bobot DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'aktif',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_activities (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  performance_plan_id INTEGER REFERENCES performance_plans(id) ON DELETE SET NULL,
  period_id INTEGER NOT NULL REFERENCES periods(id),
  tanggal TEXT NOT NULL,
  nama_kegiatan TEXT NOT NULL,
  deskripsi TEXT,
  target DOUBLE PRECISION,
  satuan TEXT,
  realisasi DOUBLE PRECISION,
  persentase_capaian DOUBLE PRECISION,
  status_kegiatan TEXT DEFAULT 'selesai',
  catatan TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_evidence (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES daily_activities(id) ON DELETE CASCADE,
  jenis TEXT DEFAULT 'file',
  nama_file TEXT,
  path_file TEXT,
  storage_path TEXT,
  ukuran_file INTEGER,
  mime_type TEXT,
  keterangan TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE activity_evidence ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE TABLE IF NOT EXISTS evidence_links (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES daily_activities(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT,
  keterangan TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verifications (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES daily_activities(id) ON DELETE CASCADE,
  verified_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'terverifikasi',
  catatan TEXT,
  verified_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS behavior_assessments (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  period_id INTEGER NOT NULL REFERENCES periods(id),
  assessed_by INTEGER NOT NULL,
  orientasi_pelayanan DOUBLE PRECISION DEFAULT 0,
  akuntabel DOUBLE PRECISION DEFAULT 0,
  kompeten DOUBLE PRECISION DEFAULT 0,
  harmonis DOUBLE PRECISION DEFAULT 0,
  loyal DOUBLE PRECISION DEFAULT 0,
  adaptif DOUBLE PRECISION DEFAULT 0,
  kolaboratif DOUBLE PRECISION DEFAULT 0,
  nilai_akhir DOUBLE PRECISION DEFAULT 0,
  catatan TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ckp_components (
  id SERIAL PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  deskripsi TEXT,
  is_active INTEGER DEFAULT 1,
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ckp_weights (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES periods(id),
  component_id INTEGER NOT NULL REFERENCES ckp_components(id),
  bobot DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(period_id, component_id)
);

CREATE TABLE IF NOT EXISTS monthly_pk_scores (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  performance_plan_id INTEGER NOT NULL,
  target DOUBLE PRECISION,
  realisasi DOUBLE PRECISION,
  persentase_capaian DOUBLE PRECISION,
  nilai_pk DOUBLE PRECISION,
  catatan TEXT,
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, period_id, performance_plan_id)
);

CREATE TABLE IF NOT EXISTS monthly_ckp_scores (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  nilai_pk DOUBLE PRECISION DEFAULT 0,
  nilai_perilaku DOUBLE PRECISION DEFAULT 0,
  nilai_ckp DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'draft',
  catatan TEXT,
  calculated_at TIMESTAMP DEFAULT NOW(),
  finalized_at TIMESTAMP,
  UNIQUE(employee_id, period_id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  judul TEXT NOT NULL,
  pesan TEXT NOT NULL,
  jenis TEXT DEFAULT 'info',
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  old_data TEXT,
  new_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_emp_tanggal ON daily_activities(employee_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_activities_period ON daily_activities(period_id);
CREATE INDEX IF NOT EXISTS idx_evidence_activity ON activity_evidence(activity_id);
CREATE INDEX IF NOT EXISTS idx_links_activity ON evidence_links(activity_id);
CREATE INDEX IF NOT EXISTS idx_verif_activity ON verifications(activity_id);
`;

module.exports = { SCHEMA_SQL };
