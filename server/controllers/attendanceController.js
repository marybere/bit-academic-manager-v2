const db = require('../config/db');

// ── POST /api/attendances ─────────────────────────────────────────────────────
// Body: { class_id, date, students: [{ student_id, statut }] }
const create = async (req, res) => {
  const { class_id, date, students } = req.body;

  if (!class_id || !date || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'class_id, date and students[] are required' });
  }

  const validStatuts = ['PRESENT', 'ABSENT', 'RETARD', 'EXCUSE'];
  for (const s of students) {
    if (!s.student_id || !validStatuts.includes(s.statut)) {
      return res.status(400).json({
        error: `Each student needs student_id and statut in ${validStatuts.join('|')}`,
      });
    }
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const inserted = [];
    for (const s of students) {
      const { rows } = await client.query(
        `INSERT INTO attendances (student_id, class_id, date, statut, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (student_id, class_id, date)
         DO UPDATE SET statut = EXCLUDED.statut, created_by = EXCLUDED.created_by
         RETURNING *`,
        [s.student_id, class_id, date, s.statut, req.user.id]
      );
      inserted.push(rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ count: inserted.length, attendances: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create attendance error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ── GET /api/attendances/class/:classId ───────────────────────────────────────
// Query: ?date=YYYY-MM-DD
const getByClass = async (req, res) => {
  const { classId } = req.params;
  const { date }    = req.query;

  try {
    let sql = `
      SELECT a.*,
             u.nom, u.prenom, u.email
        FROM attendances a
        JOIN users u ON u.id = a.student_id
       WHERE a.class_id = $1
    `;
    const params = [classId];

    if (date) {
      params.push(date);
      sql += ` AND a.date = $${params.length}`;
    }

    sql += ' ORDER BY a.date DESC, u.nom ASC';

    const { rows } = await db.query(sql, params);
    res.json({ attendances: rows });
  } catch (err) {
    console.error('getByClass error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/attendances/student/:studentId ───────────────────────────────────
const getByStudent = async (req, res) => {
  const { studentId } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT a.*,
              c.nom AS classe_nom, c.filiere
         FROM attendances a
         JOIN classes c ON c.id = a.class_id
        WHERE a.student_id = $1
        ORDER BY a.date DESC`,
      [studentId]
    );
    res.json({ attendances: rows });
  } catch (err) {
    console.error('getByStudent error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/attendances/:id ──────────────────────────────────────────────────
// Editable only within 24 hours of creation
const update = async (req, res) => {
  const { id }     = req.params;
  const { statut } = req.body;

  const validStatuts = ['PRESENT', 'ABSENT', 'RETARD', 'EXCUSE'];
  if (!validStatuts.includes(statut)) {
    return res.status(400).json({ error: `statut must be one of ${validStatuts.join('|')}` });
  }

  try {
    const { rows: existing } = await db.query(
      'SELECT * FROM attendances WHERE id = $1',
      [id]
    );

    if (!existing[0]) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    const ageMs      = Date.now() - new Date(existing[0].created_at).getTime();
    const twentyFour = 24 * 60 * 60 * 1000;
    if (ageMs > twentyFour) {
      return res.status(403).json({ error: 'Cannot edit attendance older than 24 hours' });
    }

    const { rows } = await db.query(
      'UPDATE attendances SET statut = $1 WHERE id = $2 RETURNING *',
      [statut, id]
    );

    res.json({ attendance: rows[0] });
  } catch (err) {
    console.error('update attendance error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/attendances/stats/:classId ───────────────────────────────────────
const getStats = async (req, res) => {
  const { classId } = req.params;

  try {
    // Total distinct sessions (days) recorded for this class
    const { rows: sessionsRows } = await db.query(
      'SELECT COUNT(DISTINCT date) AS total_sessions FROM attendances WHERE class_id = $1',
      [classId]
    );
    const totalSessions = parseInt(sessionsRows[0].total_sessions) || 0;

    // Per-student absence counts and rates
    const { rows: studentRows } = await db.query(
      `SELECT u.id, u.nom, u.prenom,
              COUNT(*) FILTER (WHERE a.statut = 'ABSENT')                        AS absences,
              COUNT(*)                                                            AS total,
              ROUND(
                COUNT(*) FILTER (WHERE a.statut = 'ABSENT')::numeric
                / NULLIF(COUNT(*), 0) * 100, 1
              )                                                                   AS absence_rate
         FROM attendances a
         JOIN users u ON u.id = a.student_id
        WHERE a.class_id = $1
        GROUP BY u.id, u.nom, u.prenom
        ORDER BY absences DESC`,
      [classId]
    );

    const atRisk = studentRows.filter((s) => parseFloat(s.absence_rate) > 20);

    // Global presence rate for the class
    const { rows: globalRows } = await db.query(
      `SELECT ROUND(
         COUNT(*) FILTER (WHERE statut = 'PRESENT')::numeric
         / NULLIF(COUNT(*), 0) * 100, 1
       ) AS avg_presence_rate
         FROM attendances
        WHERE class_id = $1`,
      [classId]
    );

    res.json({
      total_sessions:    totalSessions,
      avg_presence_rate: parseFloat(globalRows[0].avg_presence_rate) || 0,
      students:          studentRows,
      at_risk_students:  atRisk,
    });
  } catch (err) {
    console.error('getStats error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/attendances/students/:classId ────────────────────────────────────
// Returns all students enrolled in a class
const getStudents = async (req, res) => {
  const { classId } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, nom, prenom, email
         FROM users
        WHERE classe_id = $1 AND role = 'STUDENT'
        ORDER BY nom ASC, prenom ASC`,
      [classId]
    );
    res.json({ students: rows });
  } catch (err) {
    console.error('getStudents error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/attendances/session/:classId/:date ───────────────────────────────
// Returns attendance records for a specific class + date
const getSession = async (req, res) => {
  const { classId, date } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT a.id, a.student_id, a.statut, a.created_at,
              u.nom, u.prenom, u.email
         FROM attendances a
         JOIN users u ON u.id = a.student_id
        WHERE a.class_id = $1 AND a.date = $2
        ORDER BY u.nom ASC, u.prenom ASC`,
      [classId, date]
    );
    res.json({ session: rows });
  } catch (err) {
    console.error('getSession error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { create, getByClass, getByStudent, update, getStats, getStudents, getSession };
