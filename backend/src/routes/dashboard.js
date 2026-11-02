const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/pegawai — For individual employee
router.get('/pegawai', authenticate, async (req, res) => {
  const db = getDb();
  const empId = req.user.employeeId;
  if (!empId) return res.status(400).json({ error: 'Employee ID tidak ditemukan' });

  const period = await db.prepare('SELECT * FROM periods WHERE is_active = 1').get();
  if (!period) return res.json({ period: null, message: 'Tidak ada periode aktif' });

  const todayStr = new Date().toISOString().split('T')[0];

  // Today's activities
  const todayActivities = await db.prepare(`
    SELECT da.*, pp.nama as pk_nama, v.status as verif_status
    FROM daily_activities da
    LEFT JOIN performance_plans pp ON da.performance_plan_id = pp.id
    LEFT JOIN verifications v ON v.activity_id = da.id
    WHERE da.employee_id = ? AND da.tanggal = ?
    ORDER BY da.created_at DESC
  `).all(empId, todayStr);

  // Month stats
  const monthStats = await db.prepare(`
    SELECT COUNT(*) as total_kegiatan, COUNT(DISTINCT tanggal) as hari_pengisian,
      AVG(persentase_capaian) as avg_capaian
    FROM daily_activities WHERE employee_id = ? AND period_id = ?
  `).get(empId, period.id);

  // Bukti dukung count
  const buktiCount = await db.prepare(`
    SELECT COUNT(*) as count FROM activity_evidence ae
    JOIN daily_activities da ON ae.activity_id = da.id
    WHERE da.employee_id = ? AND da.period_id = ?
  `).get(empId, period.id);

  const linkCount = await db.prepare(`
    SELECT COUNT(*) as count FROM evidence_links el
    JOIN daily_activities da ON el.activity_id = da.id
    WHERE da.employee_id = ? AND da.period_id = ?
  `).get(empId, period.id);

  // PK Progress
  const plans = await db.prepare(`
    SELECT pp.*,
      (SELECT COALESCE(SUM(da.realisasi), 0) FROM daily_activities da
        WHERE da.performance_plan_id = pp.id AND da.employee_id = pp.employee_id) as total_realisasi
    FROM performance_plans pp
    WHERE pp.employee_id = ? AND pp.period_id = ? AND pp.status = ?
  `).all(empId, period.id, 'aktif');
  const planProgress = plans.map(p => ({
    ...p,
    persentase: p.target > 0 ? Math.min(Math.round((p.total_realisasi / p.target) * 100), 100) : 0
  }));

  // CKP Score
  const ckpScore = await db.prepare('SELECT * FROM monthly_ckp_scores WHERE employee_id = ? AND period_id = ?').get(empId, period.id);

  // Notifications
  const notifications = await db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(req.user.id);

  // Working days (Mon-Fri) in current month up to today
  const startDate = new Date(period.tanggal_mulai);
  const endDate = new Date(Math.min(new Date(todayStr), new Date(period.tanggal_akhir)));
  let workdays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) workdays++;
  }

  res.json({
    period,
    today: todayStr,
    sudah_isi_hari_ini: todayActivities.length > 0,
    today_activities: todayActivities,
    today_avg_capaian: todayActivities.length > 0 ? Math.round(todayActivities.reduce((s, a) => s + (a.persentase_capaian || 0), 0) / todayActivities.length) : 0,
    month_stats: {
      ...monthStats,
      bukti_dukung: buktiCount.count + linkCount.count,
      hari_kerja: workdays,
      avg_capaian: Math.round(monthStats.avg_capaian || 0)
    },
    plan_progress: planProgress,
    ckp_score: ckpScore,
    notifications
  });
});

// GET /api/dashboard/kpa — For KPA
router.get('/kpa', authenticate, requireRole('KPA', 'Kasubbag'), async (req, res) => {
  const db = getDb();
  const period = await db.prepare('SELECT * FROM periods WHERE is_active = 1').get();
  const periodId = period?.id || 0;
  const todayStr = new Date().toISOString().split('T')[0];

  // Semua pegawai + statistik dalam satu query (hemat round-trip ke Supabase)
  const allEmployees = await db.prepare(`
    SELECT e.id, e.nama, e.jabatan, e.unit_kerja,
      (SELECT COUNT(*) FROM daily_activities da WHERE da.employee_id = e.id AND da.tanggal = ?) as today_count,
      (SELECT COUNT(*) FROM daily_activities da WHERE da.employee_id = e.id AND da.period_id = ?) as total_kegiatan,
      (SELECT COUNT(DISTINCT da.tanggal) FROM daily_activities da WHERE da.employee_id = e.id AND da.period_id = ?) as hari_pengisian,
      ckp.nilai_ckp, ckp.nilai_pk
    FROM employees e
    JOIN users u ON e.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN monthly_ckp_scores ckp ON ckp.employee_id = e.id AND ckp.period_id = ?
    WHERE r.name = 'Anggota' AND u.is_active = 1
  `).all(todayStr, periodId, periodId, periodId);

  const totalPegawai = allEmployees.length;
  const sudahIsi = allEmployees.filter(emp => emp.today_count > 0).length;
  const belumIsi = totalPegawai - sudahIsi;

  // Total activities today
  const kegiatanHariIni = (await db.prepare(`
    SELECT COUNT(*) as count FROM daily_activities WHERE tanggal = ?
  `).get(todayStr)).count;

  // Pending verifications
  const menungguVerif = (await db.prepare(`
    SELECT COUNT(*) as count FROM daily_activities da
    LEFT JOIN verifications v ON v.activity_id = da.id
    WHERE v.id IS NULL AND da.period_id = ?
  `).get(periodId)).count;

  // Average CKP
  const avgCKP = (await db.prepare(`
    SELECT AVG(nilai_ckp) as avg FROM monthly_ckp_scores WHERE period_id = ?
  `).get(periodId)).avg;

  // Employees not filled today
  const belumIsiList = allEmployees
    .filter(emp => emp.today_count === 0)
    .map(({ id, nama, jabatan, unit_kerja }) => ({ id, nama, jabatan, unit_kerja }));

  // Monthly trend (last 6 months)
  const trendData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const p = await db.prepare(`
      SELECT p.id,
        (SELECT AVG(nilai_ckp) FROM monthly_ckp_scores WHERE period_id = p.id) as avg,
        (SELECT COUNT(*) FROM daily_activities WHERE period_id = p.id) as total
      FROM periods p WHERE p.tahun = ? AND p.bulan = ?
    `).get(year, month);
    if (p) {
      trendData.push({
        bulan: `${year}-${month.toString().padStart(2, '0')}`,
        label: d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
        avg_ckp: Math.round((p.avg || 0) * 10) / 10,
        total_kegiatan: p.total
      });
    }
  }

  // Employee CKP summary
  const empSummary = allEmployees.map(emp => ({
    id: emp.id,
    nama: emp.nama,
    jabatan: emp.jabatan,
    unit_kerja: emp.unit_kerja,
    isi_hari_ini: emp.today_count > 0,
    total_kegiatan: emp.total_kegiatan,
    hari_pengisian: emp.hari_pengisian,
    nilai_ckp: emp.nilai_ckp || null,
    nilai_pk: emp.nilai_pk || null,
  }));

  res.json({
    period,
    today: todayStr,
    stats: {
      total_pegawai: totalPegawai,
      sudah_isi: sudahIsi,
      belum_isi: belumIsi,
      kegiatan_hari_ini: kegiatanHariIni,
      menunggu_verifikasi: menungguVerif,
      rata_rata_ckp: Math.round((avgCKP || 0) * 10) / 10,
    },
    belum_isi_list: belumIsiList,
    trend_data: trendData,
    employee_summary: empSummary
  });
});

// GET /api/dashboard/notifications
router.get('/notifications', authenticate, async (req, res) => {
  const db = getDb();
  const notifs = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
  res.json(notifs);
});

// PUT /api/dashboard/notifications/read
router.put('/notifications/read', authenticate, async (req, res) => {
  const db = getDb();
  await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Semua notifikasi ditandai sudah dibaca' });
});

module.exports = router;
