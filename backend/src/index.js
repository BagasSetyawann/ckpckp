// Server lokal (development). Di Vercel, app dijalankan lewat /api/index.js
const app = require('./app');
const { initDatabase } = require('./db/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 SI-CKP API Server running on http://localhost:${PORT}`);
      console.log('📊 Database: PostgreSQL (Supabase)');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
