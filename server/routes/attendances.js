const router = require('express').Router();
const ctrl   = require('../controllers/attendanceController');
const { verifyToken }  = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');

// POST /api/attendances
router.post(
  '/',
  verifyToken,
  requireRole('CHEF_CLASSE'),
  ctrl.create
);

// GET /api/attendances/stats/:classId   ← must come BEFORE /:id-style routes
router.get(
  '/stats/:classId',
  verifyToken,
  requireRole('CHEF_CLASSE', 'SECRETAIRE', 'DIRECTEUR'),
  ctrl.getStats
);

// GET /api/attendances/students/:classId
router.get(
  '/students/:classId',
  verifyToken,
  requireRole('CHEF_CLASSE', 'SECRETAIRE', 'DIRECTEUR', 'ADMIN'),
  ctrl.getStudents
);

// GET /api/attendances/session/:classId/:date
router.get(
  '/session/:classId/:date',
  verifyToken,
  requireRole('CHEF_CLASSE', 'SECRETAIRE', 'DIRECTEUR', 'ADMIN'),
  ctrl.getSession
);

// GET /api/attendances/class/:classId
router.get(
  '/class/:classId',
  verifyToken,
  requireRole('CHEF_CLASSE', 'SECRETAIRE', 'DIRECTEUR'),
  ctrl.getByClass
);

// GET /api/attendances/student/:studentId
router.get(
  '/student/:studentId',
  verifyToken,
  requireRole('SECRETAIRE', 'DIRECTEUR', 'ADMIN'),
  ctrl.getByStudent
);

// PUT /api/attendances/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('CHEF_CLASSE'),
  ctrl.update
);

module.exports = router;
