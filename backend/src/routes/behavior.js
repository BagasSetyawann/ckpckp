const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// GET /api/behavior
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { period_id, employee_id } = req.query;

  let query = `
    SELECT ba.*, e.nama as pegawai_nama, p.nama as period_nama, u.username as assessed_by_name
    FROM behavior_assessments ba
    JOIN employees e ON ba.employee_id = e.id
    JOIN periods p ON ba.period_id = p.id
    LEFT JOIN users u ON ba.assessed_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'Anggota') {
    query += ' AND ba.employee_id = ?';
    params.push(req.user.employeeId);
  } else if (employee_id) {
    query += ' AND ba.employee_id = ?';
    params.push(parseInt(employee_id));
  }

  if (period_id) { query += ' AND ba.period_id = ?'; params.push(parseInt(period_id)); }
  query += ' ORDER BY ba.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// POST /api/behavior — KPA only
router.post('/', authenticate, requireRole('KPA'), (req, res) => {
  const db = getDb();
  const { employee_id, period_id, orientasi_pelayanan, akuntabel, kompeten, harmonis, loyal, adaptif, kolaboratif, catatan } = req.body;

  if (!employee_id || !period_id) {
    return res.status(400).json({ error: 'Employee dan periode wajib dipilih' });
  }

  const scores = [orientasi_pelayanan, akuntabel, kompeten, harmonis, loyal, adaptif, kolaboratif].map(s => parseFloat(s) || 0);
  const nilai_akhir = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

  const existing = db.prepare('SELECT id FROM behavior_assessments WHERE employee_id = ? AND period_id = ?').get(employee_id, period_id);

  if (existing) {
    db.prepare(`
      UPDATE behavior_assessments SET
        orientasi_pelayanan=?, akuntabel=?, kompeten=?, harmonis=?, loyal=?, adaptif=?, kolaboratif=?,
        nilai_akhir=?, catatan=?, assessed_by=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(...scores, nilai_akhir, catatan || null, req.user.id, existing.id);

    const updated = db.prepare('SELECT * FROM behavior_assessments WHERE id = ?').get(existing.id);
    logActivity(req.user.id, 'UPDATE_BEHAVIOR', 'behavior_assessments', existing.id, null, updated);
    return res.json(updated);
  }

  const result = db.prepare(`
    INSERT INTO behavior_assessments
    (employee_id, period_id, assessed_by, orientasi_pelayanan, akuntabel, kompeten, harmonis, loyal, adaptif, kolaboratif, nilai_akhir, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(employee_id, period_id, req.user.id, ...scores, nilai_akhir, catatan || null);

  const assessment = db.prepare('SELECT * FROM behavior_assessments WHERE id = ?').get(result.lastInsertRowid);
  logActivity(req.user.id, 'CREATE_BEHAVIOR', 'behavior_assessments', assessment.id, null, assessment);
  res.status(201).json(assessment);
});

// PUT /api/behavior/:id
router.put('/:id', authenticate, requireRole('KPA'), (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM behavior_assessments WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Penilaian perilaku tidak ditemukan' });

  const { orientasi_pelayanan, akuntabel, kompeten, harmonis, loyal, adaptif, kolaboratif, catatan } = req.body;
  const scores = [orientasi_pelayanan, akuntabel, kompeten, harmonis, loyal, adaptif, kolaboratif].map(s => parseFloat(s) || 0);
  const nilai_akhir = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

  db.prepare(`
    UPDATE behavior_assessments SET
      orientasi_pelayanan=?, akuntabel=?, kompeten=?, harmonis=?, loyal=?, adaptif=?, kolaboratif=?,
      nilai_akhir=?, catatan=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(...scores, nilai_akhir, catatan || null, req.params.id);

  const updated = db.prepare('SELECT * FROM behavior_assessments WHERE id = ?').get(req.params.id);
  logActivity(req.user.id, 'UPDATE_BEHAVIOR', 'behavior_assessments', parseInt(req.params.id), old, updated);
  res.json(updated);
});

module.exports = router;
