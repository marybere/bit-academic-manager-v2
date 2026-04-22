const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { sendRequestStatusEmail } = require('../services/emailService');

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
// Returns requests pending for the calling agent's service.
const getPending = async (req, res) => {
  const agentRole = req.user.role;
  const service   = roleToService(agentRole);

  if (!service) {
    return res.status(403).json({ error: 'Your role does not perform validations' });
  }

  try {
    console.log('getPending called for:', agentRole, '→ service:', service);

    // Debug: log all validations for this service regardless of status
    const { rows: checkRows } = await db.query(
      `SELECT v.id, v.statut AS v_statut, r.id AS req_id, r.statut AS req_statut
         FROM validations v
         JOIN requests r ON v.request_id = r.id
        WHERE v.service = $1`,
      [service]
    );
    console.log(`Total validations for ${service}:`, checkRows.length, checkRows);

    // Permissive main query — fetch all rows for this service where request is active
    const { rows: allRows } = await db.query(
      `SELECT DISTINCT
         r.id,
         r.type,
         r.format,
         r.statut AS request_statut,
         r.date_demande,
         r.notes,
         r.rejection_service,
         r.rejection_reason,
         u.nom,
         u.prenom,
         u.email,
         c.nom AS classe_nom,
         v.id AS validation_id,
         v.statut AS validation_statut,
         v.commentaire AS my_commentaire,
         v.date_validation AS my_validation_date
       FROM validations v
       JOIN requests r ON v.request_id = r.id
       JOIN users u ON r.student_id = u.id
       LEFT JOIN classes c ON u.classe_id = c.id
       WHERE v.service = $1
         AND r.statut IN ('EN_TRAITEMENT', 'EN_ATTENTE_JUSTIFICATION')
       ORDER BY r.date_demande ASC`,
      [service]
    );

    // Needs action: this dept's stub is EN_ATTENTE and request is EN_TRAITEMENT
    const needsAction = allRows.filter(r =>
      r.validation_statut === 'EN_ATTENTE' &&
      r.request_statut === 'EN_TRAITEMENT'
    );

    // Pending justification: request flagged by THIS dept, awaiting student resolution
    const pendingJustification = allRows.filter(r =>
      r.request_statut === 'EN_ATTENTE_JUSTIFICATION' &&
      r.rejection_service === service
    );

    console.log(`Needs action: ${needsAction.length}, Pending justification: ${pendingJustification.length}`);

    res.json({ service, pending: needsAction, pendingJustification });
  } catch (err) {
    console.error('getPending error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/validations/:requestId ─────────────────────────────────────────
// Body: { statut: 'VALIDE'|'REJETE', commentaire }
const validate = async (req, res) => {
  const { requestId }         = req.params;
  const { statut, commentaire } = req.body;

  console.log('=== VALIDATION SUBMITTED ===');
  console.log('Service:', req.user.role);
  console.log('Request ID:', requestId);
  console.log('Decision:', statut);

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

    // Confirm request exists and get student info
    const { rows: reqRows } = await client.query(
      `SELECT r.*, u.nom, u.prenom, u.email FROM requests r
         JOIN users u ON r.student_id = u.id
        WHERE r.id = $1`,
      [requestId]
    );
    if (!reqRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const studentName  = `${reqRows[0].prenom} ${reqRows[0].nom}`;
    const studentId    = reqRows[0].student_id;
    const studentEmail = reqRows[0].email;
    const requestType  = reqRows[0].type;

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

    const SERVICE_NAMES = { CAISSE: 'Finance Office', IT: 'IT Department', LABORATOIRE: 'Laboratory' };
    const svcLabel = SERVICE_NAMES[service] || service;

    // If rejected → request awaits student justification (NOT final rejection)
    if (statut === 'REJETE') {
      await client.query(
        `UPDATE requests
            SET statut            = 'EN_ATTENTE_JUSTIFICATION',
                rejection_service = $1,
                rejection_reason  = $2
          WHERE id = $3`,
        [service, commentaire || null, requestId]
      );
      await client.query('COMMIT');

      // Notify student
      await createNotification(
        studentId,
        'Action Required — Request Pending Justification',
        `Your request was flagged by ${svcLabel}${commentaire ? `. Reason: "${commentaire}"` : ''}. Please contact the Secretary Office to resolve this.`,
        'WARNING', requestId, 'REQUEST'
      );
      console.log(`Notified student ${studentName} of rejection by ${svcLabel}`);

      console.log(`Sending rejection email to: ${studentEmail}`);
      sendRequestStatusEmail(studentEmail, studentName, requestType, 'EN_ATTENTE_JUSTIFICATION', commentaire || null)
        .then(info => console.log(`Rejection email sent to ${studentEmail} — messageId: ${info?.messageId}`))
        .catch(err => console.warn(`Rejection email failed for ${studentEmail}:`, err.message));

      // Notify secretaries
      const { rows: secs } = await db.query(
        `SELECT id FROM users WHERE role = 'SECRETAIRE' AND active = true`
      );
      for (const sec of secs) {
        await createNotification(
          sec.id,
          'Request Pending Justification',
          `Request #${requestId} from ${studentName} flagged by ${svcLabel}${commentaire ? `: "${commentaire}"` : ''}. Student must resolve before continuing.`,
          'WARNING', requestId, 'REQUEST'
        );
      }
      console.log(`Notified ${secs.length} secretaries of pending justification`);

      return res.json({ validation: valRows[0], statut: 'EN_ATTENTE_JUSTIFICATION' });
    } else {
      // Check if ALL 3 services have now validated → APPROUVE
      const { rows: allRows } = await client.query(
        `SELECT COUNT(*) AS cnt
           FROM validations
          WHERE request_id = $1 AND statut = 'VALIDE'`,
        [requestId]
      );
      console.log(`Validated count: ${allRows[0].cnt} / ${WORKFLOW.length}`);

      if (parseInt(allRows[0].cnt) >= WORKFLOW.length) {
        await client.query(
          "UPDATE requests SET statut = 'APPROUVE' WHERE id = $1",
          [requestId]
        );
        await client.query('COMMIT');

        // Notify student
        await createNotification(studentId,
          'Your Request is Approved!',
          'All departments have validated your request. The secretary will contact you soon.',
          'SUCCESS', requestId, 'REQUEST');
        console.log(`Notified student ${studentName} — fully approved`);

        console.log(`Sending approval email to: ${studentEmail}`);
        sendRequestStatusEmail(studentEmail, studentName, requestType, 'APPROUVE')
          .then(info => console.log(`Approval email sent to ${studentEmail} — messageId: ${info?.messageId}`))
          .catch(err => console.warn(`Approval email failed for ${studentEmail}:`, err.message));

        // Notify all secretaries
        const { rows: secretaries } = await db.query(
          `SELECT id FROM users WHERE role = 'SECRETAIRE' AND active = true`
        );
        for (const sec of secretaries) {
          await createNotification(sec.id,
            'Request Fully Validated — Action Required',
            `Request #${requestId} from ${studentName} has been approved by all departments and requires your action.`,
            'SUCCESS', requestId, 'REQUEST');
        }
        console.log(`Notified ${secretaries.length} secretaries — request fully approved`);

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
          console.log(`Notifying ${nextAgents.length} ${next.role} users (next in chain)`);
          for (const agent of nextAgents) {
            await createNotification(agent.id,
              `Validation Required — ${SERVICE_NAMES[next.service] || next.service}`,
              `${svcLabel} approved request #${requestId} from ${studentName}. Now needs your validation.`,
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

// ── GET /api/validations/my-history ──────────────────────────────────────────
// Returns validations the calling agent has already decided (VALIDE or REJETE)
const getMyHistory = async (req, res) => {
  const service = roleToService(req.user.role);
  if (!service) {
    return res.status(403).json({ error: 'Your role does not perform validations' });
  }
  try {
    const { rows } = await db.query(
      `SELECT
         v.id             AS validation_id,
         v.statut         AS decision,
         v.commentaire,
         v.date_validation,
         r.id             AS request_id,
         r.type           AS request_type,
         r.format,
         r.statut         AS request_statut,
         r.date_demande,
         u.nom, u.prenom, u.email,
         c.nom            AS classe_nom
       FROM validations v
       JOIN requests r ON v.request_id = r.id
       JOIN users u ON r.student_id = u.id
       LEFT JOIN classes c ON u.classe_id = c.id
       WHERE v.service = $1
         AND v.statut IN ('VALIDE', 'REJETE')
       ORDER BY v.date_validation DESC`,
      [service]
    );
    res.json({ validations: rows });
  } catch (err) {
    console.error('getMyHistory error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getPending, validate, getByRequest, getMyHistory };
