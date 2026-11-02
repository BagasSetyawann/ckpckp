const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// GET /api/verifications
router.get('/', authenticate, requireRole('KPA', 'Kasubbag'), async (req, res) => {
  const db = getDb();
  const { period_id, employee_id, status } = req.query;

  let query = `
    SELECT v.*, da.nama_kegiatan, da.tanggal, da.employee_id, da.persentase_capaian,
      e.nama as pegawai_nama, u.username as verified_by_name
    FROM verifications v
    JOIN daily_activities da ON v.activity_id = da.id
    JOIN employees e ON da.employee_id = e.id
    LEFT JOIN users u ON v.verified_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id) { query += ' AND da.employee_id = ?'; params.push(parseInt(employee_id)); }
  if (period_id) { query += ' AND da.period_id = ?'; params.push(parseInt(period_id)); }
  if (status) { query += ' AND v.status = ?'; params.push(status); }

  query += ' ORDER BY v.verified_at DESC';
  res.json(await db.prepare(query).all(...params));
});

// GET /api/verifications/pending
router.get('/pending', authenticate, requireRole('KPA', 'Kasubbag'), async (req, res) => {
  const db = getDb();
  const { period_id } = req.query;

  let query = `
    SELECT da.id, da.nama_kegiatan, da.tanggal, da.employee_id, da.persentase_capaian, da.status_kegiatan,
      e.nama as pegawai_nama, pp.nama as pk_nama,
      (SELECT COUNT(*) FROM activity_evidence ae WHERE ae.activity_id = da.id) as jumlah_bukti,
      (SELECT COUNT(*) FROM evidence_links el WHERE el.activity_id = da.id) as jumlah_link
    FROM daily_activities da
    JOIN employees e ON da.employee_id = e.id
    LEFT JOIN performance_plans pp ON da.performance_plan_id = pp.id
    WHERE NOT EXISTS (SELECT 1 FROM verifications v WHERE v.activity_id = da.id)
  `;
  const params = [];
  if (period_id) { query += ' AND da.period_id = ?'; params.push(parseInt(period_id)); }
  query += ' ORDER BY da.tanggal DESC';

  res.json(await db.prepare(query).all(...params));
});

// POST /api/verifications/:activityId — Verify an activity
router.post('/:activityId', authenticate, requireRole('KPA', 'Kasubbag'), async (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);
  const { status, catatan } = req.body;

  // Check Kasubbag permission
  if (req.user.role === 'Kasubbag') {
    const setting = await db.prepare("SELECT value FROM system_settings WHERE key = 'kasubbag_can_verify'").get();
    if (!setting || setting.value !== 'true') {
      return res.status(403).json({ error: 'Kasubbag tidak memiliki izin verifikasi. Hubungi KPA.' });
    }
  }

  const activity = await db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(actId);
  if (!activity) return res.status(404).json({ error: 'Kegiatan tidak ditemukan' });

  const existing = await db.prepare('SELECT * FROM verifications WHERE activity_id = ?').get(actId);
  if (existing) {
    await db.prepare(`
      UPDATE verifications SET verified_by=?, status=?, catatan=?, verified_at=CURRENT_TIMESTAMP
      WHERE activity_id=?
    `).run(req.user.id, status || 'terverifikasi', catatan || null, actId);
  } else {
    await db.prepare(`
      INSERT INTO verifications (activity_id, verified_by, status, catatan)
      VALUES (?, ?, ?, ?)
    `).run(actId, req.user.id, status || 'terverifikasi', catatan || null);
  }

  const verif = await db.prepare('SELECT * FROM verifications WHERE activity_id = ?').get(actId);
  await logActivity(req.user.id, 'VERIFY_ACTIVITY', 'verifications', actId, existing, verif);
  res.json(verif);
});

// DELETE /api/verifications/:activityId — Remove verification
router.delete('/:activityId', authenticate, requireRole('KPA'), async (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);
  const old = await db.prepare('SELECT * FROM verifications WHERE activity_id = ?').get(actId);
  if (!old) return res.status(404).json({ error: 'Verifikasi tidak ditemukan' });
  await db.prepare('DELETE FROM verifications WHERE activity_id = ?').run(actId);
  await logActivity(req.user.id, 'REMOVE_VERIFICATION', 'verifications', actId, old, null);
  res.json({ message: 'Verifikasi berhasil dibatalkan' });
});

module.exports = router;
