const bcrypt = require('bcryptjs');

function seedInitialData(db) {
  console.log('🌱 Seeding initial data...');

  // Seed Roles
  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)');
  insertRole.run('KPA', 'Kuasa Pengguna Anggaran - Admin Penilai dengan akses penuh');
  insertRole.run('Kasubbag', 'Kepala Sub Bagian - Atasan dengan akses monitoring');
  insertRole.run('Anggota', 'Pegawai - Akses terbatas pada data sendiri');

  const roles = db.prepare('SELECT id, name FROM roles').all();
  const roleMap = {};
  roles.forEach(r => roleMap[r.name] = r.id);

  // Seed Users & Employees
  const password = bcrypt.hashSync('password123', 10);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password_hash, role_id) VALUES (?, ?, ?)
  `);
  const insertEmployee = db.prepare(`
    INSERT OR IGNORE INTO employees (user_id, nip, nama, jabatan, unit_kerja, golongan, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const users = [
    { username: 'admin', role: 'KPA', nip: null, nama: 'Dr. Ahmad Fauzi, M.Si', jabatan: 'Kepala Dinas', unit: 'Dinas Statistik Daerah', golongan: 'IV/c', email: 'admin@dinasstat.go.id' },
    { username: 'kasubbag', role: 'Kasubbag', nip: '197805202005011001', nama: 'Ir. Hendra Kurniawan', jabatan: 'Kasubbag Umum & Kepegawaian', unit: 'Sub Bagian Umum', golongan: 'III/d', email: 'hendra@dinasstat.go.id' },
    { username: 'budi', role: 'Anggota', nip: '198501012010011001', nama: 'Budi Santoso, S.Stat', jabatan: 'Statistisi Ahli Muda', unit: 'Bidang Neraca Wilayah', golongan: 'III/c', email: 'budi@dinasstat.go.id' },
    { username: 'sari', role: 'Anggota', nip: '199203152015022002', nama: 'Sari Dewi Lestari, S.E', jabatan: 'Analis Kebijakan', unit: 'Bidang Neraca Wilayah', golongan: 'III/b', email: 'sari@dinasstat.go.id' },
    { username: 'reza', role: 'Anggota', nip: '199507202018011003', nama: 'Reza Firmansyah, S.T', jabatan: 'Pranata Komputer Ahli Pertama', unit: 'Bidang IPDS', golongan: 'III/a', email: 'reza@dinasstat.go.id' },
    { username: 'dewi', role: 'Anggota', nip: '198812102012012004', nama: 'Dewi Rahayu, S.Sos', jabatan: 'Statistisi Ahli Pertama', unit: 'Bidang Sosial', golongan: 'III/b', email: 'dewi@dinasstat.go.id' },
  ];

  users.forEach(u => {
    const userResult = insertUser.run(u.username, password, roleMap[u.role]);
    const userId = userResult.lastInsertRowid || db.prepare('SELECT id FROM users WHERE username = ?').get(u.username)?.id;
    if (userId) {
      insertEmployee.run(userId, u.nip, u.nama, u.jabatan, u.unit, u.golongan, u.email);
    }
  });

  // Seed CKP Components
  const insertComponent = db.prepare(`
    INSERT OR IGNORE INTO ckp_components (kode, nama, deskripsi, urutan) VALUES (?, ?, ?, ?)
  `);
  insertComponent.run('PK', 'Nilai Capaian Kinerja (PK)', 'Nilai berdasarkan capaian target rencana kinerja', 1);
  insertComponent.run('PERILAKU', 'Nilai Perilaku Kerja', 'Nilai berdasarkan penilaian aspek perilaku', 2);

  // Seed Periods (Jan - Sep 2026)
  const insertPeriod = db.prepare(`
    INSERT OR IGNORE INTO periods (nama, tahun, bulan, tanggal_mulai, tanggal_akhir, batas_pengisian, status, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const months = [
    { bulan: 1, nama: 'Januari 2026', mulai: '2026-01-01', akhir: '2026-01-31', batas: '2026-02-05', status: 'tutup', active: 0 },
    { bulan: 2, nama: 'Februari 2026', mulai: '2026-02-01', akhir: '2026-02-28', batas: '2026-03-05', status: 'tutup', active: 0 },
    { bulan: 3, nama: 'Maret 2026', mulai: '2026-03-01', akhir: '2026-03-31', batas: '2026-04-05', status: 'tutup', active: 0 },
    { bulan: 4, nama: 'April 2026', mulai: '2026-04-01', akhir: '2026-04-30', batas: '2026-05-05', status: 'tutup', active: 0 },
    { bulan: 5, nama: 'Mei 2026', mulai: '2026-05-01', akhir: '2026-05-31', batas: '2026-06-05', status: 'tutup', active: 0 },
    { bulan: 6, nama: 'Juni 2026', mulai: '2026-06-01', akhir: '2026-06-30', batas: '2026-07-05', status: 'tutup', active: 0 },
    { bulan: 7, nama: 'Juli 2026', mulai: '2026-07-01', akhir: '2026-07-31', batas: '2026-08-05', status: 'tutup', active: 0 },
    { bulan: 8, nama: 'Agustus 2026', mulai: '2026-08-01', akhir: '2026-08-31', batas: '2026-09-05', status: 'tutup', active: 0 },
    { bulan: 9, nama: 'September 2026', mulai: '2026-09-01', akhir: '2026-09-30', batas: '2026-10-05', status: 'aktif', active: 1 },
  ];

  months.forEach(m => {
    insertPeriod.run(m.nama, 2026, m.bulan, m.mulai, m.akhir, m.batas, m.status, m.active);
  });

  const activePeriod = db.prepare('SELECT id FROM periods WHERE is_active = 1').get();
  if (!activePeriod) return;
  const periodId = activePeriod.id;

  // Seed CKP Weights for active period
  const insertWeight = db.prepare(`
    INSERT OR IGNORE INTO ckp_weights (period_id, component_id, bobot)
    SELECT ?, id, ? FROM ckp_components WHERE kode = ?
  `);
  insertWeight.run(periodId, 80, 'PK');
  insertWeight.run(periodId, 20, 'PERILAKU');

  // Get employee IDs
  const employees = db.prepare(`
    SELECT e.id, e.nama, u.username FROM employees e JOIN users u ON e.user_id = u.id
  `).all();
  const empMap = {};
  employees.forEach(e => empMap[e.username] = e);

  // Seed Performance Plans for active period (for budi, sari, reza, dewi)
  const insertPlan = db.prepare(`
    INSERT OR IGNORE INTO performance_plans 
    (employee_id, period_id, kode, nama, deskripsi, indikator, target, satuan, bobot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const plansData = {
    budi: [
      { kode: 'PK-01', nama: 'Penyediaan Data Statistik Sektoral', desc: 'Menyediakan data statistik untuk sektor ekonomi', indikator: 'Jumlah laporan data statistik', target: 10, satuan: 'Laporan', bobot: 35 },
      { kode: 'PK-02', nama: 'Pemeriksaan dan Validasi Data', desc: 'Memeriksa dan memvalidasi data hasil survei', indikator: 'Jumlah data tervalidasi', target: 500, satuan: 'Rekaman data', bobot: 35 },
      { kode: 'PK-03', nama: 'Koordinasi dengan Stakeholder', desc: 'Melakukan koordinasi dengan instansi terkait', indikator: 'Jumlah rapat/koordinasi', target: 12, satuan: 'Kegiatan', bobot: 30 },
    ],
    sari: [
      { kode: 'PK-01', nama: 'Penyusunan Laporan Keuangan', desc: 'Menyusun laporan keuangan bulanan', indikator: 'Jumlah laporan keuangan', target: 12, satuan: 'Laporan', bobot: 40 },
      { kode: 'PK-02', nama: 'Analisis Kebijakan Anggaran', desc: 'Menganalisis kebijakan penganggaran', indikator: 'Jumlah dokumen analisis', target: 4, satuan: 'Dokumen', bobot: 35 },
      { kode: 'PK-03', nama: 'Administrasi Kepegawaian', desc: 'Mengelola administrasi kepegawaian', indikator: 'Jumlah berkas terproses', target: 50, satuan: 'Berkas', bobot: 25 },
    ],
    reza: [
      { kode: 'PK-01', nama: 'Pengelolaan Sistem Informasi', desc: 'Mengelola dan mengembangkan sistem informasi', indikator: 'Jumlah sistem yang dikelola', target: 5, satuan: 'Sistem', bobot: 40 },
      { kode: 'PK-02', nama: 'Pemeliharaan Infrastruktur IT', desc: 'Memelihara infrastruktur teknologi informasi', indikator: 'Uptime sistem (%)', target: 99, satuan: 'Persen', bobot: 35 },
      { kode: 'PK-03', nama: 'Pelatihan dan Sosialisasi IT', desc: 'Memberikan pelatihan penggunaan sistem', indikator: 'Jumlah peserta pelatihan', target: 30, satuan: 'Orang', bobot: 25 },
    ],
    dewi: [
      { kode: 'PK-01', nama: 'Survei Sosial Kemasyarakatan', desc: 'Melaksanakan survei sosial di lapangan', indikator: 'Jumlah responden survei', target: 200, satuan: 'Responden', bobot: 40 },
      { kode: 'PK-02', nama: 'Pengolahan Data Sosial', desc: 'Mengolah data hasil survei sosial', indikator: 'Jumlah data terproses', target: 200, satuan: 'Rekaman', bobot: 35 },
      { kode: 'PK-03', nama: 'Penyusunan Publikasi Sosial', desc: 'Menyusun publikasi data sosial', indikator: 'Jumlah publikasi', target: 2, satuan: 'Publikasi', bobot: 25 },
    ],
  };

  const planIds = {};
  Object.keys(plansData).forEach(username => {
    if (!empMap[username]) return;
    const empId = empMap[username].id;
    planIds[username] = [];
    plansData[username].forEach(p => {
      const result = insertPlan.run(empId, periodId, p.kode, p.nama, p.desc, p.indikator, p.target, p.satuan, p.bobot);
      const planId = result.lastInsertRowid || db.prepare(
        'SELECT id FROM performance_plans WHERE employee_id = ? AND kode = ? AND period_id = ?'
      ).get(empId, p.kode, periodId)?.id;
      planIds[username].push({ id: planId, target: p.target, satuan: p.satuan });
    });
  });

  // Seed Daily Activities for September 2026 (days 1-15)
  const insertActivity = db.prepare(`
    INSERT OR IGNORE INTO daily_activities
    (employee_id, performance_plan_id, period_id, tanggal, nama_kegiatan, deskripsi, target, satuan, realisasi, persentase_capaian, status_kegiatan, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVerif = db.prepare(`
    INSERT OR IGNORE INTO verifications (activity_id, verified_by, status, catatan, verified_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const kpaUserId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')?.id;

  const activitiesData = {
    budi: [
      { date: '2026-09-01', pkIdx: 0, kegiatan: 'Pengumpulan data statistik dari dinas terkait', target: 2, real: 2, status: 'selesai', verified: true },
      { date: '2026-09-01', pkIdx: 1, kegiatan: 'Pemeriksaan data hasil survei ekonomi', target: 50, real: 50, status: 'selesai', verified: true },
      { date: '2026-09-02', pkIdx: 0, kegiatan: 'Kompilasi data laporan bulanan', target: 1, real: 1, status: 'selesai', verified: true },
      { date: '2026-09-02', pkIdx: 1, kegiatan: 'Validasi data rekaman survei batch 1', target: 40, real: 38, status: 'selesai', verified: true },
      { date: '2026-09-03', pkIdx: 1, kegiatan: 'Validasi data rekaman survei batch 2', target: 40, real: 40, status: 'selesai', verified: true },
      { date: '2026-09-04', pkIdx: 2, kegiatan: 'Rapat koordinasi dengan Dinas Perindustrian', target: 1, real: 1, status: 'selesai', verified: true },
      { date: '2026-09-05', pkIdx: 0, kegiatan: 'Penyusunan laporan statistik sektor pertanian', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-08', pkIdx: 1, kegiatan: 'Pemeriksaan data rekaman survei batch 3', target: 45, real: 42, status: 'selesai', verified: false },
      { date: '2026-09-09', pkIdx: 0, kegiatan: 'Finalisasi laporan statistik sektor perdagangan', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-10', pkIdx: 2, kegiatan: 'Koordinasi dengan BPS Pusat via video conference', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-11', pkIdx: 1, kegiatan: 'Validasi data batch 4', target: 50, real: 47, status: 'selesai', verified: false },
      { date: '2026-09-12', pkIdx: 0, kegiatan: 'Penyusunan laporan statistik industri', target: 1, real: 1, status: 'dalam_proses', verified: false },
      { date: '2026-09-15', pkIdx: 1, kegiatan: 'Pemeriksaan data batch 5', target: 50, real: 40, status: 'dalam_proses', verified: false },
    ],
    sari: [
      { date: '2026-09-01', pkIdx: 0, kegiatan: 'Penyusunan laporan keuangan Agustus 2026', target: 1, real: 1, status: 'selesai', verified: true },
      { date: '2026-09-02', pkIdx: 2, kegiatan: 'Pengurusan berkas kenaikan pangkat pegawai', target: 5, real: 5, status: 'selesai', verified: true },
      { date: '2026-09-03', pkIdx: 1, kegiatan: 'Analisis kebijakan anggaran triwulan III', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-04', pkIdx: 2, kegiatan: 'Administrasi surat menyurat kepegawaian', target: 8, real: 8, status: 'selesai', verified: false },
      { date: '2026-09-05', pkIdx: 0, kegiatan: 'Rekonsiliasi data keuangan dengan BPKAD', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-08', pkIdx: 2, kegiatan: 'Pengurusan berkas cuti pegawai', target: 6, real: 6, status: 'selesai', verified: false },
      { date: '2026-09-09', pkIdx: 1, kegiatan: 'Review dokumen analisis kebijakan', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-10', pkIdx: 2, kegiatan: 'Administrasi absensi dan kehadiran', target: 4, real: 4, status: 'selesai', verified: false },
      { date: '2026-09-15', pkIdx: 0, kegiatan: 'Persiapan laporan keuangan September', target: 1, real: 0, status: 'dalam_proses', verified: false },
    ],
    reza: [
      { date: '2026-09-01', pkIdx: 0, kegiatan: 'Monitoring sistem informasi SIPD', target: 1, real: 1, status: 'selesai', verified: true },
      { date: '2026-09-02', pkIdx: 1, kegiatan: 'Pemeliharaan server dan backup data', target: 99, real: 99, status: 'selesai', verified: true },
      { date: '2026-09-03', pkIdx: 0, kegiatan: 'Update sistem aplikasi e-office', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-04', pkIdx: 2, kegiatan: 'Pelatihan penggunaan aplikasi baru untuk staf', target: 5, real: 5, status: 'selesai', verified: false },
      { date: '2026-09-05', pkIdx: 1, kegiatan: 'Pengecekan jaringan dan koneksi internet', target: 99, real: 98, status: 'selesai', verified: false },
      { date: '2026-09-08', pkIdx: 0, kegiatan: 'Pengembangan fitur laporan sistem informasi', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-09', pkIdx: 2, kegiatan: 'Sosialisasi keamanan data kepada pegawai', target: 8, real: 8, status: 'selesai', verified: false },
      { date: '2026-09-10', pkIdx: 1, kegiatan: 'Monitoring uptime dan performa sistem', target: 99, real: 100, status: 'selesai', verified: false },
      { date: '2026-09-11', pkIdx: 0, kegiatan: 'Debugging dan perbaikan bug sistem', target: 1, real: 1, status: 'selesai', verified: false },
      { date: '2026-09-12', pkIdx: 2, kegiatan: 'Pelatihan IT untuk pegawai baru', target: 4, real: 4, status: 'selesai', verified: false },
      { date: '2026-09-15', pkIdx: 0, kegiatan: 'Perencanaan migrasi sistem ke cloud', target: 1, real: 0, status: 'dalam_proses', verified: false },
    ],
    dewi: [
      { date: '2026-09-01', pkIdx: 0, kegiatan: 'Survei sosial di Kecamatan Selatan', target: 20, real: 20, status: 'selesai', verified: true },
      { date: '2026-09-02', pkIdx: 1, kegiatan: 'Pengolahan data survei batch 1', target: 20, real: 20, status: 'selesai', verified: true },
      { date: '2026-09-03', pkIdx: 0, kegiatan: 'Survei sosial di Kecamatan Timur', target: 15, real: 15, status: 'selesai', verified: false },
      { date: '2026-09-04', pkIdx: 1, kegiatan: 'Pengolahan data survei batch 2', target: 15, real: 14, status: 'selesai', verified: false },
      { date: '2026-09-05', pkIdx: 0, kegiatan: 'Survei sosial di Kecamatan Barat', target: 18, real: 17, status: 'selesai', verified: false },
      { date: '2026-09-08', pkIdx: 1, kegiatan: 'Pengolahan data survei batch 3', target: 17, real: 15, status: 'selesai', verified: false },
      { date: '2026-09-09', pkIdx: 0, kegiatan: 'Survei lanjutan dan verifikasi lapangan', target: 10, real: 10, status: 'selesai', verified: false },
      { date: '2026-09-10', pkIdx: 2, kegiatan: 'Penyusunan draft publikasi data sosial', target: 1, real: 0, status: 'dalam_proses', verified: false },
      { date: '2026-09-15', pkIdx: 0, kegiatan: 'Survei sosial lanjutan Kecamatan Utara', target: 20, real: 12, status: 'dalam_proses', verified: false },
    ],
  };

  Object.keys(activitiesData).forEach(username => {
    if (!empMap[username] || !planIds[username]) return;
    const empId = empMap[username].id;
    activitiesData[username].forEach(a => {
      const plan = planIds[username][a.pkIdx];
      if (!plan) return;
      const capaian = plan.target > 0 ? Math.min((a.real / plan.target) * 100, 100) : 0;
      const result = insertActivity.run(
        empId, plan.id, periodId, a.date, a.kegiatan,
        `Melaksanakan ${a.kegiatan.toLowerCase()}`,
        a.target, plan.satuan, a.real, Math.round((a.real / a.target) * 100),
        a.status, null
      );
      const actId = result.lastInsertRowid;
      if (a.verified && actId && kpaUserId) {
        insertVerif.run(actId, kpaUserId, 'terverifikasi', 'Sudah sesuai dengan target', a.date + ' 16:00:00');
      }
    });
  });

  // Seed Behavior Assessments
  const insertBehavior = db.prepare(`
    INSERT OR IGNORE INTO behavior_assessments
    (employee_id, period_id, assessed_by, orientasi_pelayanan, akuntabel, kompeten, harmonis, loyal, adaptif, kolaboratif, nilai_akhir, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Previous months behavior (Aug 2026 = period_id -1 from active)
  const prevPeriod = db.prepare('SELECT id FROM periods WHERE bulan = 8 AND tahun = 2026').get();
  if (prevPeriod && kpaUserId) {
    const behaviorScores = [
      { username: 'budi', scores: [88, 85, 87, 90, 88, 86, 89] },
      { username: 'sari', scores: [92, 90, 88, 91, 89, 87, 92] },
      { username: 'reza', scores: [85, 88, 92, 87, 86, 90, 88] },
      { username: 'dewi', scores: [90, 87, 86, 92, 90, 88, 91] },
    ];
    behaviorScores.forEach(b => {
      if (!empMap[b.username]) return;
      const avg = b.scores.reduce((a, c) => a + c, 0) / b.scores.length;
      insertBehavior.run(empMap[b.username].id, prevPeriod.id, kpaUserId, ...b.scores, Math.round(avg * 10) / 10, 'Penilaian perilaku bulan Agustus 2026');
    });
  }

  // Seed System Settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)');
  insertSetting.run('app_name', 'SI-CKP', 'Nama aplikasi');
  insertSetting.run('app_subtitle', 'Sistem Informasi Capaian Kinerja Pegawai', 'Subtitle aplikasi');
  insertSetting.run('instansi', 'Dinas Statistik Daerah', 'Nama instansi');
  insertSetting.run('hari_kerja', 'senin,selasa,rabu,kamis,jumat', 'Hari kerja (pengisian wajib)');
  insertSetting.run('toleransi_hari', '3', 'Toleransi keterlambatan pengisian (hari)');
  insertSetting.run('kasubbag_can_verify', 'false', 'Apakah Kasubbag dapat melakukan verifikasi');
  insertSetting.run('reminder_enabled', 'true', 'Aktifkan reminder otomatis');

  // Seed Notifications for active users
  const insertNotif = db.prepare(`
    INSERT OR IGNORE INTO notifications (user_id, judul, pesan, jenis)
    VALUES (?, ?, ?, ?)
  `);
  const activeUsers = db.prepare('SELECT id, username FROM users WHERE is_active = 1').all();
  activeUsers.forEach(u => {
    insertNotif.run(u.id, 'Selamat Datang di SI-CKP', `Halo! Selamat datang di Sistem Informasi Capaian Kinerja Pegawai. Pastikan Anda mengisi kegiatan harian setiap hari kerja.`, 'info');
  });

  // Seed Activity Logs
  const insertLog = db.prepare(`
    INSERT INTO activity_logs (user_id, action, resource_type, resource_id, new_data)
    VALUES (?, ?, ?, ?, ?)
  `);
  if (kpaUserId) {
    insertLog.run(kpaUserId, 'SEED_DATA', 'system', null, JSON.stringify({ message: 'Initial data seeded' }));
  }

  console.log('✅ Seed data completed successfully!');
  console.log('📋 Demo accounts:');
  console.log('   admin / password123 (KPA)');
  console.log('   kasubbag / password123 (Kasubbag)');
  console.log('   budi / password123 (Anggota)');
  console.log('   sari / password123 (Anggota)');
  console.log('   reza / password123 (Anggota)');
  console.log('   dewi / password123 (Anggota)');
}

module.exports = { seedInitialData };
