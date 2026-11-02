const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// GET /api/periods
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const periods = await db.prepare('SELECT * FROM periods ORDER BY tahun DESC, bulan DESC').all();
  res.json(periods);
});

// GET /api/periods/active
router.get('/active', authenticate, async (req, res) => {
  const db = getDb();
  const period = await db.prepare('SELECT * FROM periods WHERE is_active = 1').get();
  if (!period) return res.status(404).json({ error: 'Tidak ada periode aktif' });
  res.json(period);
});

// GET /api/periods/:id
router.get('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const period = await db.prepare('SELECT * FROM periods WHERE id = ?').get(req.params.id);
  if (!period) return res.status(404).json({ error: 'Periode tidak ditemukan' });
  res.json(period);
});

// POST /api/periods
router.post('/', authenticate, requireRole('KPA'), async (req, res) => {
  const { nama, tahun, bulan, tanggal_mulai, tanggal_akhir, batas_pengisian, status } = req.body;
  if (!nama || !tahun || !bulan || !tanggal_mulai || !tanggal_akhir) {
    return res.status(400).json({ error: 'Field wajib tidak lengkap' });
  }
  const db = getDb();
  const result = await db.prepare(`
    INSERT INTO periods (nama, tahun, bulan, tanggal_mulai, tanggal_akhir, batas_pengisian, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nama, tahun, bulan, tanggal_mulai, tanggal_akhir, batas_pengisian || null, status || 'draft');
  const period = await db.prepare('SELECT * FROM periods WHERE id = ?').get(result.lastInsertRowid);
  await logActivity(req.user.id, 'CREATE_PERIOD', 'periods', period.id, null, period);
  res.status(201).json(period);
});

// PUT /api/periods/:id
router.put('/:id', authenticate, requireRole('KPA'), async (req, res) => {
  const { nama, tanggal_mulai, tanggal_akhir, batas_pengisian, status } = req.body;
  const db = getDb();
  const old = await db.prepare('SELECT * FROM periods WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Periode tidak ditemukan' });
  await db.prepare(`
    UPDATE periods SET nama=?, tanggal_mulai=?, tanggal_akhir=?, batas_pengisian=?, status=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(nama || old.nama, tanggal_mulai || old.tanggal_mulai, tanggal_akhir || old.tanggal_akhir,
    batas_pengisian || old.batas_pengisian, status || old.status, req.params.id);
  const updated = await db.prepare('SELECT * FROM periods WHERE id = ?').get(req.params.id);
  await logActivity(req.user.id, 'UPDATE_PERIOD', 'periods', parseInt(req.params.id), old, updated);
  res.json(updated);
});

// PUT /api/periods/:id/activate
router.put('/:id/activate', authenticate, requireRole('KPA'), async (req, res) => {
  const db = getDb();
  await db.prepare('UPDATE periods SET is_active = 0').run();
  await db.prepare('UPDATE periods SET is_active = 1, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('aktif', req.params.id);
  const period = await db.prepare('SELECT * FROM periods WHERE id = ?').get(req.params.id);
  await logActivity(req.user.id, 'ACTIVATE_PERIOD', 'periods', parseInt(req.params.id), null, period);
  res.json(period);
});

// DELETE /api/periods/:id
router.delete('/:id', authenticate, requireRole('KPA'), async (req, res) => {
  const db = getDb();
  const old = await db.prepare('SELECT * FROM periods WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Periode tidak ditemukan' });
  if (old.is_active) return res.status(400).json({ error: 'Tidak dapat menghapus periode yang sedang aktif' });
  await db.prepare('DELETE FROM periods WHERE id = ?').run(req.params.id);
  await logActivity(req.user.id, 'DELETE_PERIOD', 'periods', parseInt(req.params.id), old, null);
  res.json({ message: 'Periode berhasil dihapus' });
});

module.exports = router;
