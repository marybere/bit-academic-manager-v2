const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../config/db');
const { send: sendEmail } = require('../services/emailService');
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

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

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1 AND active = true',
      [email.toLowerCase().trim()]
    );

    // Always return success — don't reveal whether email exists
    if (!rows[0]) {
      return res.json({ message: 'If this email exists, a reset link has been sent.' });
    }

    const user = rows[0];
    const resetToken  = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      `UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
      [resetToken, resetExpiry, user.id]
    );

    const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

    console.log(`Sending forgot password email to: ${user.email}`);
    await sendEmail(
      user.email,
      'Password Reset Request — BIT Academic Manager',
      `
      <p class="greeting">Hello, ${user.prenom} ${user.nom}</p>
      <p class="message">You requested a password reset.
        Click the button below to set a new password.
        This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}"
           style="background:#C8184A;color:#fff;padding:14px 32px;
                  border-radius:8px;text-decoration:none;font-weight:bold;
                  font-size:15px;display:inline-block">
          Reset My Password
        </a>
      </div>
      <div class="banner-warning">
        <p>If you did not request this, ignore this email — your password will not change.</p>
      </div>
      <hr class="divider">
      <p style="font-size:13px;color:#94a3b8;margin:0">
        Or copy this link: <a href="${resetUrl}">${resetUrl}</a>
      </p>
      `
    );

    res.json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
const resetPasswordViaToken = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 6)  return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const { rows } = await db.query(
      `SELECT * FROM users
       WHERE reset_token = $1
         AND reset_token_expiry > NOW()
         AND active = true`,
      [token]
    );

    if (!rows[0]) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE users
         SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL
       WHERE id = $2`,
      [hash, rows[0].id]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPasswordViaToken error:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { login, logout, me, changePassword, forgotPassword, resetPasswordViaToken };
