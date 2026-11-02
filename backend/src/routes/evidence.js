const express = require('express');
const path = require('path');
const { getDb } = require('../db/database');
const { authenticate, logActivity } = require('../middleware/auth');
const { ALLOWED_MIME_TYPES } = require('../middleware/upload');
const { getStorage, ensureBucket, BUCKET, MAX_FILE_SIZE } = require('../utils/storage');

const router = express.Router();

async function getActivityWithAccess(db, req, res, actId) {
  const activity = await db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(actId);
  if (!activity) {
    res.status(404).json({ error: 'Kegiatan tidak ditemukan' });
    return null;
  }
  if (req.user.role === 'Anggota' && activity.employee_id !== req.user.employeeId) {
    res.status(403).json({ error: 'Akses ditolak' });
    return null;
  }
  return activity;
}

function getJenis(mime = '') {
  if (mime.startsWith('image/')) return 'foto';
  if (mime === 'application/pdf') return 'dokumen';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'spreadsheet';
  if (mime.includes('word')) return 'dokumen';
  return 'lainnya';
}

// GET /api/evidence/activity/:activityId
router.get('/activity/:activityId', authenticate, async (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);
  if (!(await getActivityWithAccess(db, req, res, actId))) return;

  const files = await db.prepare('SELECT * FROM activity_evidence WHERE activity_id = ? ORDER BY created_at DESC').all(actId);
  const links = await db.prepare('SELECT * FROM evidence_links WHERE activity_id = ? ORDER BY created_at DESC').all(actId);
  res.json({ files, links });
});

// POST /api/evidence/upload-url/:activityId
// Langkah 1: minta signed upload URL. File lalu diupload langsung dari browser ke Supabase Storage
// (melewati batas body 4.5MB Vercel).
router.post('/upload-url/:activityId', authenticate, async (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);
  const { nama_file, mime_type, ukuran_file } = req.body;

  if (!nama_file) return res.status(400).json({ error: 'Nama file wajib diisi' });
  if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
    return res.status(400).json({ error: `Tipe file "${nama_file}" tidak diizinkan. Gunakan: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP` });
  }
  if (ukuran_file && ukuran_file > MAX_FILE_SIZE) {
    return res.status(400).json({ error: `File "${nama_file}" melebihi batas 10MB` });
  }
  if (!(await getActivityWithAccess(db, req, res, actId))) return;

  await ensureBucket();
  const ext = path.extname(nama_file).toLowerCase();
  const base = path.basename(nama_file, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60) || 'file';
  const storagePath = `${req.user.id}/${actId}/${base}_${Date.now()}${ext}`;

  const { data, error } = await getStorage().from(BUCKET).createSignedUploadUrl(storagePath);
  if (error) return res.status(500).json({ error: 'Gagal membuat URL upload: ' + error.message });

  res.json({ signedUrl: data.signedUrl, token: data.token, path: data.path || storagePath });
});

// POST /api/evidence/file/:activityId
// Langkah 2: simpan metadata file yang sudah terupload ke Supabase Storage
router.post('/file/:activityId', authenticate, async (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);
  const { path: storagePath, nama_file, mime_type, ukuran_file, keterangan } = req.body;

  if (!storagePath || !nama_file) return res.status(400).json({ error: 'Data file tidak lengkap' });
  if (!storagePath.startsWith(`${req.user.id}/${actId}/`)) {
    return res.status(400).json({ error: 'Path file tidak valid' });
  }
  if (!(await getActivityWithAccess(db, req, res, actId))) return;

  const { data: pub } = getStorage().from(BUCKET).getPublicUrl(storagePath);
  const jenis = getJenis(mime_type);

  const result = await db.prepare(`
    INSERT INTO activity_evidence (activity_id, jenis, nama_file, path_file, storage_path, ukuran_file, mime_type, keterangan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(actId, jenis, nama_file, pub.publicUrl, storagePath, ukuran_file || null, mime_type || null, keterangan || null);

  const evidence = await db.prepare('SELECT * FROM activity_evidence WHERE id = ?').get(result.lastInsertRowid);
  await logActivity(req.user.id, 'UPLOAD_EVIDENCE', 'activity_evidence', actId, null, { file: nama_file });
  res.status(201).json(evidence);
});

// POST /api/evidence/link/:activityId — Add link
router.post('/link/:activityId', authenticate, async (req, res) => {
  const db = getDb();
  const actId = parseInt(req.params.activityId);
  const { judul, url, platform, keterangan } = req.body;

  if (!judul || !url) return res.status(400).json({ error: 'Judul dan URL wajib diisi' });
  if (!(await getActivityWithAccess(db, req, res, actId))) return;

  const result = await db.prepare(`
    INSERT INTO evidence_links (activity_id, judul, url, platform, keterangan)
    VALUES (?, ?, ?, ?, ?)
  `).run(actId, judul, url, platform || null, keterangan || null);

  const link = await db.prepare('SELECT * FROM evidence_links WHERE id = ?').get(result.lastInsertRowid);
  await logActivity(req.user.id, 'ADD_EVIDENCE_LINK', 'evidence_links', link.id, null, link);
  res.status(201).json(link);
});

// DELETE /api/evidence/file/:id
router.delete('/file/:id', authenticate, async (req, res) => {
  const db = getDb();
  const ev = await db.prepare(`
    SELECT ae.*, da.employee_id FROM activity_evidence ae
    JOIN daily_activities da ON ae.activity_id = da.id
    WHERE ae.id = ?
  `).get(req.params.id);

  if (!ev) return res.status(404).json({ error: 'Bukti dukung tidak ditemukan' });
  if (req.user.role === 'Anggota' && ev.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  if (ev.storage_path) {
    const { error } = await getStorage().from(BUCKET).remove([ev.storage_path]);
    if (error) console.warn('Gagal hapus file storage:', error.message);
  }

  await db.prepare('DELETE FROM activity_evidence WHERE id = ?').run(req.params.id);
  await logActivity(req.user.id, 'DELETE_EVIDENCE', 'activity_evidence', parseInt(req.params.id), ev, null);
  res.json({ message: 'Bukti dukung berhasil dihapus' });
});

// DELETE /api/evidence/link/:id
router.delete('/link/:id', authenticate, async (req, res) => {
  const db = getDb();
  const link = await db.prepare(`
    SELECT el.*, da.employee_id FROM evidence_links el
    JOIN daily_activities da ON el.activity_id = da.id
    WHERE el.id = ?
  `).get(req.params.id);

  if (!link) return res.status(404).json({ error: 'Link tidak ditemukan' });
  if (req.user.role === 'Anggota' && link.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  await db.prepare('DELETE FROM evidence_links WHERE id = ?').run(req.params.id);
  await logActivity(req.user.id, 'DELETE_EVIDENCE_LINK', 'evidence_links', parseInt(req.params.id), link, null);
  res.json({ message: 'Link berhasil dihapus' });
});

module.exports = router;
