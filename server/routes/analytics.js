const router = require('express').Router();
const ctrl   = require('../controllers/analyticsController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// GET /api/analytics/absences
router.get(
  '/absences',
  verifyToken,
  requireRole('SECRETAIRE', 'DIRECTEUR', 'ADMIN'),
  ctrl.getAbsenceStats
);

// GET /api/analytics/requests
router.get(
  '/requests',
  verifyToken,
  requireRole('SECRETAIRE', 'DIRECTEUR', 'ADMIN'),
  ctrl.getRequestStats
);

module.exports = router;
