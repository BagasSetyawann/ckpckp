const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const XLSX = require('xlsx');

const router = express.Router();

function getEmployeeData(db, empId, periodId) {
  const employee = db.prepare('SELECT e.*, u.username FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = ?').get(empId);
  const period = db.prepare('SELECT * FROM periods WHERE id = ?').get(periodId);
  const plans = db.prepare('SELECT * FROM performance_plans WHERE employee_id = ? AND period_id = ?').all(empId, periodId);
  const activities = db.prepare(`
    SELECT da.*, pp.nama as pk_nama, pp.kode as pk_kode, v.status as verif_status
    FROM daily_activities da
    LEFT JOIN performance_plans pp ON da.performance_plan_id = pp.id
    LEFT JOIN verifications v ON v.activity_id = da.id
    WHERE da.employee_id = ? AND da.period_id = ?
    ORDER BY da.tanggal
  `).all(empId, periodId);
  const behavior = db.prepare('SELECT * FROM behavior_assessments WHERE employee_id = ? AND period_id = ?').get(empId, periodId);
  const ckp = db.prepare('SELECT * FROM monthly_ckp_scores WHERE employee_id = ? AND period_id = ?').get(empId, periodId);
  return { employee, period, plans, activities, behavior, ckp };
}

// GET /api/export/excel
router.get('/excel', authenticate, (req, res) => {
  const db = getDb();
  const { period_id, employee_id } = req.query;
  if (!period_id) return res.status(400).json({ error: 'period_id wajib diisi' });

  const empId = req.user.role === 'Anggota' ? req.user.employeeId : (employee_id ? parseInt(employee_id) : null);
  
  const wb = XLSX.utils.book_new();

  const employeeList = empId
    ? [db.prepare('SELECT id FROM employees WHERE id = ?').get(empId)].filter(Boolean)
    : db.prepare(`SELECT e.id FROM employees e JOIN users u ON e.user_id = u.id JOIN roles r ON u.role_id = r.id WHERE r.name = 'Anggota' AND u.is_active = 1`).all();

  employeeList.forEach(({ id }) => {
    const { employee, period, plans, activities, behavior, ckp } = getEmployeeData(db, id, period_id);
    if (!employee) return;

    // Sheet: Kegiatan Harian
    const actRows = activities.map(a => ({
      Tanggal: a.tanggal,
      'Nama Kegiatan': a.nama_kegiatan,
      'PK/Rencana Kinerja': a.pk_nama || '-',
      Kode: a.pk_kode || '-',
      Target: a.target || '-',
      Satuan: a.satuan || '-',
      Realisasi: a.realisasi || '-',
      'Capaian (%)': a.persentase_capaian || 0,
      Status: a.status_kegiatan,
      'Status Verifikasi': a.verif_status || 'Belum diverifikasi',
    }));

    const ws1 = XLSX.utils.json_to_sheet(actRows);
    XLSX.utils.book_append_sheet(wb, ws1, `Kegiatan_${employee.nama.slice(0, 15)}`);

    // Sheet: Rekap PK
    const pkRows = plans.map(p => {
      const realisasi = db.prepare('SELECT COALESCE(SUM(realisasi), 0) as total FROM daily_activities WHERE performance_plan_id = ? AND employee_id = ?').get(p.id, id).total;
      const capaian = p.target > 0 ? Math.min(Math.round((realisasi / p.target) * 100), 100) : 0;
      return {
        Kode: p.kode, 'Nama PK': p.nama, 'Indikator': p.indikator,
        Target: p.target, Satuan: p.satuan, Realisasi: realisasi,
        'Capaian (%)': capaian, Bobot: p.bobot
      };
    });

    const ws2 = XLSX.utils.json_to_sheet(pkRows);
    XLSX.utils.book_append_sheet(wb, ws2, `PK_${employee.nama.slice(0, 15)}`);
  });

  // Sheet: Rekap CKP Semua Pegawai
  if (!empId || req.user.role !== 'Anggota') {
    const rekapRows = employeeList.map(({ id }) => {
      const { employee, ckp, behavior } = getEmployeeData(db, id, period_id);
      return {
        NIP: employee?.nip || '-',
        Nama: employee?.nama,
        Jabatan: employee?.jabatan,
        'Unit Kerja': employee?.unit_kerja,
        'Nilai PK': ckp?.nilai_pk || '-',
        'Nilai Perilaku': behavior?.nilai_akhir || '-',
        'Nilai CKP': ckp?.nilai_ckp || '-',
        'Status': ckp?.status || 'draft',
      };
    });
    const ws3 = XLSX.utils.json_to_sheet(rekapRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Rekap_CKP');
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="Rekap_CKP_${period_id}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// GET /api/export/pdf — Simple HTML-based print export
router.get('/pdf-data', authenticate, (req, res) => {
  const db = getDb();
  const { period_id, employee_id } = req.query;
  if (!period_id) return res.status(400).json({ error: 'period_id wajib diisi' });

  const empId = req.user.role === 'Anggota' ? req.user.employeeId : (employee_id ? parseInt(employee_id) : null);

  const employeeList = empId
    ? [{ id: empId }]
    : db.prepare(`SELECT e.id FROM employees e JOIN users u ON e.user_id = u.id JOIN roles r ON u.role_id = r.id WHERE r.name = 'Anggota' AND u.is_active = 1`).all();

  const data = employeeList.map(({ id }) => getEmployeeData(db, id, period_id));
  res.json(data);
});

module.exports = router;
