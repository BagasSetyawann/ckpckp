const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// Calculate & GET PK score for an employee in a period
router.get('/pk', authenticate, (req, res) => {
  const db = getDb();
  const { employee_id, period_id } = req.query;
  const empId = req.user.role === 'Anggota' ? req.user.employeeId : parseInt(employee_id);
  if (!empId || !period_id) return res.status(400).json({ error: 'employee_id dan period_id wajib diisi' });

  const plans = db.prepare('SELECT * FROM performance_plans WHERE employee_id = ? AND period_id = ? AND status = ?').all(empId, period_id, 'aktif');
  if (plans.length === 0) return res.json({ plans: [], nilai_pk: 0, total_bobot: 0 });

  const totalBobot = plans.reduce((sum, p) => sum + (p.bobot || 0), 0);
  let nilaiPKWeighted = 0;

  const planScores = plans.map(plan => {
    // Sum realisasi from daily activities for this plan
    const realisasiData = db.prepare(`
      SELECT COALESCE(SUM(realisasi), 0) as total_realisasi, COUNT(*) as jumlah_kegiatan
      FROM daily_activities WHERE performance_plan_id = ? AND employee_id = ?
    `).get(plan.id, empId);

    const capaian = plan.target > 0 ? Math.min((realisasiData.total_realisasi / plan.target) * 100, 100) : 0;
    const nilaiPK = Math.round(capaian * 10) / 10;
    const bobot = plan.bobot || 0;
    const nilaiTertimbang = totalBobot > 0 ? (nilaiPK * bobot) / totalBobot : 0;
    nilaiPKWeighted += nilaiTertimbang;

    return {
      ...plan,
      total_realisasi: realisasiData.total_realisasi,
      jumlah_kegiatan: realisasiData.jumlah_kegiatan,
      persentase_capaian: Math.round(capaian * 10) / 10,
      nilai_pk: nilaiPK,
      nilai_tertimbang: Math.round(nilaiTertimbang * 10) / 10,
    };
  });

  res.json({
    plans: planScores,
    nilai_pk: Math.round(nilaiPKWeighted * 10) / 10,
    total_bobot: totalBobot
  });
});

// Calculate & GET CKP score for an employee in a period
router.get('/ckp', authenticate, (req, res) => {
  const db = getDb();
  const { employee_id, period_id } = req.query;
  const empId = req.user.role === 'Anggota' ? req.user.employeeId : parseInt(employee_id);
  if (!empId || !period_id) return res.status(400).json({ error: 'employee_id dan period_id wajib diisi' });

  // Get weights for this period
  const weights = db.prepare(`
    SELECT cw.bobot, cc.kode FROM ckp_weights cw JOIN ckp_components cc ON cw.component_id = cc.id
    WHERE cw.period_id = ? AND cc.is_active = 1
  `).all(period_id);

  if (weights.length === 0) {
    return res.json({ nilai_ckp: 0, components: [], message: 'Bobot CKP belum dikonfigurasi' });
  }

  // Get PK score
  const plans = db.prepare('SELECT * FROM performance_plans WHERE employee_id = ? AND period_id = ? AND status = ?').all(empId, period_id, 'aktif');
  const totalBobot = plans.reduce((sum, p) => sum + (p.bobot || 0), 0);
  let nilaiPK = 0;
  plans.forEach(plan => {
    const realisasi = db.prepare('SELECT COALESCE(SUM(realisasi), 0) as total FROM daily_activities WHERE performance_plan_id = ? AND employee_id = ?').get(plan.id, empId).total;
    const capaian = plan.target > 0 ? Math.min((realisasi / plan.target) * 100, 100) : 0;
    const bobot = plan.bobot || 0;
    nilaiPK += totalBobot > 0 ? (capaian * bobot) / totalBobot : 0;
  });

  // Get behavior score
  const behavior = db.prepare('SELECT nilai_akhir FROM behavior_assessments WHERE employee_id = ? AND period_id = ?').get(empId, period_id);
  const nilaiPerilaku = behavior?.nilai_akhir || 0;

  const components = weights.map(w => {
    let nilai = 0;
    if (w.kode === 'PK') nilai = Math.round(nilaiPK * 10) / 10;
    else if (w.kode === 'PERILAKU') nilai = nilaiPerilaku;
    return { kode: w.kode, bobot: w.bobot, nilai, nilai_tertimbang: Math.round((nilai * w.bobot) / 100 * 10) / 10 };
  });

  const nilaiCKP = components.reduce((sum, c) => sum + c.nilai_tertimbang, 0);

  // Get existing CKP score record
  const existing = db.prepare('SELECT * FROM monthly_ckp_scores WHERE employee_id = ? AND period_id = ?').get(empId, period_id);

  res.json({
    nilai_pk: Math.round(nilaiPK * 10) / 10,
    nilai_perilaku: nilaiPerilaku,
    nilai_ckp: Math.round(nilaiCKP * 10) / 10,
    components,
    status: existing?.status || 'draft',
    existing
  });
});

// POST /api/scores/ckp/finalize — Finalize CKP score
router.post('/ckp/finalize', authenticate, requireRole('KPA'), (req, res) => {
  const db = getDb();
  const { employee_id, period_id } = req.body;
  if (!employee_id || !period_id) return res.status(400).json({ error: 'Employee dan periode wajib diisi' });

  // Recalculate
  const weights = db.prepare(`
    SELECT cw.bobot, cc.kode FROM ckp_weights cw JOIN ckp_components cc ON cw.component_id = cc.id
    WHERE cw.period_id = ? AND cc.is_active = 1
  `).all(period_id);

  const plans = db.prepare('SELECT * FROM performance_plans WHERE employee_id = ? AND period_id = ? AND status = ?').all(employee_id, period_id, 'aktif');
  const totalBobot = plans.reduce((sum, p) => sum + (p.bobot || 0), 0);
  let nilaiPK = 0;
  plans.forEach(plan => {
    const realisasi = db.prepare('SELECT COALESCE(SUM(realisasi), 0) as total FROM daily_activities WHERE performance_plan_id = ? AND employee_id = ?').get(plan.id, employee_id).total;
    const capaian = plan.target > 0 ? Math.min((realisasi / plan.target) * 100, 100) : 0;
    nilaiPK += totalBobot > 0 ? (capaian * (plan.bobot || 0)) / totalBobot : 0;
  });

  const behavior = db.prepare('SELECT nilai_akhir FROM behavior_assessments WHERE employee_id = ? AND period_id = ?').get(employee_id, period_id);
  const nilaiPerilaku = behavior?.nilai_akhir || 0;
  let nilaiCKP = 0;
  weights.forEach(w => {
    const nilai = w.kode === 'PK' ? nilaiPK : (w.kode === 'PERILAKU' ? nilaiPerilaku : 0);
    nilaiCKP += (nilai * w.bobot) / 100;
  });

  const upsert = db.prepare(`
    INSERT INTO monthly_ckp_scores (employee_id, period_id, nilai_pk, nilai_perilaku, nilai_ckp, status, finalized_at)
    VALUES (?, ?, ?, ?, ?, 'final', CURRENT_TIMESTAMP)
    ON CONFLICT(employee_id, period_id) DO UPDATE SET
      nilai_pk=excluded.nilai_pk, nilai_perilaku=excluded.nilai_perilaku,
      nilai_ckp=excluded.nilai_ckp, status='final', finalized_at=CURRENT_TIMESTAMP
  `);
  upsert.run(employee_id, period_id, Math.round(nilaiPK * 10) / 10, nilaiPerilaku, Math.round(nilaiCKP * 10) / 10);

  logActivity(req.user.id, 'FINALIZE_CKP', 'monthly_ckp_scores', employee_id, null, { employee_id, period_id, nilaiCKP });
  res.json({ message: 'Nilai CKP berhasil difinalisasi', nilai_ckp: Math.round(nilaiCKP * 10) / 10 });
});

// GET /api/scores/summary — Summary for all employees
router.get('/summary', authenticate, requireRole('KPA', 'Kasubbag'), (req, res) => {
  const db = getDb();
  const { period_id } = req.query;
  if (!period_id) return res.status(400).json({ error: 'period_id wajib diisi' });

  const employees = db.prepare(`
    SELECT e.id, e.nama, e.jabatan, e.unit_kerja
    FROM employees e JOIN users u ON e.user_id = u.id JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'Anggota' AND u.is_active = 1
  `).all();

  const period = db.prepare('SELECT * FROM periods WHERE id = ?').get(period_id);
  const totalDays = period ? Math.ceil((new Date(period.tanggal_akhir) - new Date(period.tanggal_mulai)) / (1000 * 60 * 60 * 24)) + 1 : 30;

  const result = employees.map(emp => {
    const actCount = db.prepare('SELECT COUNT(DISTINCT tanggal) as days, COUNT(*) as total FROM daily_activities WHERE employee_id = ? AND period_id = ?').get(emp.id, period_id);
    const ckpScore = db.prepare('SELECT * FROM monthly_ckp_scores WHERE employee_id = ? AND period_id = ?').get(emp.id, period_id);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayAct = db.prepare('SELECT COUNT(*) as count FROM daily_activities WHERE employee_id = ? AND tanggal = ?').get(emp.id, todayStr);

    return {
      ...emp,
      hari_pengisian: actCount.days,
      total_kegiatan: actCount.total,
      nilai_ckp: ckpScore?.nilai_ckp || null,
      nilai_pk: ckpScore?.nilai_pk || null,
      status_ckp: ckpScore?.status || 'draft',
      isi_hari_ini: todayAct.count > 0
    };
  });

  res.json(result);
});

module.exports = router;
