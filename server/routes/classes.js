const router = require('express').Router();
const ctrl   = require('../controllers/classController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// GET /api/classes — all authenticated users
router.get(
  '/',
  verifyToken,
  ctrl.getAllClasses
);

// GET /api/classes/:classId/info  ← before /:classId/students to avoid collision
router.get(
  '/:classId/info',
  verifyToken,
  ctrl.getClassInfo
);

// GET /api/classes/:classId/students/export  ← must be before /:classId/students
router.get(
  '/:classId/students/export',
  verifyToken,
  requireRole('CHEF_CLASSE', 'SECRETAIRE', 'ADMIN'),
  ctrl.exportStudents
);

// GET /api/classes/:classId/students
router.get(
  '/:classId/students',
  verifyToken,
  requireRole('CHEF_CLASSE', 'SECRETAIRE', 'ADMIN'),
  ctrl.getClassStudents
);

// POST /api/classes/:classId/students
router.post(
  '/:classId/students',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.addStudent
);

// DELETE /api/classes/:classId/students/:studentId
router.delete(
  '/:classId/students/:studentId',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.removeStudent
);

// PUT /api/classes/:classId/chef
router.put(
  '/:classId/chef',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.changeChef
);

// PUT /api/classes/:classId/students/:studentId/reset-password
router.put(
  '/:classId/students/:studentId/reset-password',
  verifyToken,
  requireRole('SECRETAIRE', 'ADMIN'),
  ctrl.resetStudentPassword
);

module.exports = router;
