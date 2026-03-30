const router  = require('express').Router();
const ctrl    = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', ctrl.login);

// POST /api/auth/logout
router.post('/logout', ctrl.logout);

// GET /api/auth/me
router.get('/me', verifyToken, ctrl.me);

// PUT /api/auth/change-password
router.put('/change-password', verifyToken, ctrl.changePassword);

module.exports = router;
