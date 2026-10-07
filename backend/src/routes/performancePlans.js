const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

function getEmployeeFilter(req) {
  if (req.user.role === 'Anggota') return req.user.employeeId;
  return req.query.employee_id ? parseInt(req.query.employee_id) : null;
}

// GET /api/performance-plans
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { period_id } = req.query;
  let query = `
    SELECT pp.*, e.nama as pegawai_nama, e.nip, p.nama as period_nama,
      COALESCE(SUM(da.realisasi), 0) as total_realisasi,
      COUNT(da.id) as jumlah_kegiatan
    FROM performance_plans pp
    JOIN employees e ON pp.employee_id = e.id
    JOIN periods p ON pp.period_id = p.id
    LEFT JOIN daily_activities da ON da.performance_plan_id = pp.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'Anggota') {
    query += ' AND pp.employee_id = ?';
    params.push(req.user.employeeId);
  } else if (req.query.employee_id) {
    query += ' AND pp.employee_id = ?';
    params.push(parseInt(req.query.employee_id));
  }

  if (period_id) {
    query += ' AND pp.period_id = ?';
    params.push(parseInt(period_id));
  }

  query += ' GROUP BY pp.id ORDER BY pp.kode';
  const plans = db.prepare(query).all(...params);

  // Calculate percentage for each plan
  plans.forEach(p => {
    p.persentase_capaian = p.target > 0 ? Math.min(Math.round((p.total_realisasi / p.target) * 100), 100) : 0;
  });

  res.json(plans);
});

// GET /api/performance-plans/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const plan = db.prepare(`
    SELECT pp.*, e.nama as pegawai_nama, p.nama as period_nama
    FROM performance_plans pp
    JOIN employees e ON pp.employee_id = e.id
    JOIN periods p ON pp.period_id = p.id
    WHERE pp.id = ?
  `).get(req.params.id);

  if (!plan) return res.status(404).json({ error: 'Rencana kinerja tidak ditemukan' });
  if (req.user.role === 'Anggota' && plan.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }
  res.json(plan);
});

// POST /api/performance-plans
router.post('/', authenticate, requireRole('KPA', 'Kasubbag'), (req, res) => {
  const { employee_id, period_id, kode, nama, deskripsi, indikator, target, satuan, bobot } = req.body;
  if (!employee_id || !period_id || !nama || !target || !satuan) {
    return res.status(400).json({ error: 'Field wajib tidak lengkap' });
  }
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO performance_plans (employee_id, period_id, kode, nama, deskripsi, indikator, target, satuan, bobot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(employee_id, period_id, kode || null, nama, deskripsi || null, indikator || null, target, satuan, bobot || 0);

  const plan = db.prepare('SELECT * FROM performance_plans WHERE id = ?').get(result.lastInsertRowid);
  logActivity(req.user.id, 'CREATE_PERFORMANCE_PLAN', 'performance_plans', plan.id, null, plan);
  res.status(201).json(plan);
});

// PUT /api/performance-plans/:id
router.put('/:id', authenticate, requireRole('KPA'), (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM performance_plans WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Rencana kinerja tidak ditemukan' });

  const { kode, nama, deskripsi, indikator, target, satuan, bobot, status } = req.body;
  db.prepare(`
    UPDATE performance_plans SET kode=?, nama=?, deskripsi=?, indikator=?, target=?, satuan=?, bobot=?, status=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(kode ?? old.kode, nama ?? old.nama, deskripsi ?? old.deskripsi, indikator ?? old.indikator,
    target ?? old.target, satuan ?? old.satuan, bobot ?? old.bobot, status ?? old.status, req.params.id);

  const updated = db.prepare('SELECT * FROM performance_plans WHERE id = ?').get(req.params.id);
  logActivity(req.user.id, 'UPDATE_PERFORMANCE_PLAN', 'performance_plans', parseInt(req.params.id), old, updated);
  res.json(updated);
});

// DELETE /api/performance-plans/:id
router.delete('/:id', authenticate, requireRole('KPA'), (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM performance_plans WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Rencana kinerja tidak ditemukan' });
  db.prepare('DELETE FROM performance_plans WHERE id = ?').run(req.params.id);
  logActivity(req.user.id, 'DELETE_PERFORMANCE_PLAN', 'performance_plans', parseInt(req.params.id), old, null);
  res.json({ message: 'Rencana kinerja berhasil dihapus' });
});

module.exports = router;
