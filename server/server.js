require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const db      = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/admin/users', require('./routes/admin'));
app.use('/api/classes',     require('./routes/classes'));
app.use('/api/attendances', require('./routes/attendances'));
app.use('/api/requests',    require('./routes/requests'));
app.use('/api/validations', require('./routes/validations'));
app.use('/api/analytics',   require('./routes/analytics'));
app.use('/api/notifications', require('./routes/notifications'));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`BIT API running on http://localhost:${PORT}`);
});
