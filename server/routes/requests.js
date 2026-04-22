const router = require('express').Router();
const ctrl   = require('../controllers/requestController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const upload = require('../middleware/upload');

// ── PUBLIC (no auth) — must be FIRST before any /:id routes ──────────────────

// GET /api/requests/confirm/:token — student confirms document reception
router.get('/confirm/:token', ctrl.confirmReception);

// GET /api/requests/test-token — diagnostic only
router.get('/test-token', async (_req, res) => {
  const db = require('../config/db');
  try {
    const { rows } = await db.query(`
      SELECT id, statut, confirmation_token,
             confirmation_token_expiry
      FROM requests
      WHERE confirmation_token IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 3
    `);
    res.json({ tokens: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests/debug-confirm/:token — diagnostic only
router.get('/debug-confirm/:token', async (req, res) => {
  const { token } = req.params;
  const db = require('../config/db');
  console.log('Debug token:', token);
  console.log('Token length:', token.length);
  try {
    const { rows } = await db.query(`
      SELECT id, statut,
             confirmation_token,
             confirmation_token = $1 AS exact_match,
             LENGTH(confirmation_token) AS db_length,
             $2::int AS url_length
      FROM requests
      WHERE confirmation_token IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 3
    `, [token, token.length]);
    res.json({ token_received: token, token_length: token.length, matches: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Protected routes ──────────────────────────────────────────────────────────

// GET /api/requests
router.get(
  '/',
  verifyToken,
  requireRole('SECRETAIRE', 'DIRECTEUR', 'ADMIN'),
  ctrl.getAll
);

// GET /api/requests/my
router.get(
  '/my',
  verifyToken,
  requireRole('STUDENT', 'CHEF_CLASSE'),
  ctrl.getMy
);

// GET /api/requests/ready-for-secretary
router.get(
  '/ready-for-secretary',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.getReadyForSecretary
);

// POST /api/requests
router.post(
  '/',
  verifyToken,
  requireRole('STUDENT', 'CHEF_CLASSE'),
  ctrl.create
);

// POST /api/requests/manual — secretary creates on behalf of student
router.post(
  '/manual',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.createForStudent
);

// ── Routes with :id — AFTER all fixed-path routes ────────────────────────────

// GET /api/requests/:id
router.get(
  '/:id',
  verifyToken,
  requireRole('STUDENT', 'SECRETAIRE', 'DIRECTEUR', 'ADMIN'),
  ctrl.getById
);

// PUT /api/requests/:id/statut
router.put(
  '/:id/statut',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.updateStatut
);

// POST /api/requests/:id/forward
router.post(
  '/:id/forward',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.forward
);

// PUT /api/requests/:id/schedule
router.put(
  '/:id/schedule',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.schedulePickup
);

// PUT /api/requests/:id/send-pdf
router.put(
  '/:id/send-pdf',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  upload.single('document'),
  ctrl.sendPdf
);

// PUT /api/requests/:id/reopen
router.put(
  '/:id/reopen',
  verifyToken,
  requireRole('CAISSE', 'IT', 'LABORATOIRE'),
  ctrl.reopenRequest
);

module.exports = router;
