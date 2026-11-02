const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// Ambil rencana kinerja aktif beserta total realisasi (1 query)
async function getPlansWithRealisasi(db, empId, periodId) {
  return db.prepare(`
    SELECT pp.*,
      (SELECT COALESCE(SUM(da.realisasi), 0) FROM daily_activities da
        WHERE da.performance_plan_id = pp.id AND da.employee_id = pp.employee_id) as total_realisasi,
      (SELECT COUNT(*) FROM daily_activities da
        WHERE da.performance_plan_id = pp.id AND da.employee_id = pp.employee_id) as jumlah_kegiatan
    FROM performance_plans pp
    WHERE pp.employee_id = ? AND pp.period_id = ? AND pp.status = ?
  `).all(empId, periodId, 'aktif');
}

function calcNilaiPK(plans) {
  const totalBobot = plans.reduce((sum, p) => sum + (p.bobot || 0), 0);
  let nilaiPK = 0;
  plans.forEach(plan => {
    const capaian = plan.target > 0 ? Math.min((plan.total_realisasi / plan.target) * 100, 100) : 0;
    nilaiPK += totalBobot > 0 ? (capaian * (plan.bobot || 0)) / totalBobot : 0;
  });
  return { nilaiPK, totalBobot };
}

// Calculate & GET PK score for an employee in a period
router.get('/pk', authenticate, async (req, res) => {
  const db = getDb();
  const { employee_id, period_id } = req.query;
  const empId = req.user.role === 'Anggota' ? req.user.employeeId : parseInt(employee_id);
  if (!empId || !period_id) return res.status(400).json({ error: 'employee_id dan period_id wajib diisi' });

  const plans = await getPlansWithRealisasi(db, empId, period_id);
  if (plans.length === 0) return res.json({ plans: [], nilai_pk: 0, total_bobot: 0 });

  const totalBobot = plans.reduce((sum, p) => sum + (p.bobot || 0), 0);
  let nilaiPKWeighted = 0;

  const planScores = plans.map(plan => {
    const capaian = plan.target > 0 ? Math.min((plan.total_realisasi / plan.target) * 100, 100) : 0;
    const nilaiPK = Math.round(capaian * 10) / 10;
    const bobot = plan.bobot || 0;
    const nilaiTertimbang = totalBobot > 0 ? (nilaiPK * bobot) / totalBobot : 0;
    nilaiPKWeighted += nilaiTertimbang;

    return {
      ...plan,
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
router.get('/ckp', authenticate, async (req, res) => {
  const db = getDb();
  const { employee_id, period_id } = req.query;
  const empId = req.user.role === 'Anggota' ? req.user.employeeId : parseInt(employee_id);
  if (!empId || !period_id) return res.status(400).json({ error: 'employee_id dan period_id wajib diisi' });

  // Get weights for this period
  const weights = await db.prepare(`
    SELECT cw.bobot, cc.kode FROM ckp_weights cw JOIN ckp_components cc ON cw.component_id = cc.id
    WHERE cw.period_id = ? AND cc.is_active = 1
  `).all(period_id);

  if (weights.length === 0) {
    return res.json({ nilai_ckp: 0, components: [], message: 'Bobot CKP belum dikonfigurasi' });
  }

  // Get PK score
  const plans = await getPlansWithRealisasi(db, empId, period_id);
  const { nilaiPK } = calcNilaiPK(plans);

  // Get behavior score
  const behavior = await db.prepare('SELECT nilai_akhir FROM behavior_assessments WHERE employee_id = ? AND period_id = ?').get(empId, period_id);
  const nilaiPerilaku = behavior?.nilai_akhir || 0;

  const components = weights.map(w => {
    let nilai = 0;
    if (w.kode === 'PK') nilai = Math.round(nilaiPK * 10) / 10;
    else if (w.kode === 'PERILAKU') nilai = nilaiPerilaku;
    return { kode: w.kode, bobot: w.bobot, nilai, nilai_tertimbang: Math.round((nilai * w.bobot) / 100 * 10) / 10 };
  });

  const nilaiCKP = components.reduce((sum, c) => sum + c.nilai_tertimbang, 0);

  // Get existing CKP score record
  const existing = await db.prepare('SELECT * FROM monthly_ckp_scores WHERE employee_id = ? AND period_id = ?').get(empId, period_id);

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
router.post('/ckp/finalize', authenticate, requireRole('KPA'), async (req, res) => {
  const db = getDb();
  const { employee_id, period_id } = req.body;
  if (!employee_id || !period_id) return res.status(400).json({ error: 'Employee dan periode wajib diisi' });

  // Recalculate
  const weights = await db.prepare(`
    SELECT cw.bobot, cc.kode FROM ckp_weights cw JOIN ckp_components cc ON cw.component_id = cc.id
    WHERE cw.period_id = ? AND cc.is_active = 1
  `).all(period_id);

  const plans = await getPlansWithRealisasi(db, employee_id, period_id);
  const { nilaiPK } = calcNilaiPK(plans);

  const behavior = await db.prepare('SELECT nilai_akhir FROM behavior_assessments WHERE employee_id = ? AND period_id = ?').get(employee_id, period_id);
  const nilaiPerilaku = behavior?.nilai_akhir || 0;
  let nilaiCKP = 0;
  weights.forEach(w => {
    const nilai = w.kode === 'PK' ? nilaiPK : (w.kode === 'PERILAKU' ? nilaiPerilaku : 0);
    nilaiCKP += (nilai * w.bobot) / 100;
  });

  await db.prepare(`
    INSERT INTO monthly_ckp_scores (employee_id, period_id, nilai_pk, nilai_perilaku, nilai_ckp, status, finalized_at)
    VALUES (?, ?, ?, ?, ?, 'final', CURRENT_TIMESTAMP)
    ON CONFLICT(employee_id, period_id) DO UPDATE SET
      nilai_pk=excluded.nilai_pk, nilai_perilaku=excluded.nilai_perilaku,
      nilai_ckp=excluded.nilai_ckp, status='final', finalized_at=CURRENT_TIMESTAMP
  `).run(employee_id, period_id, Math.round(nilaiPK * 10) / 10, nilaiPerilaku, Math.round(nilaiCKP * 10) / 10);

  await logActivity(req.user.id, 'FINALIZE_CKP', 'monthly_ckp_scores', employee_id, null, { employee_id, period_id, nilaiCKP });
  res.json({ message: 'Nilai CKP berhasil difinalisasi', nilai_ckp: Math.round(nilaiCKP * 10) / 10 });
});

// GET /api/scores/summary — Summary for all employees
router.get('/summary', authenticate, requireRole('KPA', 'Kasubbag'), async (req, res) => {
  const db = getDb();
  const { period_id } = req.query;
  if (!period_id) return res.status(400).json({ error: 'period_id wajib diisi' });

  const todayStr = new Date().toISOString().split('T')[0];

  const employees = await db.prepare(`
    SELECT e.id, e.nama, e.jabatan, e.unit_kerja,
      (SELECT COUNT(DISTINCT da.tanggal) FROM daily_activities da WHERE da.employee_id = e.id AND da.period_id = ?) as hari_pengisian,
      (SELECT COUNT(*) FROM daily_activities da WHERE da.employee_id = e.id AND da.period_id = ?) as total_kegiatan,
      (SELECT COUNT(*) FROM daily_activities da WHERE da.employee_id = e.id AND da.tanggal = ?) as today_count,
      ckp.nilai_ckp, ckp.nilai_pk, ckp.status as status_ckp
    FROM employees e
    JOIN users u ON e.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN monthly_ckp_scores ckp ON ckp.employee_id = e.id AND ckp.period_id = ?
    WHERE r.name = 'Anggota' AND u.is_active = 1
  `).all(period_id, period_id, todayStr, period_id);

  const result = employees.map(({ today_count, ...emp }) => ({
    ...emp,
    nilai_ckp: emp.nilai_ckp || null,
    nilai_pk: emp.nilai_pk || null,
    status_ckp: emp.status_ckp || 'draft',
    isi_hari_ini: today_count > 0
  }));

  res.json(result);
});

module.exports = router;
