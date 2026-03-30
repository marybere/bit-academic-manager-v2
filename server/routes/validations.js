const router = require('express').Router();
const ctrl   = require('../controllers/validationController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const VALIDATION_ROLES = ['CAISSE', 'IT', 'LABORATOIRE', 'SECRETAIRE'];

// GET /api/validations/pending   ← before /:requestId
router.get(
  '/pending',
  verifyToken,
  requireRole(...VALIDATION_ROLES, 'DIRECTEUR', 'ADMIN'),
  ctrl.getPending
);

// GET /api/validations/:requestId
router.get(
  '/:requestId',
  verifyToken,
  requireRole('STUDENT', ...VALIDATION_ROLES, 'DIRECTEUR', 'ADMIN'),
  ctrl.getByRequest
);

// POST /api/validations/:requestId
router.post(
  '/:requestId',
  verifyToken,
  requireRole(...VALIDATION_ROLES),
  ctrl.validate
);

module.exports = router;
