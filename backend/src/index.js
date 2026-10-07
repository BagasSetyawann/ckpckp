require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const periodsRoutes = require('./routes/periods');
const performancePlansRoutes = require('./routes/performancePlans');
const activitiesRoutes = require('./routes/activities');
const evidenceRoutes = require('./routes/evidence');
const verificationsRoutes = require('./routes/verifications');
const behaviorRoutes = require('./routes/behavior');
const ckpConfigRoutes = require('./routes/ckpConfig');
const scoresRoutes = require('./routes/scores');
const dashboardRoutes = require('./routes/dashboard');
const activityLogRoutes = require('./routes/activityLog');
const exportRoutes = require('./routes/export');
const mphRoutes = require('./routes/mph');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL 
    ? (process.env.FRONTEND_URL === '*' ? true : process.env.FRONTEND_URL.split(',').map(s => s.trim()))
    : true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/periods', periodsRoutes);
app.use('/api/performance-plans', performancePlansRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/verifications', verificationsRoutes);
app.use('/api/behavior', behaviorRoutes);
app.use('/api/ckp-config', ckpConfigRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity-log', activityLogRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/mph', mphRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SI-CKP API running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Async startup — required for sql.js (WebAssembly)
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\uD83D\uDE80 SI-CKP API Server running on http://localhost:${PORT}`);
      console.log(`\uD83D\uDCCA Database: sql.js (WebAssembly SQLite)`);
      console.log(`\uD83C\uDF0D Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });
  } catch (err) {
    console.error('\u274C Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
