// Jalankan: npm run db:init
// Membuat semua tabel + data awal di Supabase, dan memastikan bucket Storage tersedia.
require('dotenv').config();
const { initDatabase, closeDb } = require('./database');
const { ensureBucket } = require('../utils/storage');

(async () => {
  try {
    await initDatabase();
    await ensureBucket();
    console.log('🎉 Inisialisasi Supabase selesai.');
  } catch (err) {
    console.error('❌ Gagal inisialisasi:', err.message);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
