const router = require('express').Router();
const ctrl   = require('../controllers/requestController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// POST /api/requests
router.post(
  '/',
  verifyToken,
  requireRole('STUDENT'),
  ctrl.create
);

// GET /api/requests/my   ← before /:id to avoid param collision
router.get(
  '/my',
  verifyToken,
  requireRole('STUDENT'),
  ctrl.getMy
);

// POST /api/requests/manual — secretary creates on behalf of student
router.post(
  '/manual',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.createForStudent
);

// GET /api/requests
router.get(
  '/',
  verifyToken,
  requireRole('SECRETAIRE', 'DIRECTEUR', 'ADMIN'),
  ctrl.getAll
);

// GET /api/requests/ready-for-secretary  ← before /:id to avoid collision
router.get(
  '/ready-for-secretary',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.getReadyForSecretary
);

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

// POST /api/requests/:id/forward — secretary forwards EN_ATTENTE → EN_TRAITEMENT
router.post(
  '/:id/forward',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.forward
);

// PUT /api/requests/:id/schedule — secretary schedules pickup for APPROUVE → PRET
router.put(
  '/:id/schedule',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.schedulePickup
);

// PUT /api/requests/:id/send-pdf — secretary marks PDF sent for APPROUVE → PRET
router.put(
  '/:id/send-pdf',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.sendPdf
);

module.exports = router;
