const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { authenticate, JWT_SECRET, logActivity } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.username, u.password_hash, u.is_active, r.name as role
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.username = ?
  `).get(username);

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE user_id = ?').get(user.id);
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, employeeId: employee?.id },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  logActivity(user.id, 'LOGIN', 'users', user.id, null, { username: user.username });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      employee: employee ? {
        id: employee.id,
        nip: employee.nip,
        nama: employee.nama,
        jabatan: employee.jabatan,
        unit_kerja: employee.unit_kerja,
        golongan: employee.golongan,
        email: employee.email,
      } : null
    }
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  logActivity(req.user.id, 'LOGOUT', 'users', req.user.id, null, null);
  res.json({ message: 'Berhasil logout' });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.username, u.last_login, r.name as role
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(req.user.id);

  const employee = db.prepare('SELECT * FROM employees WHERE user_id = ?').get(req.user.id);

  // Unread notifications count
  const notifCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);

  res.json({
    user: { ...user, employee },
    unreadNotifications: notifCount.count
  });
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  }

  const db = getDb();
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Password lama tidak sesuai' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);
  logActivity(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null, null);
  res.json({ message: 'Password berhasil diubah' });
});

module.exports = router;
