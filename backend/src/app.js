require('dotenv').config();
require('express-async-errors'); // teruskan error dari handler async ke error handler
const express = require('express');
const cors = require('cors');
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

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? (process.env.FRONTEND_URL === '*' ? true : process.env.FRONTEND_URL.split(',').map(s => s.trim()))
    : true,
  credentials: true
}));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Health check (tanpa database)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SI-CKP API running', timestamp: new Date().toISOString() });
});

// Pastikan database siap (tabel dibuat sekali per instance)
app.use('/api', async (req, res, next) => {
  await initDatabase();
  next();
});

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
