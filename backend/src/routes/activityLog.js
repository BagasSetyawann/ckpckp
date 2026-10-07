const express = require('express');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/activity-log
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { limit = 50, offset = 0, user_id, action } = req.query;

  let query = `
    SELECT al.*, u.username, e.nama as pegawai_nama
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN employees e ON e.user_id = al.user_id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'Anggota') {
    query += ' AND al.user_id = ?';
    params.push(req.user.id);
  } else {
    if (user_id) { query += ' AND al.user_id = ?'; params.push(parseInt(user_id)); }
    if (action) { query += ' AND al.action LIKE ?'; params.push(`%${action}%`); }
  }

  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

module.exports = router;
