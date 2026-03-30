const db = require('../config/db');
const { createNotification } = require('./notificationController');

const VALID_TYPES   = ['RELEVE_NOTES', 'ATTESTATION_INSCRIPTION', 'DIPLOME', 'AUTRE'];
const VALID_FORMATS = ['PDF', 'PAPIER'];
const VALID_STATUTS = ['EN_ATTENTE', 'EN_TRAITEMENT', 'APPROUVE', 'PRET', 'RETIRE', 'REJETE'];

// ── POST /api/requests ────────────────────────────────────────────────────────
const create = async (req, res) => {
  const { type, format = 'PDF', notes } = req.body;

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join('|')}` });
  }
  if (!VALID_FORMATS.includes(format)) {
    return res.status(400).json({ error: `format must be one of ${VALID_FORMATS.join('|')}` });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO requests (student_id, type, format, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, type, format, notes || null]
    );
    res.status(201).json({ request: rows[0] });
  } catch (err) {
    console.error('create request error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/requests/my ──────────────────────────────────────────────────────
const getMy = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*,
              COALESCE(
                json_agg(v ORDER BY v.created_at) FILTER (WHERE v.id IS NOT NULL),
                '[]'
              ) AS validations
         FROM requests r
         LEFT JOIN validations v ON v.request_id = r.id
        WHERE r.student_id = $1
        GROUP BY r.id
        ORDER BY r.date_demande DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error('getMy error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/requests ─────────────────────────────────────────────────────────
// Query: ?statut=EN_ATTENTE&type=RELEVE_NOTES
const getAll = async (req, res) => {
  const { statut, type } = req.query;

  try {
    let sql = `
      SELECT r.*,
             u.nom, u.prenom, u.email,
             c.nom AS classe_nom
        FROM requests r
        JOIN users u ON u.id = r.student_id
        LEFT JOIN classes c ON c.id = u.classe_id
       WHERE 1=1
    `;
    const params = [];

    if (statut && VALID_STATUTS.includes(statut)) {
      params.push(statut);
      sql += ` AND r.statut = $${params.length}`;
    }
    if (type && VALID_TYPES.includes(type)) {
      params.push(type);
      sql += ` AND r.type = $${params.length}`;
    }

    sql += ' ORDER BY r.date_demande DESC';

    const { rows } = await db.query(sql, params);
    res.json({ requests: rows });
  } catch (err) {
    console.error('getAll requests error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/requests/:id/statut ──────────────────────────────────────────────
const updateStatut = async (req, res) => {
  const { id }                        = req.params;
  const { statut, rendez_vous, notes } = req.body;

  if (!VALID_STATUTS.includes(statut)) {
    return res.status(400).json({ error: `statut must be one of ${VALID_STATUTS.join('|')}` });
  }

  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM requests WHERE id = $1',
      [id]
    );
    if (!existing[0]) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { rows } = await db.query(
      `UPDATE requests
          SET statut      = $1,
              rendez_vous = COALESCE($2, rendez_vous),
              notes       = COALESCE($3, notes)
        WHERE id = $4
        RETURNING *`,
      [statut, rendez_vous || null, notes || null, id]
    );

    res.json({ request: rows[0] });
  } catch (err) {
    console.error('updateStatut error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/requests/:id ─────────────────────────────────────────────────────
const getById = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT r.*,
              u.nom, u.prenom, u.email,
              c.nom AS classe_nom,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id',              v.id,
                    'service',         v.service,
                    'statut',          v.statut,
                    'commentaire',     v.commentaire,
                    'date_validation', v.date_validation,
                    'agent_id',        v.agent_id
                  ) ORDER BY v.created_at
                ) FILTER (WHERE v.id IS NOT NULL),
                '[]'
              ) AS validations
         FROM requests r
         JOIN users u ON u.id = r.student_id
         LEFT JOIN classes c ON c.id = u.classe_id
         LEFT JOIN validations v ON v.request_id = r.id
        WHERE r.id = $1
        GROUP BY r.id, u.nom, u.prenom, u.email, c.nom`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Students can only see their own requests
    const r = req.user;
    if (r.role === 'STUDENT' && rows[0].student_id !== r.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ request: rows[0] });
  } catch (err) {
    console.error('getById error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/requests/manual ─────────────────────────────────────────────────
// Secretary/Admin creates a request on behalf of a student
const createForStudent = async (req, res) => {
  const { student_id, type, format = 'PDF', notes } = req.body;

  if (!student_id) return res.status(400).json({ error: 'student_id is required' });
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join('|')}` });
  }
  if (!VALID_FORMATS.includes(format)) {
    return res.status(400).json({ error: `format must be one of ${VALID_FORMATS.join('|')}` });
  }

  try {
    const { rows: student } = await db.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'STUDENT'", [student_id]
    );
    if (!student[0]) return res.status(404).json({ error: 'Student not found' });

    const { rows } = await db.query(
      `INSERT INTO requests (student_id, type, format, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [student_id, type, format, notes || null]
    );
    res.status(201).json({ request: rows[0] });
  } catch (err) {
    console.error('createForStudent error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/requests/:id/forward ────────────────────────────────────────────
// Secretary forwards EN_ATTENTE → EN_TRAITEMENT, creates validation stubs, notifies CAISSE
const forward = async (req, res) => {
  const { id } = req.params;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE requests SET statut = 'EN_TRAITEMENT'
        WHERE id = $1 AND statut = 'EN_ATTENTE'
        RETURNING *`,
      [id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found or not in EN_ATTENTE status' });
    }
    // Create initial validation stubs for all 3 departments
    for (const svc of ['CAISSE', 'IT', 'LABORATOIRE']) {
      await client.query(
        `INSERT INTO validations (request_id, service, statut)
         VALUES ($1, $2, 'EN_ATTENTE')
         ON CONFLICT (request_id, service) DO NOTHING`,
        [id, svc]
      );
    }
    await client.query('COMMIT');
    // Notify student
    await createNotification(rows[0].student_id, 'Request Forwarded',
      'Your request has been forwarded to the validation departments.', 'INFO', id, 'REQUEST');
    // Notify all CAISSE agents (first in chain)
    const { rows: caisseAgents } = await db.query(
      `SELECT id FROM users WHERE role = 'CAISSE' AND active = true`
    );
    for (const agent of caisseAgents) {
      await createNotification(agent.id, 'New Validation Request',
        `Request #${id} is ready for your validation.`, 'INFO', id, 'REQUEST');
    }
    res.json({ request: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('forward error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ── GET /api/requests/ready-for-secretary ─────────────────────────────────────
// Returns APPROUVE requests awaiting secretary action
const getReadyForSecretary = async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, u.nom, u.prenom, u.email, c.nom AS classe_nom
         FROM requests r
         JOIN users u ON u.id = r.student_id
         LEFT JOIN classes c ON c.id = u.classe_id
        WHERE r.statut = 'APPROUVE'
        ORDER BY r.date_demande ASC`
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error('getReadyForSecretary error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/requests/:id/schedule ────────────────────────────────────────────
// Secretary schedules pickup for an APPROUVE request (→ PRET)
const schedulePickup = async (req, res) => {
  const { id } = req.params;
  const { rendez_vous } = req.body;
  if (!rendez_vous) return res.status(400).json({ error: 'rendez_vous date is required' });
  try {
    const { rows } = await db.query(
      `UPDATE requests SET statut = 'PRET', rendez_vous = $1
        WHERE id = $2 AND statut = 'APPROUVE'
        RETURNING *`,
      [rendez_vous, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or not in APPROUVE status' });
    const dateStr = new Date(rendez_vous).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
    await createNotification(rows[0].student_id, 'Document Ready for Pickup',
      `Your document is ready. Please come to the Secretary Office on ${dateStr}.`,
      'SUCCESS', id, 'REQUEST');
    res.json({ request: rows[0] });
  } catch (err) {
    console.error('schedulePickup error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/requests/:id/send-pdf ────────────────────────────────────────────
// Secretary marks PDF as sent for an APPROUVE request (→ PRET)
const sendPdf = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `UPDATE requests SET statut = 'PRET'
        WHERE id = $1 AND statut = 'APPROUVE'
        RETURNING *`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or not in APPROUVE status' });
    await createNotification(rows[0].student_id, 'Your Document Has Been Sent',
      'Your document has been sent to your email as a PDF. Please check your inbox.',
      'SUCCESS', id, 'REQUEST');
    res.json({ request: rows[0] });
  } catch (err) {
    console.error('sendPdf error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { create, getMy, getAll, updateStatut, getById, createForStudent, forward, getReadyForSecretary, schedulePickup, sendPdf };
