const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// GET /api/activities
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { period_id, employee_id, tanggal, tanggal_mulai, tanggal_akhir } = req.query;

  let query = `
    SELECT da.*,
      e.nama as pegawai_nama, e.nip,
      pp.nama as pk_nama, pp.kode as pk_kode, pp.satuan as pk_satuan,
      p.nama as period_nama,
      v.status as verif_status, v.catatan as verif_catatan, v.verified_at,
      u_verif.username as verified_by_name,
      (SELECT COUNT(*) FROM activity_evidence ae WHERE ae.activity_id = da.id) as jumlah_bukti,
      (SELECT COUNT(*) FROM evidence_links el WHERE el.activity_id = da.id) as jumlah_link
    FROM daily_activities da
    JOIN employees e ON da.employee_id = e.id
    JOIN periods p ON da.period_id = p.id
    LEFT JOIN performance_plans pp ON da.performance_plan_id = pp.id
    LEFT JOIN verifications v ON v.activity_id = da.id
    LEFT JOIN users u_verif ON v.verified_by = u_verif.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'Anggota') {
    query += ' AND da.employee_id = ?';
    params.push(req.user.employeeId);
  } else if (employee_id) {
    query += ' AND da.employee_id = ?';
    params.push(parseInt(employee_id));
  }

  if (period_id) { query += ' AND da.period_id = ?'; params.push(parseInt(period_id)); }
  if (tanggal) { query += ' AND da.tanggal = ?'; params.push(tanggal); }
  if (tanggal_mulai) { query += ' AND da.tanggal >= ?'; params.push(tanggal_mulai); }
  if (tanggal_akhir) { query += ' AND da.tanggal <= ?'; params.push(tanggal_akhir); }

  query += ' ORDER BY da.tanggal DESC, da.created_at DESC';
  const activities = db.prepare(query).all(...params);
  res.json(activities);
});

// GET /api/activities/calendar - Calendar view by month
router.get('/calendar', authenticate, (req, res) => {
  const db = getDb();
  const { period_id, employee_id, year, month } = req.query;

  const empId = req.user.role === 'Anggota' ? req.user.employeeId : (employee_id ? parseInt(employee_id) : null);

  let query = `
    SELECT da.tanggal,
      COUNT(da.id) as jumlah_kegiatan,
      AVG(da.persentase_capaian) as avg_capaian,
      SUM(CASE WHEN ae.id IS NOT NULL OR el.id IS NOT NULL THEN 1 ELSE 0 END) as has_bukti,
      MAX(CASE WHEN v.status = 'terverifikasi' THEN 1 ELSE 0 END) as terverifikasi
    FROM daily_activities da
    LEFT JOIN activity_evidence ae ON ae.activity_id = da.id
    LEFT JOIN evidence_links el ON el.activity_id = da.id
    LEFT JOIN verifications v ON v.activity_id = da.id
    WHERE 1=1
  `;
  const params = [];

  if (empId) { query += ' AND da.employee_id = ?'; params.push(empId); }
  if (period_id) { query += ' AND da.period_id = ?'; params.push(parseInt(period_id)); }
  if (year && month) {
    query += ` AND strftime('%Y', da.tanggal) = ? AND strftime('%m', da.tanggal) = ?`;
    params.push(year, month.toString().padStart(2, '0'));
  }

  query += ' GROUP BY da.tanggal ORDER BY da.tanggal';
  const calendar = db.prepare(query).all(...params);
  res.json(calendar);
});

// GET /api/activities/daily-status - Status of all employees for a date
router.get('/daily-status', authenticate, requireRole('KPA', 'Kasubbag'), (req, res) => {
  const db = getDb();
  const { tanggal } = req.query;
  const date = tanggal || new Date().toISOString().split('T')[0];

  const employees = db.prepare(`
    SELECT e.id, e.nama, e.jabatan, e.unit_kerja, u.username
    FROM employees e JOIN users u ON e.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'Anggota' AND u.is_active = 1
    ORDER BY e.nama
  `).all();

  const result = employees.map(emp => {
    const activities = db.prepare(`
      SELECT COUNT(*) as count, AVG(persentase_capaian) as avg_capaian
      FROM daily_activities WHERE employee_id = ? AND tanggal = ?
    `).get(emp.id, date);

    const bukti = db.prepare(`
      SELECT COUNT(*) as count FROM activity_evidence ae
      JOIN daily_activities da ON ae.activity_id = da.id
      WHERE da.employee_id = ? AND da.tanggal = ?
    `).get(emp.id, date);

    return {
      ...emp,
      jumlah_kegiatan: activities.count,
      avg_capaian: Math.round(activities.avg_capaian || 0),
      has_bukti: bukti.count > 0,
      status: activities.count === 0 ? 'belum' : (activities.avg_capaian >= 80 ? 'lengkap' : 'sebagian')
    };
  });

  res.json({ tanggal: date, employees: result });
});

// GET /api/activities/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const activity = db.prepare(`
    SELECT da.*, e.nama as pegawai_nama, pp.nama as pk_nama, pp.kode as pk_kode,
      v.status as verif_status, v.catatan as verif_catatan, v.verified_at,
      u_v.username as verified_by_name
    FROM daily_activities da
    JOIN employees e ON da.employee_id = e.id
    LEFT JOIN performance_plans pp ON da.performance_plan_id = pp.id
    LEFT JOIN verifications v ON v.activity_id = da.id
    LEFT JOIN users u_v ON v.verified_by = u_v.id
    WHERE da.id = ?
  `).get(req.params.id);

  if (!activity) return res.status(404).json({ error: 'Kegiatan tidak ditemukan' });
  if (req.user.role === 'Anggota' && activity.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  const evidence = db.prepare('SELECT * FROM activity_evidence WHERE activity_id = ?').all(req.params.id);
  const links = db.prepare('SELECT * FROM evidence_links WHERE activity_id = ?').all(req.params.id);

  res.json({ ...activity, evidence, links });
});

// POST /api/activities
router.post('/', authenticate, (req, res) => {
  const db = getDb();
  const { performance_plan_id, period_id, tanggal, nama_kegiatan, deskripsi, target, satuan, realisasi, status_kegiatan, catatan } = req.body;

  if (!period_id || !tanggal || !nama_kegiatan) {
    return res.status(400).json({ error: 'Field wajib tidak lengkap' });
  }

  const empId = req.user.role === 'Anggota' ? req.user.employeeId : req.body.employee_id;
  if (!empId) return res.status(400).json({ error: 'Employee ID diperlukan' });

  const persentase = (target && realisasi) ? Math.min(Math.round((realisasi / target) * 100), 100) : 0;

  const result = db.prepare(`
    INSERT INTO daily_activities
    (employee_id, performance_plan_id, period_id, tanggal, nama_kegiatan, deskripsi, target, satuan, realisasi, persentase_capaian, status_kegiatan, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(empId, performance_plan_id || null, period_id, tanggal, nama_kegiatan, deskripsi || null,
    target || null, satuan || null, realisasi || null, persentase, status_kegiatan || 'selesai', catatan || null);

  const activity = db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(result.lastInsertRowid);
  logActivity(req.user.id, 'CREATE_ACTIVITY', 'daily_activities', activity.id, null, activity);
  res.status(201).json(activity);
});

// PUT /api/activities/:id
router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Kegiatan tidak ditemukan' });
  if (req.user.role === 'Anggota' && old.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  const { performance_plan_id, nama_kegiatan, deskripsi, target, satuan, realisasi, status_kegiatan, catatan } = req.body;
  const t = target ?? old.target;
  const r = realisasi ?? old.realisasi;
  const persentase = (t && r) ? Math.min(Math.round((r / t) * 100), 100) : old.persentase_capaian;

  db.prepare(`
    UPDATE daily_activities
    SET performance_plan_id=?, nama_kegiatan=?, deskripsi=?, target=?, satuan=?, realisasi=?,
        persentase_capaian=?, status_kegiatan=?, catatan=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(performance_plan_id ?? old.performance_plan_id, nama_kegiatan ?? old.nama_kegiatan,
    deskripsi ?? old.deskripsi, t, satuan ?? old.satuan, r, persentase,
    status_kegiatan ?? old.status_kegiatan, catatan ?? old.catatan, req.params.id);

  const updated = db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(req.params.id);
  logActivity(req.user.id, 'UPDATE_ACTIVITY', 'daily_activities', parseInt(req.params.id), old, updated);
  res.json(updated);
});

// DELETE /api/activities/:id
router.delete('/:id', authenticate, (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Kegiatan tidak ditemukan' });
  if (req.user.role === 'Anggota' && old.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }
  if (req.user.role === 'Kasubbag') return res.status(403).json({ error: 'Kasubbag tidak dapat menghapus kegiatan' });
  db.prepare('DELETE FROM daily_activities WHERE id = ?').run(req.params.id);
  logActivity(req.user.id, 'DELETE_ACTIVITY', 'daily_activities', parseInt(req.params.id), old, null);
  res.json({ message: 'Kegiatan berhasil dihapus' });
});

module.exports = router;
