const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// GET /api/ckp-config/components
router.get('/components', authenticate, async (req, res) => {
  const db = getDb();
  res.json(await db.prepare('SELECT * FROM ckp_components ORDER BY urutan').all());
});

// POST /api/ckp-config/components
router.post('/components', authenticate, requireRole('KPA'), async (req, res) => {
  const db = getDb();
  const { kode, nama, deskripsi, urutan } = req.body;
  if (!kode || !nama) return res.status(400).json({ error: 'Kode dan nama wajib diisi' });
  const result = await db.prepare('INSERT INTO ckp_components (kode, nama, deskripsi, urutan) VALUES (?, ?, ?, ?)').run(kode, nama, deskripsi || null, urutan || 0);
  const comp = await db.prepare('SELECT * FROM ckp_components WHERE id = ?').get(result.lastInsertRowid);
  await logActivity(req.user.id, 'CREATE_CKP_COMPONENT', 'ckp_components', comp.id, null, comp);
  res.status(201).json(comp);
});

// PUT /api/ckp-config/components/:id
router.put('/components/:id', authenticate, requireRole('KPA'), async (req, res) => {
  const db = getDb();
  const { nama, deskripsi, is_active, urutan } = req.body;
  const old = await db.prepare('SELECT * FROM ckp_components WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Komponen tidak ditemukan' });
  await db.prepare('UPDATE ckp_components SET nama=?, deskripsi=?, is_active=?, urutan=? WHERE id=?').run(
    nama ?? old.nama, deskripsi ?? old.deskripsi, is_active ?? old.is_active, urutan ?? old.urutan, req.params.id
  );
  res.json(await db.prepare('SELECT * FROM ckp_components WHERE id = ?').get(req.params.id));
});

// GET /api/ckp-config/weights/:periodId
router.get('/weights/:periodId', authenticate, async (req, res) => {
  const db = getDb();
  const weights = await db.prepare(`
    SELECT cw.*, cc.kode, cc.nama, cc.deskripsi, cc.is_active
    FROM ckp_weights cw JOIN ckp_components cc ON cw.component_id = cc.id
    WHERE cw.period_id = ? ORDER BY cc.urutan
  `).all(req.params.periodId);
  res.json(weights);
});

// PUT /api/ckp-config/weights/:periodId — Bulk update weights
router.put('/weights/:periodId', authenticate, requireRole('KPA'), async (req, res) => {
  const db = getDb();
  const { weights } = req.body; // [{ component_id, bobot }]
  if (!Array.isArray(weights)) return res.status(400).json({ error: 'Format tidak valid' });

  const total = weights.reduce((sum, w) => sum + (parseFloat(w.bobot) || 0), 0);
  if (Math.abs(total - 100) > 0.01) {
    return res.status(400).json({ error: `Total bobot harus 100%. Saat ini: ${total.toFixed(1)}%` });
  }

  const upsert = db.prepare(`
    INSERT INTO ckp_weights (period_id, component_id, bobot)
    VALUES (?, ?, ?)
    ON CONFLICT(period_id, component_id) DO UPDATE SET bobot=excluded.bobot, updated_at=CURRENT_TIMESTAMP
  `);

  for (const w of weights) {
    await upsert.run(req.params.periodId, w.component_id, parseFloat(w.bobot));
  }

  await logActivity(req.user.id, 'UPDATE_CKP_WEIGHTS', 'ckp_weights', parseInt(req.params.periodId), null, weights);
  res.json({ message: 'Bobot berhasil diperbarui', weights });
});

// GET /api/ckp-config/settings
router.get('/settings', authenticate, async (req, res) => {
  const db = getDb();
  const settings = await db.prepare('SELECT * FROM system_settings').all();
  const settingMap = {};
  settings.forEach(s => settingMap[s.key] = s.value);
  res.json(settingMap);
});

// PUT /api/ckp-config/settings
router.put('/settings', authenticate, requireRole('KPA'), async (req, res) => {
  const db = getDb();
  const updates = req.body;
  const upsert = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP');
  for (const [key, value] of Object.entries(updates)) {
    await upsert.run(key, String(value));
  }
  await logActivity(req.user.id, 'UPDATE_SETTINGS', 'system_settings', null, null, updates);
  res.json({ message: 'Pengaturan berhasil disimpan' });
});

module.exports = router;
