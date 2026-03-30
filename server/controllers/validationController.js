const db = require('../config/db');
const { createNotification } = require('./notificationController');

// Workflow order: each role maps to the service it validates
// and the step number that must be completed before it can act.
const WORKFLOW = [
  { service: 'CAISSE',      role: 'CAISSE',      step: 1, requires: [] },
  { service: 'IT',          role: 'IT',           step: 2, requires: ['CAISSE'] },
  { service: 'LABORATOIRE', role: 'LABORATOIRE',  step: 3, requires: ['CAISSE', 'IT'] },
];

const roleToService = (role) => {
  const entry = WORKFLOW.find((w) => w.role === role);
  return entry ? entry.service : null;
};

// ── GET /api/validations/pending ──────────────────────────────────────────────
// Returns requests that are pending for the calling agent's service.
const getPending = async (req, res) => {
  const service = roleToService(req.user.role);

  if (!service) {
    return res.status(403).json({ error: 'Your role does not perform validations' });
  }

  const step = WORKFLOW.find((w) => w.service === service);

  try {
    // A request is "pending for this service" when:
    //  1. No validation row exists for this service yet (or it's EN_ATTENTE)
    //  2. All prerequisite services have been VALIDE
    let prerequisiteClause = '';
    if (step.requires.length > 0) {
      // All required services must be VALIDE
      const quotedServices = step.requires.map((s) => `'${s}'`).join(', ');
      prerequisiteClause = `
        AND (
          SELECT COUNT(*)
            FROM validations pv
           WHERE pv.request_id = r.id
             AND pv.service IN (${quotedServices})
             AND pv.statut = 'VALIDE'
        ) = ${step.requires.length}
      `;
    }

    const sql = `
      SELECT r.*,
             u.nom, u.prenom, u.email, u.classe_id,
             c.nom AS classe_nom,
             v.statut AS validation_statut
        FROM requests r
        JOIN users u ON u.id = r.student_id
        LEFT JOIN classes c ON c.id = u.classe_id
        LEFT JOIN validations v
               ON v.request_id = r.id AND v.service = $1
       WHERE r.statut NOT IN ('RETIRE', 'REJETE')
         AND (v.id IS NULL OR v.statut = 'EN_ATTENTE')
         ${prerequisiteClause}
       ORDER BY r.date_demande ASC
    `;

    const { rows } = await db.query(sql, [service]);
    res.json({ service, pending: rows });
  } catch (err) {
    console.error('getPending error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/validations/:requestId ─────────────────────────────────────────
// Body: { statut: 'VALIDE'|'REJETE', commentaire }
const validate = async (req, res) => {
  const { requestId }         = req.params;
  const { statut, commentaire } = req.body;

  if (!['VALIDE', 'REJETE'].includes(statut)) {
    return res.status(400).json({ error: "statut must be 'VALIDE' or 'REJETE'" });
  }

  const service = roleToService(req.user.role);
  if (!service) {
    return res.status(403).json({ error: 'Your role does not perform validations' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Confirm request exists
    const { rows: reqRows } = await client.query(
      'SELECT * FROM requests WHERE id = $1',
      [requestId]
    );
    if (!reqRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check prerequisites are met
    const step = WORKFLOW.find((w) => w.service === service);
    if (step.requires.length > 0) {
      const quotedServices = step.requires.map((s) => `'${s}'`).join(', ');
      const { rows: preRows } = await client.query(
        `SELECT COUNT(*) AS cnt
           FROM validations
          WHERE request_id = $1
            AND service IN (${quotedServices})
            AND statut = 'VALIDE'`,
        [requestId]
      );
      if (parseInt(preRows[0].cnt) < step.requires.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Previous steps must be validated first: ${step.requires.join(', ')}`,
        });
      }
    }

    // Upsert the validation row
    const { rows: valRows } = await client.query(
      `INSERT INTO validations (request_id, service, statut, commentaire, agent_id, date_validation)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (request_id, service)
       DO UPDATE SET statut          = EXCLUDED.statut,
                     commentaire     = EXCLUDED.commentaire,
                     agent_id        = EXCLUDED.agent_id,
                     date_validation = EXCLUDED.date_validation
       RETURNING *`,
      [requestId, service, statut, commentaire || null, req.user.id]
    );

    // If rejected at any step → block the whole request
    if (statut === 'REJETE') {
      await client.query(
        "UPDATE requests SET statut = 'REJETE' WHERE id = $1",
        [requestId]
      );
      await client.query('COMMIT');
      return res.json({ validation: valRows[0] });
    } else {
      // Check if ALL 3 services have now validated → APPROUVE (secretary notified)
      const { rows: allRows } = await client.query(
        `SELECT COUNT(*) AS cnt
           FROM validations
          WHERE request_id = $1 AND statut = 'VALIDE'`,
        [requestId]
      );
      if (parseInt(allRows[0].cnt) >= WORKFLOW.length) {
        await client.query(
          "UPDATE requests SET statut = 'APPROUVE' WHERE id = $1",
          [requestId]
        );
        await client.query('COMMIT');
        // Notify student
        const { rows: reqInfo } = await db.query(
          'SELECT student_id FROM requests WHERE id = $1', [requestId]
        );
        if (reqInfo[0]) {
          await createNotification(reqInfo[0].student_id,
            'Your Request is Approved!',
            'All departments have validated your request. The secretary will contact you soon.',
            'SUCCESS', requestId, 'REQUEST');
        }
        // Notify all secretaries
        const { rows: secretaries } = await db.query(
          `SELECT id FROM users WHERE role = 'SECRETAIRE' AND active = true`
        );
        for (const sec of secretaries) {
          await createNotification(sec.id,
            'Request Fully Validated — Action Required',
            `Request #${requestId} has been approved by all departments and requires your action.`,
            'SUCCESS', requestId, 'REQUEST');
        }
        return res.json({ validation: valRows[0] });
      } else {
        await client.query(
          "UPDATE requests SET statut = 'EN_TRAITEMENT' WHERE id = $1",
          [requestId]
        );
        await client.query('COMMIT');
        // Notify next department in chain
        const currentIdx = WORKFLOW.findIndex(w => w.service === service);
        const next = WORKFLOW[currentIdx + 1];
        if (next) {
          const { rows: nextAgents } = await db.query(
            `SELECT id FROM users WHERE role = $1 AND active = true`, [next.role]
          );
          for (const agent of nextAgents) {
            await createNotification(agent.id,
              'New Validation Request',
              `Request #${requestId} is ready for your validation.`,
              'INFO', requestId, 'REQUEST');
          }
        }
        return res.json({ validation: valRows[0] });
      }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('validate error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ── GET /api/validations/:requestId ──────────────────────────────────────────
const getByRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    // Students can only view their own requests' validations
    if (req.user.role === 'STUDENT') {
      const { rows } = await db.query(
        'SELECT student_id FROM requests WHERE id = $1',
        [requestId]
      );
      if (!rows[0] || rows[0].student_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { rows } = await db.query(
      `SELECT v.*,
              u.nom AS agent_nom, u.prenom AS agent_prenom
         FROM validations v
         LEFT JOIN users u ON u.id = v.agent_id
        WHERE v.request_id = $1
        ORDER BY v.created_at ASC`,
      [requestId]
    );

    res.json({ validations: rows });
  } catch (err) {
    console.error('getByRequest error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getPending, validate, getByRequest };
