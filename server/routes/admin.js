const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

router.get('/',                   verifyToken, requireAdmin, ctrl.getAllUsers);
router.post('/',                  verifyToken, requireAdmin, ctrl.createUser);
router.put('/:id',                verifyToken, requireAdmin, ctrl.updateUser);
router.delete('/:id',             verifyToken, requireAdmin, ctrl.deactivateUser);
router.put('/:id/activate',       verifyToken, requireAdmin, ctrl.activateUser);
router.put('/:id/reset-password', verifyToken, requireAdmin, ctrl.resetPassword);

module.exports = router;
