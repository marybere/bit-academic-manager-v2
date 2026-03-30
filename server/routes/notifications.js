const router      = require('express').Router();
const ctrl        = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/auth');

// GET /api/notifications/my
router.get('/my', verifyToken, ctrl.getMyNotifications);

// PUT /api/notifications/read-all  ← must come before /:id
router.put('/read-all', verifyToken, ctrl.markAllRead);

// PUT /api/notifications/:id/read
router.put('/:id/read', verifyToken, ctrl.markRead);

module.exports = router;
