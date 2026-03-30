const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

// ── Helpers ───────────────────────────────────────────────────────────────────

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, classe_id: user.classe_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const safeUser = (u) => ({
  id:        u.id,
  nom:       u.nom,
  prenom:    u.prenom,
  email:     u.email,
  role:      u.role,
  classe_id: u.classe_id,
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);

    res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// JWT is stateless — invalidation is handled client-side by deleting the token.
const logout = (_req, res) => {
  res.json({ message: 'Logged out successfully' });
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const me = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.nom, u.prenom, u.email, u.role, u.classe_id, u.created_at,
              c.nom AS classe_nom
         FROM users u
         LEFT JOIN classes c ON c.id = u.classe_id
        WHERE u.id = $1`,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('me error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('changePassword error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { login, logout, me, changePassword };
