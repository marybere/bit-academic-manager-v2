const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

router.get('/',    verifyToken, requireAdmin, ctrl.getUsers);
router.post('/',   verifyToken, requireAdmin, ctrl.createUser);
router.put('/:id', verifyToken, requireAdmin, ctrl.updateUser);
router.delete('/:id', verifyToken, requireAdmin, ctrl.deleteUser);

module.exports = router;
