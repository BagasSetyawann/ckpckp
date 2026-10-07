const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — KPA: all users; others: self
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  let users;
  if (req.user.role === 'KPA' || req.user.role === 'Kasubbag') {
    users = db.prepare(`
      SELECT u.id, u.username, u.is_active, u.last_login, u.created_at, r.name as role,
             e.id as employee_id, e.nip, e.nama, e.jabatan, e.unit_kerja, e.golongan, e.email
      FROM users u JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY e.nama
    `).all();
  } else {
    users = db.prepare(`
      SELECT u.id, u.username, u.is_active, u.last_login, r.name as role,
             e.id as employee_id, e.nip, e.nama, e.jabatan, e.unit_kerja, e.golongan, e.email
      FROM users u JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.id = ?
    `).all(req.user.id);
  }
  res.json(users);
});

// GET /api/users/employees — All employees list
router.get('/employees', authenticate, (req, res) => {
  const db = getDb();
  if (req.user.role === 'Anggota') {
    const emp = db.prepare('SELECT * FROM employees WHERE user_id = ?').get(req.user.id);
    return res.json(emp ? [emp] : []);
  }
  const employees = db.prepare(`
    SELECT e.*, r.name as role, u.username, u.is_active
    FROM employees e JOIN users u ON e.user_id = u.id JOIN roles r ON u.role_id = r.id
    ORDER BY e.nama
  `).all();
  res.json(employees);
});

// GET /api/users/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const targetId = parseInt(req.params.id);
  if (req.user.role === 'Anggota' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }
  const user = db.prepare(`
    SELECT u.id, u.username, u.is_active, u.last_login, r.name as role,
           e.id as employee_id, e.nip, e.nama, e.jabatan, e.unit_kerja, e.golongan, e.email
    FROM users u JOIN roles r ON u.role_id = r.id
    LEFT JOIN employees e ON e.user_id = u.id
    WHERE u.id = ?
  `).get(targetId);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json(user);
});

// POST /api/users — KPA only
router.post('/', authenticate, requireRole('KPA'), (req, res) => {
  const { username, password, role, nip, nama, jabatan, unit_kerja, golongan, email } = req.body;
  if (!username || !password || !role || !nama) {
    return res.status(400).json({ error: 'Field wajib tidak lengkap' });
  }
  const db = getDb();
  const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(role);
  if (!roleRow) return res.status(400).json({ error: 'Role tidak valid' });

  const hash = bcrypt.hashSync(password, 10);
  const userResult = db.prepare(
    'INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)'
  ).run(username, hash, roleRow.id);

  const empResult = db.prepare(
    'INSERT INTO employees (user_id, nip, nama, jabatan, unit_kerja, golongan, email) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userResult.lastInsertRowid, nip || null, nama, jabatan || null, unit_kerja || null, golongan || null, email || null);

  const newUser = db.prepare('SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?').get(userResult.lastInsertRowid);
  logActivity(req.user.id, 'CREATE_USER', 'users', userResult.lastInsertRowid, null, { username, role, nama });
  res.status(201).json(newUser);
});

// PUT /api/users/:id
router.put('/:id', authenticate, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.role === 'Anggota' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }
  const db = getDb();
  const old = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!old) return res.status(404).json({ error: 'User tidak ditemukan' });

  const { nip, nama, jabatan, unit_kerja, golongan, email, is_active } = req.body;
  db.prepare(`
    UPDATE employees SET nip=?, nama=?, jabatan=?, unit_kerja=?, golongan=?, email=?, updated_at=CURRENT_TIMESTAMP
    WHERE user_id=?
  `).run(nip, nama, jabatan, unit_kerja, golongan, email, targetId);

  if (req.user.role === 'KPA' && is_active !== undefined) {
    db.prepare('UPDATE users SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(is_active ? 1 : 0, targetId);
  }
  logActivity(req.user.id, 'UPDATE_USER', 'users', targetId, old, req.body);
  res.json({ message: 'Data berhasil diperbarui' });
});

// DELETE /api/users/:id — KPA only
router.delete('/:id', authenticate, requireRole('KPA'), (req, res) => {
  const db = getDb();
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
  const old = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!old) return res.status(404).json({ error: 'User tidak ditemukan' });
  db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetId);
  logActivity(req.user.id, 'DEACTIVATE_USER', 'users', targetId, old, null);
  res.json({ message: 'User berhasil dinonaktifkan' });
});

module.exports = router;
