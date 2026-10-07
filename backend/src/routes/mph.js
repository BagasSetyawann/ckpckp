const express = require('express');
const { getDb, saveDb } = require('../db/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const XLSX = require('xlsx');

const router = express.Router();

// POST /api/mph/parse - Parse uploaded MPH Excel and return preview data
router.post('/parse', authenticate, requireRole('KPA', 'Kasubbag'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File MPH belum dipilih' });

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Parse sheet into array of arrays (raw rows)
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawData.length < 10) {
      return res.status(400).json({ error: 'File MPH tidak memiliki format yang benar. Minimal 10 baris diperlukan (header + data).' });
    }

    // Try to detect MPH structure
    const parsed = parseMPHStructure(rawData);
    res.json(parsed);
  } catch (err) {
    console.error('MPH parse error:', err);
    res.status(500).json({ error: 'Gagal memproses file MPH: ' + err.message });
  }
});

// POST /api/mph/import - Import parsed MPH data as RK entries
router.post('/import', authenticate, requireRole('KPA', 'Kasubbag'), (req, res) => {
  const { period_id, entries } = req.body;
  if (!period_id || !entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Data tidak lengkap. Diperlukan period_id dan entries.' });
  }

  const db = getDb();

  // Validate period exists
  const period = db.prepare('SELECT id FROM periods WHERE id = ?').get(period_id);
  if (!period) return res.status(404).json({ error: 'Periode tidak ditemukan' });

  let created = 0;
  let skipped = 0;
  const errors = [];

  entries.forEach((entry, idx) => {
    try {
      const { employee_id, kode, nama, deskripsi, indikator, target, satuan, bobot } = entry;

      if (!employee_id || !nama) {
        skipped++;
        errors.push(`Baris ${idx + 1}: employee_id atau nama kosong`);
        return;
      }

      // Check if employee exists
      const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(employee_id);
      if (!emp) {
        skipped++;
        errors.push(`Baris ${idx + 1}: Pegawai dengan ID ${employee_id} tidak ditemukan`);
        return;
      }

      // Check for duplicate
      const existing = db.prepare(
        'SELECT id FROM performance_plans WHERE employee_id = ? AND period_id = ? AND nama = ?'
      ).get(employee_id, period_id, nama);

      if (existing) {
        skipped++;
        errors.push(`Baris ${idx + 1}: RK "${nama}" sudah ada untuk pegawai ini di periode ini`);
        return;
      }

      const result = db.prepare(`
        INSERT INTO performance_plans (employee_id, period_id, kode, nama, deskripsi, indikator, target, satuan, bobot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        employee_id, period_id,
        kode || null, nama,
        deskripsi || null, indikator || null,
        target || 100, satuan || 'Persen',
        bobot || 0
      );

      if (result.lastInsertRowid) {
        const plan = db.prepare('SELECT * FROM performance_plans WHERE id = ?').get(result.lastInsertRowid);
        logActivity(req.user.id, 'IMPORT_MPH_RK', 'performance_plans', result.lastInsertRowid, null, plan);
        created++;
      }
    } catch (err) {
      skipped++;
      errors.push(`Baris ${idx + 1}: ${err.message}`);
    }
  });

  saveDb();

  res.json({
    message: `Import selesai. ${created} RK berhasil dibuat, ${skipped} dilewati.`,
    created,
    skipped,
    errors: errors.length > 0 ? errors : undefined
  });
});

// POST /api/mph/import-manual - Import from manual MPH form (simplified)
router.post('/import-manual', authenticate, requireRole('KPA', 'Kasubbag'), (req, res) => {
  const { period_id, projects } = req.body;
  if (!period_id || !projects || !Array.isArray(projects) || projects.length === 0) {
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }

  const db = getDb();

  const period = db.prepare('SELECT id FROM periods WHERE id = ?').get(period_id);
  if (!period) return res.status(404).json({ error: 'Periode tidak ditemukan' });

  let created = 0;
  let skipped = 0;
  const errors = [];

  projects.forEach((project) => {
    const { proyek_nama, rencana_kerja_items } = project;
    if (!rencana_kerja_items || !Array.isArray(rencana_kerja_items)) return;

    rencana_kerja_items.forEach((rk) => {
      const { employee_ids, nama, indikator, target, satuan, bobot } = rk;
      if (!employee_ids || !Array.isArray(employee_ids) || !nama) {
        skipped++;
        return;
      }

      employee_ids.forEach(employee_id => {
        try {
          const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(employee_id);
          if (!emp) {
            skipped++;
            errors.push(`Pegawai ID ${employee_id} tidak ditemukan`);
            return;
          }

          const existing = db.prepare(
            'SELECT id FROM performance_plans WHERE employee_id = ? AND period_id = ? AND nama = ?'
          ).get(employee_id, period_id, nama);

          if (existing) {
            skipped++;
            return;
          }

          const kode = `RK-${String(created + 1).padStart(2, '0')}`;
          const result = db.prepare(`
            INSERT INTO performance_plans (employee_id, period_id, kode, nama, deskripsi, indikator, target, satuan, bobot)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            employee_id, period_id, kode, nama,
            proyek_nama ? `Proyek: ${proyek_nama}` : null,
            indikator || null,
            target || 100, satuan || 'Persen',
            bobot || 0
          );

          if (result.lastInsertRowid) {
            const plan = db.prepare('SELECT * FROM performance_plans WHERE id = ?').get(result.lastInsertRowid);
            logActivity(req.user.id, 'IMPORT_MPH_MANUAL_RK', 'performance_plans', result.lastInsertRowid, null, plan);
            created++;
          }
        } catch (err) {
          skipped++;
          errors.push(err.message);
        }
      });
    });
  });

  saveDb();

  res.json({
    message: `Import selesai. ${created} RK berhasil dibuat, ${skipped} dilewati.`,
    created,
    skipped,
    errors: errors.length > 0 ? errors : undefined
  });
});

// Helper: parse MPH structure from raw Excel data
function parseMPHStructure(rawData) {
  const result = {
    header: {
      tujuan: '',
      sasaran_strategis: '',
      sasaran_program: '',
      sasaran_kegiatan: '',
      indikator_sasaran: '',
      rencana_kerja_ketua: '',
    },
    projects: [],
    personnel: [],
    rk_items: [],
  };

  // Try to find header info from first 9 rows
  for (let r = 0; r < Math.min(9, rawData.length); r++) {
    const row = rawData[r];
    const firstCell = String(row[0] || '').trim().toLowerCase();
    const secondCell = String(row[1] || '').trim();

    // Look for known keywords
    if (firstCell.includes('tujuan')) {
      result.header.tujuan = secondCell || String(row[2] || '').trim();
    }
    if (firstCell.includes('sasaran strategis')) {
      result.header.sasaran_strategis = secondCell || String(row[2] || '').trim();
    }
    if (firstCell.includes('sasaran program')) {
      result.header.sasaran_program = secondCell || String(row[2] || '').trim();
    }
    if (firstCell.includes('sasaran kegiatan')) {
      result.header.sasaran_kegiatan = secondCell || String(row[2] || '').trim();
    }
    if (firstCell.includes('indikator')) {
      result.header.indikator_sasaran = secondCell || String(row[2] || '').trim();
    }
    if (firstCell.includes('rencana kerja ketua') || firstCell.includes('rk ketua')) {
      result.header.rencana_kerja_ketua = secondCell || String(row[2] || '').trim();
    }

    // Try to detect project names from header columns
    for (let c = 1; c < row.length; c++) {
      const cellValue = String(row[c] || '').trim();
      if (cellValue.length > 5 && (
        cellValue.toLowerCase().includes('survei') ||
        cellValue.toLowerCase().includes('pendataan') ||
        cellValue.toLowerCase().includes('sensus') ||
        cellValue.toLowerCase().includes('proyek') ||
        cellValue.toLowerCase().includes('sakernas') ||
        cellValue.toLowerCase().includes('susenas')
      )) {
        if (!result.projects.find(p => p.nama === cellValue)) {
          result.projects.push({ nama: cellValue, kolom: c });
        }
      }
    }
  }

  // Look for RK items in header rows (rows that mention rencana kerja anggota or specific tasks)
  for (let r = 0; r < Math.min(9, rawData.length); r++) {
    const row = rawData[r];
    for (let c = 1; c < row.length; c++) {
      const cellValue = String(row[c] || '').trim();
      if (cellValue.length > 10 && (
        cellValue.toLowerCase().includes('identifikasi') ||
        cellValue.toLowerCase().includes('rekrutmen') ||
        cellValue.toLowerCase().includes('pelatihan') ||
        cellValue.toLowerCase().includes('pendataan') ||
        cellValue.toLowerCase().includes('pengolahan') ||
        cellValue.toLowerCase().includes('evaluasi') ||
        cellValue.toLowerCase().includes('penyelesaian') ||
        cellValue.toLowerCase().includes('persentase')
      )) {
        result.rk_items.push({
          nama: cellValue,
          kolom: c,
          baris: r,
          project: result.projects.find(p => Math.abs(p.kolom - c) < 5)?.nama || 'Umum'
        });
      }
    }
  }

  // Parse personnel data (rows after header, typically from row 9+)
  for (let r = 9; r < rawData.length; r++) {
    const row = rawData[r];
    const firstCell = String(row[0] || '').trim();
    if (!firstCell || firstCell.length < 3) continue;

    // Skip rows that are clearly labels
    if (firstCell.toLowerCase().includes('indikator') || firstCell.toLowerCase().includes('keterangan')) continue;

    const person = {
      nama: firstCell,
      baris: r,
      indicators: [],
    };

    // Map indicators from each column
    for (let c = 1; c < row.length; c++) {
      const cellValue = String(row[c] || '').trim();
      if (cellValue && cellValue.length > 3) {
        const rkItem = result.rk_items.find(rk => rk.kolom === c);
        person.indicators.push({
          kolom: c,
          value: cellValue,
          rk_nama: rkItem?.nama || `Indikator kolom ${c}`,
          project: rkItem?.project || 'Umum',
        });
      }
    }

    if (person.indicators.length > 0 || firstCell.length > 3) {
      result.personnel.push(person);
    }
  }

  return result;
}

module.exports = router;
