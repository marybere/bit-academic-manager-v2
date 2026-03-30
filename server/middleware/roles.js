/**
 * Valid roles in the system.
 */
const ROLES = {
  STUDENT:      'STUDENT',
  CHEF_CLASSE:  'CHEF_CLASSE',
  SECRETAIRE:   'SECRETAIRE',
  DIRECTEUR:    'DIRECTEUR',
  CAISSE:       'CAISSE',
  IT:           'IT',
  LABORATOIRE:  'LABORATOIRE',
  ADMIN:        'ADMIN',
};

/**
 * Middleware factory — allows only the listed roles through.
 *
 * Usage:
 *   router.get('/stats', verifyToken, requireRole('DIRECTEUR', 'ADMIN'), handler)
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
    });
  }

  next();
};

/**
 * Convenience — only ADMIN may proceed.
 */
const requireAdmin = requireRole(ROLES.ADMIN);

module.exports = { ROLES, requireRole, requireAdmin };
