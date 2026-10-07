const express = require('express');
const path = require('path');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// GET /api/evidence/activity/:activityId
router.get('/activity/:activityId', authenticate, (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);

  const activity = db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(actId);
  if (!activity) return res.status(404).json({ error: 'Kegiatan tidak ditemukan' });
  if (req.user.role === 'Anggota' && activity.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  const files = db.prepare('SELECT * FROM activity_evidence WHERE activity_id = ? ORDER BY created_at DESC').all(actId);
  const links = db.prepare('SELECT * FROM evidence_links WHERE activity_id = ? ORDER BY created_at DESC').all(actId);
  res.json({ files, links });
});

// POST /api/evidence/upload/:activityId — File upload
router.post('/upload/:activityId', authenticate, upload.array('files', 5), (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);

  const activity = db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(actId);
  if (!activity) return res.status(404).json({ error: 'Kegiatan tidak ditemukan' });
  if (req.user.role === 'Anggota' && activity.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
  }

  const insertEvidence = db.prepare(`
    INSERT INTO activity_evidence (activity_id, jenis, nama_file, path_file, ukuran_file, mime_type, keterangan)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const results = req.files.map(file => {
    const jenis = file.mimetype.startsWith('image/') ? 'foto' : 
                  file.mimetype === 'application/pdf' ? 'dokumen' :
                  file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') ? 'spreadsheet' :
                  file.mimetype.includes('word') ? 'dokumen' : 'lainnya';

    const result = insertEvidence.run(actId, jenis, file.originalname, `/uploads/${req.user.id}/${file.filename}`, file.size, file.mimetype, req.body.keterangan || null);
    return { id: result.lastInsertRowid, nama_file: file.originalname, jenis, path_file: `/uploads/${req.user.id}/${file.filename}` };
  });

  logActivity(req.user.id, 'UPLOAD_EVIDENCE', 'activity_evidence', actId, null, { files: results.length });
  res.status(201).json(results);
});

// POST /api/evidence/link/:activityId — Add link
router.post('/link/:activityId', authenticate, (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);
  const { judul, url, platform, keterangan } = req.body;

  if (!judul || !url) return res.status(400).json({ error: 'Judul dan URL wajib diisi' });

  const activity = db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(actId);
  if (!activity) return res.status(404).json({ error: 'Kegiatan tidak ditemukan' });
  if (req.user.role === 'Anggota' && activity.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  const result = db.prepare(`
    INSERT INTO evidence_links (activity_id, judul, url, platform, keterangan)
    VALUES (?, ?, ?, ?, ?)
  `).run(actId, judul, url, platform || null, keterangan || null);

  const link = db.prepare('SELECT * FROM evidence_links WHERE id = ?').get(result.lastInsertRowid);
  logActivity(req.user.id, 'ADD_EVIDENCE_LINK', 'evidence_links', link.id, null, link);
  res.status(201).json(link);
});

// DELETE /api/evidence/file/:id
router.delete('/file/:id', authenticate, (req, res) => {
  const db = getDb();
  const ev = db.prepare(`
    SELECT ae.*, da.employee_id FROM activity_evidence ae
    JOIN daily_activities da ON ae.activity_id = da.id
    WHERE ae.id = ?
  `).get(req.params.id);

  if (!ev) return res.status(404).json({ error: 'Bukti dukung tidak ditemukan' });
  if (req.user.role === 'Anggota' && ev.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  db.prepare('DELETE FROM activity_evidence WHERE id = ?').run(req.params.id);
  logActivity(req.user.id, 'DELETE_EVIDENCE', 'activity_evidence', parseInt(req.params.id), ev, null);
  res.json({ message: 'Bukti dukung berhasil dihapus' });
});

// DELETE /api/evidence/link/:id
router.delete('/link/:id', authenticate, (req, res) => {
  const db = getDb();
  const link = db.prepare(`
    SELECT el.*, da.employee_id FROM evidence_links el
    JOIN daily_activities da ON el.activity_id = da.id
    WHERE el.id = ?
  `).get(req.params.id);

  if (!link) return res.status(404).json({ error: 'Link tidak ditemukan' });
  if (req.user.role === 'Anggota' && link.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  db.prepare('DELETE FROM evidence_links WHERE id = ?').run(req.params.id);
  logActivity(req.user.id, 'DELETE_EVIDENCE_LINK', 'evidence_links', parseInt(req.params.id), link, null);
  res.json({ message: 'Link berhasil dihapus' });
});

module.exports = router;
