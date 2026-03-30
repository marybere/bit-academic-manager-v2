const db     = require('../config/db');
const bcrypt = require('bcryptjs');

const VALID_ROLES = ['STUDENT','CHEF_CLASSE','SECRETAIRE','DIRECTEUR','CAISSE','IT','LABORATOIRE','ADMIN'];

// GET /api/admin/users
const getUsers = async (req, res) => {
  const { role, classe_id } = req.query;
  try {
    let sql = `
      SELECT u.id, u.nom, u.prenom, u.email, u.role, u.classe_id, u.active, u.created_at,
             c.nom AS classe_nom
        FROM users u
        LEFT JOIN classes c ON c.id = u.classe_id
       WHERE 1=1
    `;
    const params = [];
    if (role && VALID_ROLES.includes(role)) {
      params.push(role);
      sql += ` AND u.role = $${params.length}`;
    }
    if (classe_id) {
      params.push(classe_id);
      sql += ` AND u.classe_id = $${params.length}`;
    }
    sql += ' ORDER BY u.role, u.nom';
    const { rows } = await db.query(sql, params);
    res.json({ users: rows });
  } catch (err) {
    console.error('getUsers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/admin/users
const createUser = async (req, res) => {
  const { nom, prenom, email, password, role, classe_id } = req.body;
  if (!nom || !prenom || !email || !password || !role)
    return res.status(400).json({ error: 'nom, prenom, email, password and role are required' });
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of ${VALID_ROLES.join('|')}` });

  try {
    const { rows: exists } = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists[0]) return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (nom, prenom, email, password_hash, role, classe_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, nom, prenom, email, role, classe_id, active, created_at`,
      [nom, prenom, email, hash, role, classe_id || null]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error('createUser error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  const { id }                           = req.params;
  const { nom, prenom, email, role, classe_id } = req.body;

  if (role && !VALID_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of ${VALID_ROLES.join('|')}` });

  try {
    const { rows } = await db.query(
      `UPDATE users
          SET nom       = COALESCE($1, nom),
              prenom    = COALESCE($2, prenom),
              email     = COALESCE($3, email),
              role      = COALESCE($4, role),
              classe_id = $5
        WHERE id = $6
       RETURNING id, nom, prenom, email, role, classe_id, active`,
      [nom||null, prenom||null, email||null, role||null, classe_id||null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('updateUser error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/admin/users/:id  (soft delete)
const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'UPDATE users SET active=false WHERE id=$1 RETURNING id, email',
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ deactivated: rows[0] });
  } catch (err) {
    console.error('deleteUser error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
