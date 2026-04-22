const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const {
  sendPasswordResetEmail,
  sendAccountCreatedEmail,
  sendAccountDeactivatedEmail,
  sendAccountReactivatedEmail,
} = require('../services/emailService');

const STAFF_ROLES = ['SECRETAIRE', 'DIRECTEUR', 'CAISSE', 'IT', 'LABORATOIRE', 'ADMIN'];

// GET /api/admin/users
const getAllUsers = async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.id, u.nom, u.prenom, u.email, u.role,
        u.active, u.created_at,
        c.nom AS classe_nom, c.filiere, c.niveau
      FROM users u
      LEFT JOIN classes c ON u.classe_id = c.id
      WHERE u.role NOT IN ('STUDENT', 'CHEF_CLASSE')
      ORDER BY u.role ASC, u.nom ASC
    `);

    const active   = rows.filter(u => u.active !== false);
    const inactive = rows.filter(u => u.active === false);

    res.json({ users: rows, active, inactive, total: rows.length });
  } catch (err) {
    console.error('getAllUsers error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/users
const createUser = async (req, res) => {
  const { nom, prenom, email, password, role } = req.body;

  if (!nom || !prenom || !email || !password || !role)
    return res.status(400).json({ error: 'nom, prenom, email, password and role are required' });

  if (!STAFF_ROLES.includes(role))
    return res.status(403).json({
      error: 'Admin can only create staff accounts (SECRETAIRE, DIRECTEUR, CAISSE, IT, LABORATOIRE, ADMIN).'
    });

  try {
    const { rows: exists } = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (exists[0]) return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (nom, prenom, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nom, prenom, email, role, active, created_at`,
      [nom.trim(), prenom.trim(), email.toLowerCase().trim(), hash, role]
    );
    const u = rows[0];
    console.log(`Sending account created email to: ${u.email}`);
    sendAccountCreatedEmail(u.email, `${u.prenom} ${u.nom}`, password, u.role)
      .then(info => console.log(`Account created email sent to ${u.email} — messageId: ${info?.messageId}`))
      .catch(err => console.warn(`Account created email failed for ${u.email}:`, err.message));

    res.status(201).json({ user: u });
  } catch (err) {
    console.error('createUser error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nom, prenom, email, role, password } = req.body;

  if (role && !STAFF_ROLES.includes(role))
    return res.status(403).json({ error: 'Can only assign staff roles via admin interface.' });

  try {
    // Build dynamic update
    const sets = [];
    const vals = [];
    const push = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };

    if (nom)    push('nom',    nom.trim());
    if (prenom) push('prenom', prenom.trim());
    if (email)  push('email',  email.toLowerCase().trim());
    if (role)   push('role',   role);
    if (password && password.trim()) {
      const hash = await bcrypt.hash(password, 10);
      push('password_hash', hash);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(id);
    const { rows } = await db.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length}
       RETURNING id, nom, prenom, email, role, active, created_at`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('updateUser error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/users/:id  (soft-deactivate)
const deactivateUser = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `UPDATE users SET active = false WHERE id = $1
       RETURNING id, nom, prenom, email, role`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    const adminName = req.user ? `${req.user.prenom || ''} ${req.user.nom || ''}`.trim() || 'Administrator' : 'Administrator';
    console.log(`Sending account deactivated email to: ${u.email}`);
    sendAccountDeactivatedEmail(u.email, `${u.prenom} ${u.nom}`, adminName)
      .then(info => console.log(`Deactivated email sent to ${u.email} — messageId: ${info?.messageId}`))
      .catch(err => console.warn(`Deactivated email failed for ${u.email}:`, err.message));
    res.json({ deactivated: u });
  } catch (err) {
    console.error('deactivateUser error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/admin/users/:id/activate
const activateUser = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `UPDATE users SET active = true WHERE id = $1
       RETURNING id, nom, prenom, email, role`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    const adminName = req.user ? `${req.user.prenom || ''} ${req.user.nom || ''}`.trim() || 'Administrator' : 'Administrator';
    console.log(`Sending account reactivated email to: ${u.email}`);
    sendAccountReactivatedEmail(u.email, `${u.prenom} ${u.nom}`, adminName)
      .then(info => console.log(`Reactivated email sent to ${u.email} — messageId: ${info?.messageId}`))
      .catch(err => console.warn(`Reactivated email failed for ${u.email}:`, err.message));
    res.json({ activated: u });
  } catch (err) {
    console.error('activateUser error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/admin/users/:id/reset-password
const resetPassword = async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'new_password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(new_password, 10);
    const { rows } = await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2
       RETURNING id, nom, prenom, email, role`,
      [hash, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const u = rows[0];
    const adminName = req.user
      ? `${req.user.prenom || ''} ${req.user.nom || ''}`.trim() || 'Administrator'
      : 'Administrator';

    // Send email non-blockingly — don't fail the reset if email fails
    console.log(`Sending password reset email to: ${u.email}`);
    sendPasswordResetEmail(u.email, `${u.prenom} ${u.nom}`, new_password, adminName)
      .then(info => console.log(`Password reset email sent to ${u.email} — messageId: ${info?.messageId}`))
      .catch(err => console.warn(`Password reset email failed for ${u.email}:`, err.message));

    res.json({ message: 'Password reset successfully', user: u });
  } catch (err) {
    console.error('resetPassword error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllUsers, createUser, updateUser, deactivateUser, activateUser, resetPassword };
