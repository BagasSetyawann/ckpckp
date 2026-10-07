const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'si-ckp-secret-key-2026-very-secure';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau sudah kadaluarsa' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Tidak terautentikasi' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki hak akses untuk fitur ini.' });
    }
    next();
  };
}

function logActivity(userId, action, resourceType, resourceId, oldData, newData) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, resource_type, resource_id, old_data, new_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, action, resourceType, resourceId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null
    );
  } catch (e) {
    console.error('Log error:', e.message);
  }
}

module.exports = { authenticate, requireRole, logActivity, JWT_SECRET };
