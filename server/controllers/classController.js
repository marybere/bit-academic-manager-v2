const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const { sendClassRepChangedEmail } = require('../services/emailService');

// ── GET /api/classes ──────────────────────────────────────────────────────────
// Returns all classes with student_count and chef name
const getAllClasses = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.nom, c.filiere, c.niveau, c.annee_academique,
             c.list_downloaded_at, c.list_updated_at,
             COUNT(u.id) FILTER (WHERE u.role = 'STUDENT') AS student_count,
             chef.id     AS chef_id,
             chef.nom    AS chef_nom,
             chef.prenom AS chef_prenom,
             chef.email  AS chef_email
        FROM classes c
        LEFT JOIN users u    ON u.classe_id = c.id
        LEFT JOIN users chef ON chef.classe_id = c.id AND chef.role = 'CHEF_CLASSE'
       GROUP BY c.id, chef.id
       ORDER BY c.filiere, c.niveau
    `);
    res.json({ classes: rows });
  } catch (err) {
    console.error('getAllClasses error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/classes/:classId/students ────────────────────────────────────────
// Returns students in a class. CHEF_CLASSE restricted to own class only.
const getClassStudents = async (req, res) => {
  const { classId } = req.params;

  // Chef can only access their own class
  if (req.user.role === 'CHEF_CLASSE' && req.user.classe_id !== parseInt(classId)) {
    return res.status(403).json({ error: 'Access denied: not your class' });
  }

  try {
    const [studentsRes, classRes] = await Promise.all([
      db.query(
        `SELECT id, nom, prenom, email, role, active, created_at,
                CASE WHEN role = 'CHEF_CLASSE' THEN true ELSE false END AS is_chef
           FROM users
          WHERE classe_id = $1 AND role IN ('STUDENT', 'CHEF_CLASSE') AND active = true
          ORDER BY role = 'CHEF_CLASSE' DESC, nom ASC, prenom ASC`,
        [classId]
      ),
      db.query('SELECT * FROM classes WHERE id = $1', [classId]),
    ]);

    if (!classRes.rows[0]) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({
      class:    classRes.rows[0],
      students: studentsRes.rows,
    });
  } catch (err) {
    console.error('getClassStudents error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/classes/:classId/students ───────────────────────────────────────
// Add a new student to a class. Creates user account automatically.
const addStudent = async (req, res) => {
  const { classId }             = req.params;
  const { nom, prenom, email, password } = req.body;

  if (!nom || !prenom || !email) {
    return res.status(400).json({ error: 'nom, prenom and email are required' });
  }

  try {
    // Check class exists
    const { rows: classRows } = await db.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (!classRows[0]) return res.status(404).json({ error: 'Class not found' });

    // Check email uniqueness
    const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing[0]) return res.status(409).json({ error: 'Email already in use' });

    const plainPassword = password || 'bit2026';
    const hash = await bcrypt.hash(plainPassword, 10);

    const { rows } = await db.query(
      `INSERT INTO users (nom, prenom, email, password_hash, role, classe_id)
       VALUES ($1, $2, $3, $4, 'STUDENT', $5)
       RETURNING id, nom, prenom, email, classe_id, created_at`,
      [nom, prenom, email, hash, classId]
    );

    // Mark class list as updated
    await db.query(
      'UPDATE classes SET list_updated_at = NOW() WHERE id = $1',
      [classId]
    );

    res.status(201).json({
      student: rows[0],
      credentials: {
        email: rows[0].email,
        temporary_password: plainPassword,
        message: 'Share these credentials with the student',
      },
    });
  } catch (err) {
    console.error('addStudent error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── DELETE /api/classes/:classId/students/:studentId ─────────────────────────
// Remove student from class (set classe_id to null, keep user account)
const removeStudent = async (req, res) => {
  const { classId, studentId } = req.params;

  try {
    const { rows } = await db.query(
      `UPDATE users
          SET classe_id = NULL
        WHERE id = $1 AND classe_id = $2 AND role = 'STUDENT'
       RETURNING id, nom, prenom, email`,
      [studentId, classId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Student not found in this class' });
    }

    // Mark class list as updated
    await db.query(
      'UPDATE classes SET list_updated_at = NOW() WHERE id = $1',
      [classId]
    );

    res.json({ removed: rows[0] });
  } catch (err) {
    console.error('removeStudent error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/classes/:classId/students/export ─────────────────────────────────
// Returns CSV of student list, records list_downloaded_at timestamp
const exportStudents = async (req, res) => {
  const { classId } = req.params;

  // Chef can only export their own class
  if (req.user.role === 'CHEF_CLASSE' && req.user.classe_id !== parseInt(classId)) {
    return res.status(403).json({ error: 'Access denied: not your class' });
  }

  try {
    const [studentsRes, classRes] = await Promise.all([
      db.query(
        `SELECT id, nom, prenom, email, role, created_at
           FROM users
          WHERE classe_id = $1 AND role IN ('STUDENT', 'CHEF_CLASSE') AND active = true
          ORDER BY role = 'CHEF_CLASSE' DESC, nom ASC, prenom ASC`,
        [classId]
      ),
      db.query('SELECT nom, filiere, niveau FROM classes WHERE id = $1', [classId]),
    ]);

    if (!classRes.rows[0]) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const classe   = classRes.rows[0];
    const students = studentsRes.rows;

    // Build CSV
    const header = 'Matricule,Nom,Prénom,Email,Rôle,Classe\n';
    const lines  = students.map((s, i) =>
      `BIT-${String(i + 1).padStart(3, '0')},${s.nom},${s.prenom},${s.email},` +
      `${s.role === 'CHEF_CLASSE' ? 'Class Rep' : 'Student'},${classe.nom}`
    );
    const csv = header + lines.join('\n');

    // Record download timestamp
    await db.query(
      'UPDATE classes SET list_downloaded_at = NOW() WHERE id = $1',
      [classId]
    );

    const filename = `class-list-${classe.filiere}-${classe.niveau}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  } catch (err) {
    console.error('exportStudents error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/classes/:classId/chef ────────────────────────────────────────────
// Swap chef: demote old chef to STUDENT, promote new user to CHEF_CLASSE
const changeChef = async (req, res) => {
  const { classId }                  = req.params;
  const { new_chef_id, old_chef_id } = req.body;

  if (!new_chef_id) {
    return res.status(400).json({ error: 'new_chef_id is required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Verify class exists
    const { rows: classRows } = await client.query(
      'SELECT id FROM classes WHERE id = $1', [classId]
    );
    if (!classRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found' });
    }

    // Verify new chef exists and get their info
    const { rows: newChefRows } = await client.query(
      'SELECT id, role, nom, prenom, email FROM users WHERE id = $1', [new_chef_id]
    );
    if (!newChefRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'New chef user not found' });
    }
    const newChef = newChefRows[0];

    // Step 1: Demote old chef (by explicit id, or auto-find current one)
    const resolvedOldId = old_chef_id || (
      await client.query(
        "SELECT id FROM users WHERE classe_id = $1 AND role = 'CHEF_CLASSE'", [classId]
      )
    ).rows[0]?.id;

    let oldChef = null;
    if (resolvedOldId && resolvedOldId !== parseInt(new_chef_id)) {
      const { rows: oldChefRows } = await client.query(
        'SELECT id, nom, prenom, email FROM users WHERE id = $1', [resolvedOldId]
      );
      oldChef = oldChefRows[0] || null;
      await client.query(
        "UPDATE users SET role = 'STUDENT', classe_id = $1 WHERE id = $2",
        [classId, resolvedOldId]
      );
    }

    // Step 2: Promote new chef
    await client.query(
      "UPDATE users SET role = 'CHEF_CLASSE', classe_id = $1 WHERE id = $2",
      [classId, new_chef_id]
    );

    await client.query('COMMIT');

    // Return updated class info
    const { rows } = await db.query(`
      SELECT c.*,
             chef.id AS chef_id, chef.nom AS chef_nom,
             chef.prenom AS chef_prenom, chef.email AS chef_email
        FROM classes c
        LEFT JOIN users chef ON chef.classe_id = c.id AND chef.role = 'CHEF_CLASSE'
       WHERE c.id = $1`, [classId]
    );

    const className = rows[0]?.nom || `Class #${classId}`;

    // Notify new chef
    console.log(`Sending class rep appointed email to: ${newChef.email}`);
    sendClassRepChangedEmail(newChef.email, `${newChef.prenom} ${newChef.nom}`, className, true)
      .then(info => console.log(`Class rep email sent to ${newChef.email} — messageId: ${info?.messageId}`))
      .catch(err => console.warn(`Class rep email failed for ${newChef.email}:`, err.message));

    // Notify old chef (if they were demoted)
    if (oldChef) {
      console.log(`Sending class rep removed email to: ${oldChef.email}`);
      sendClassRepChangedEmail(oldChef.email, `${oldChef.prenom} ${oldChef.nom}`, className, false)
        .then(info => console.log(`Class rep removal email sent to ${oldChef.email} — messageId: ${info?.messageId}`))
        .catch(err => console.warn(`Class rep removal email failed for ${oldChef.email}:`, err.message));
    }

    res.json({ class: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('changeChef error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ── PUT /api/classes/:classId/students/:studentId/reset-password ──────────────
// Resets a student's password to 'bit2026'
const resetStudentPassword = async (req, res) => {
  const { classId, studentId } = req.params;

  try {
    // Verify student belongs to this class
    const { rows } = await db.query(
      `SELECT id, nom, prenom, email FROM users
        WHERE id = $1 AND classe_id = $2 AND role = 'STUDENT'`,
      [studentId, classId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Student not found in this class' });
    }

    const defaultPassword = 'bit2026';
    const hash = await bcrypt.hash(defaultPassword, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, studentId]);

    res.json({ message: `Password reset to "${defaultPassword}"`, student: rows[0] });
  } catch (err) {
    console.error('resetStudentPassword error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/classes/:classId/info ────────────────────────────────────────────
// Returns basic class info (id, nom, filiere, niveau) — any authenticated user
const getClassInfo = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, nom, filiere, niveau FROM classes WHERE id = $1',
      [req.params.classId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Class not found' });
    res.json({ classe: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllClasses, getClassStudents, addStudent, removeStudent, exportStudents, changeChef, resetStudentPassword, getClassInfo };
