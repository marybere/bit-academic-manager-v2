const crypto = require('crypto');
const db     = require('../config/db');
const { createNotification } = require('./notificationController');

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const TYPE_LABELS = {
  RELEVE_NOTES:            'Transcript',
  ATTESTATION_INSCRIPTION: 'Enrollment Certificate',
  DIPLOME:                 'Diploma',
  AUTRE:                   'Document',
};

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
// Used by secretary to update TRANSCRIPT requests directly (no dept validation)
// When PRET: notifies student based on format (PDF email or PAPIER pickup)
const updateStatut = async (req, res) => {
  const { id }                        = req.params;
  const { statut, rendez_vous, notes } = req.body;

  if (!VALID_STATUTS.includes(statut)) {
    return res.status(400).json({ error: `statut must be one of ${VALID_STATUTS.join('|')}` });
  }

  try {
    const { rows: existing } = await db.query(
      'SELECT * FROM requests WHERE id = $1',
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

    const updated = rows[0];

    // Notify student when transcript is marked ready
    if (statut === 'PRET' && existing[0].type === 'RELEVE_NOTES') {
      if (updated.format === 'PDF') {
        await createNotification(
          updated.student_id,
          'Your Transcript Is Ready',
          'Your transcript has been processed — please check your email for the PDF.',
          'SUCCESS', id, 'REQUEST'
        );
      } else {
        const dateStr = rendez_vous
          ? new Date(rendez_vous).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
          : null;
        await createNotification(
          updated.student_id,
          'Your Transcript Is Ready for Pickup',
          dateStr
            ? `Your transcript is ready. Please come to the Secretary Office on ${dateStr}.`
            : 'Your transcript is ready. Please visit the Secretary Office to collect it.',
          'SUCCESS', id, 'REQUEST'
        );
      }
    }

    res.json({ request: updated });
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
// Secretary forwards EN_ATTENTE ATTESTATION/DIPLOME → departments (CAISSE → IT → LABO)
// RELEVE_NOTES (transcripts) are processed directly by secretary — do NOT forward
const forward = async (req, res) => {
  const { id } = req.params;

  console.log('=== FORWARD TO DEPTS ===');
  console.log('Request ID:', id);
  console.log('Secretary:', req.user.email);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Get request with student info
    const { rows: reqRows } = await client.query(
      `SELECT r.*, u.nom, u.prenom, u.email AS student_email
         FROM requests r
         JOIN users u ON r.student_id = u.id
        WHERE r.id = $1`,
      [id]
    );

    if (!reqRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = reqRows[0];
    console.log('Request type:', request.type, '| Status:', request.statut);
    console.log('Student:', request.prenom, request.nom);

    // 2. Block transcripts — processed directly by secretary
    if (request.type === 'RELEVE_NOTES') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Transcripts do not require department validation. Use "Process Transcript" instead.'
      });
    }

    // 3. Must be EN_ATTENTE to forward
    if (request.statut !== 'EN_ATTENTE') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Request already forwarded (status: ${request.statut})`
      });
    }

    // 4. Create/reset validation stubs for all 3 departments
    //    DO UPDATE ensures stubs are reset if previously forwarded
    for (const service of ['CAISSE', 'IT', 'LABORATOIRE']) {
      await client.query(
        `INSERT INTO validations (request_id, service, statut)
         VALUES ($1, $2, 'EN_ATTENTE')
         ON CONFLICT (request_id, service)
         DO UPDATE SET statut = 'EN_ATTENTE',
                       commentaire = NULL,
                       date_validation = NULL,
                       agent_id = NULL`,
        [id, service]
      );
    }

    // 5. Update request to EN_TRAITEMENT
    await client.query(
      `UPDATE requests SET statut = 'EN_TRAITEMENT' WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    // 6. Notify CAISSE users (first in chain)
    const { rows: caisseUsers } = await db.query(
      `SELECT id, nom, prenom FROM users WHERE role = 'CAISSE' AND active = true`
    );
    console.log(`Found ${caisseUsers.length} CAISSE users to notify`);

    for (const caisseUser of caisseUsers) {
      await createNotification(
        caisseUser.id,
        'New Validation Required — Finance Office',
        `Student ${request.prenom} ${request.nom} submitted a ${request.type} request (#${id}) that needs your validation.`,
        'INFO',
        id,
        'REQUEST'
      );
      console.log(`Notified CAISSE user: ${caisseUser.nom}`);
    }

    // 7. Notify student
    await createNotification(
      request.student_id,
      'Request Forwarded to Departments',
      'Your request is now being processed. The Finance Office will review it first.',
      'INFO',
      id,
      'REQUEST'
    );

    res.json({
      message: 'Request forwarded to departments successfully',
      request: { ...request, statut: 'EN_TRAITEMENT' },
      notified: caisseUsers.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('forward error:', err);
    res.status(500).json({ error: err.message });
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
// Secretary schedules pickup (→ PRET + rendez_vous)
// Works for BOTH:
//   - ATTESTATION/DIPLOME in APPROUVE status (all depts validated)
//   - RELEVE_NOTES (TRANSCRIPT) in EN_TRAITEMENT or EN_ATTENTE (processed directly)
const schedulePickup = async (req, res) => {
  const { id } = req.params;
  const { rendez_vous } = req.body;
  const nodemailer = require('nodemailer');

  if (!rendez_vous) return res.status(400).json({ error: 'rendez_vous date is required' });
  try {
    const confirmToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const confirmUrl   = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/requests/confirm/${confirmToken}`;

    const { rows } = await db.query(
      `UPDATE requests SET statut = 'PRET', rendez_vous = $1,
        confirmation_token = $2, confirmation_token_expiry = $3
        WHERE id = $4 AND (
          statut = 'APPROUVE'
          OR (type = 'RELEVE_NOTES' AND statut IN ('EN_ATTENTE', 'EN_TRAITEMENT'))
        )
        RETURNING *`,
      [rendez_vous, confirmToken, tokenExpiry, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or cannot be scheduled in current status' });

    const dateStr = new Date(rendez_vous).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
    await createNotification(rows[0].student_id, 'Document Ready for Pickup',
      `Your document is ready. Please come to the Secretary Office on ${dateStr}.`,
      'SUCCESS', id, 'REQUEST');

    const { rows: studentRows } = await db.query(
      'SELECT email, nom, prenom FROM users WHERE id = $1', [rows[0].student_id]
    );

    if (studentRows[0]) {
      const u = studentRows[0];
      const docType = TYPE_LABELS[rows[0].type] || rows[0].type;
      console.log(`Sending pickup scheduled email to: ${u.email}`);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });

      transporter.sendMail({
        from:    `"BIT Academic Manager" <${process.env.EMAIL_USER}>`,
        to:      u.email,
        subject: `Document Ready for Pickup — BIT Academic Manager`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;
            background:#fff;border-radius:10px;overflow:hidden;
            box-shadow:0 2px 10px rgba(0,0,0,0.1)">
            <div style="background:#0F1929;padding:28px 32px;text-align:center">
              <h1 style="color:#C8184A;margin:0;font-size:22px">BIT Academic Manager</h1>
              <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">
                Burkina Institute of Technology</p>
            </div>
            <div style="padding:32px">
              <p style="font-size:16px;color:#0f172a">
                Hello, <strong>${u.prenom} ${u.nom}</strong>,</p>
              <p style="font-size:14px;color:#475569;line-height:1.6">
                Your <strong>${docType}</strong> is ready for pickup at the Secretary's Office.</p>
              <div style="background:#fff7ed;border:1px solid #fed7aa;
                border-left:4px solid #c2410c;border-radius:8px;
                padding:16px 20px;margin:20px 0;text-align:center">
                <div style="font-size:32px">📅</div>
                <div style="font-size:16px;font-weight:bold;color:#c2410c;margin-top:8px">
                  ${dateStr}</div>
                <div style="font-size:13px;color:#7c3aed;margin-top:4px">Secretary's Office — BIT</div>
              </div>
              <div style="text-align:center;margin:28px 0">
                <p style="font-size:13px;color:#475569;margin-bottom:16px">
                  Once you have collected your document, please confirm by clicking the button below:</p>
                <a href="${confirmUrl}" style="display:inline-block;background:#166534;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">✅ I Collected My Document</a>
                <p style="font-size:11px;color:#94a3b8;margin-top:12px">
                  This link expires in 30 days.</p>
              </div>
              <p style="font-size:13px;color:#94a3b8">
                If you have any questions, please contact the Secretary's Office at BIT.</p>
            </div>
            <div style="background:#f8fafc;border-top:1px solid #e2e8f0;
              padding:20px 32px;text-align:center;font-size:12px;color:#94a3b8">
              © ${new Date().getFullYear()} Burkina Institute of Technology — Koudougou
            </div>
          </div>`,
      })
        .then(info => console.log(`Pickup email sent to ${u.email} — messageId: ${info?.messageId}`))
        .catch(err => console.warn(`Pickup email failed for ${u.email}:`, err.message));
    }

    res.json({ request: rows[0] });
  } catch (err) {
    console.error('schedulePickup error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/requests/:id/send-pdf ────────────────────────────────────────────
// Secretary uploads and sends a PDF document to the student via email.
const sendPdf = async (req, res) => {
  const { id } = req.params;
  const nodemailer = require('nodemailer');
  const fs         = require('fs');

  console.log('=== SEND PDF CALLED ===');
  console.log('Request ID:', id, '| type:', typeof id);
  console.log('File:', req.file?.filename || 'NO FILE');

  try {
    // Get student + request info in one query
    const { rows: stuRows } = await db.query(
      `SELECT u.id AS student_id, u.email, u.nom, u.prenom, r.type, r.statut
         FROM requests r
         JOIN users u ON r.student_id = u.id
        WHERE r.id = $1`,
      [id]
    );

    if (!stuRows[0]) return res.status(404).json({ error: 'Request not found' });

    const student = stuRows[0];
    console.log('Student:', student.prenom, student.nom, '| Request statut:', student.statut);

    if (!req.file) {
      return res.status(400).json({ error: 'Please select a PDF file to send' });
    }

    const filePath     = req.file.path;
    const docType      = TYPE_LABELS[student.type] || student.type;
    const originalName = `${student.nom}_${student.prenom}_${student.type.replace(/_/g, '-')}.pdf`;

    // Generate confirmation token
    console.log('=== TOKEN GENERATION ===');
    const confirmToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    console.log('Token generated:', confirmToken);
    console.log('Token length:', confirmToken.length);

    // Single atomic UPDATE — statut + token saved together
    const saveResult = await db.query(
      `UPDATE requests
          SET statut = 'PRET',
              confirmation_token = $1,
              confirmation_token_expiry = $2
        WHERE id = $3
        RETURNING id, statut, confirmation_token,
                  LENGTH(confirmation_token) AS token_len`,
      [confirmToken, tokenExpiry, id]
    );
    console.log('Single UPDATE result:', JSON.stringify(saveResult.rows[0]));
    if (saveResult.rows.length === 0) {
      console.error('ERROR: No rows updated — Request ID not found:', id);
      return res.status(404).json({ error: 'Request not found' });
    }

    // Build confirm URL from the EXACT token returned by the DB
    const savedToken = saveResult.rows[0].confirmation_token;
    const confirmUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/requests/confirm/${savedToken}`;
    console.log('Confirm URL:', confirmUrl);

    // In-app notification
    await createNotification(
      student.student_id,
      'Your Document Has Been Sent',
      'Your document has been sent to your email. Please check your inbox.',
      'SUCCESS', id, 'REQUEST'
    );

    // Send email with PDF attached
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    console.log('Sending email with attachment to:', student.email);

    const info = await transporter.sendMail({
      from:    `"BIT Academic Manager" <${process.env.EMAIL_USER}>`,
      to:      student.email,
      subject: `Your ${docType} is Ready — BIT Academic Manager`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;
          background:#fff;border-radius:10px;overflow:hidden;
          box-shadow:0 2px 10px rgba(0,0,0,0.1)">
          <div style="background:#0F1929;padding:28px 32px;text-align:center">
            <h1 style="color:#C8184A;margin:0;font-size:22px">BIT Academic Manager</h1>
            <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">
              Burkina Institute of Technology</p>
          </div>
          <div style="padding:32px">
            <p style="font-size:16px;color:#0f172a">
              Hello, <strong>${student.prenom} ${student.nom}</strong>,</p>
            <p style="font-size:14px;color:#475569;line-height:1.6">
              Your <strong>${docType}</strong> request has been processed.
              Please find your document attached to this email.</p>
            <div style="background:#dcfce7;border:1px solid #bbf7d0;
              border-left:4px solid #166534;border-radius:8px;
              padding:16px 20px;margin:20px 0;text-align:center">
              <div style="font-size:32px">📄</div>
              <div style="font-size:16px;font-weight:bold;color:#166534;margin-top:8px">
                ${originalName}</div>
              <div style="font-size:13px;color:#166534;margin-top:4px">Attached to this email</div>
            </div>
            <div style="text-align:center;margin:28px 0">
              <p style="font-size:13px;color:#475569;margin-bottom:16px">
                Once you have received your document, please confirm by clicking the button below:</p>
              <a href="${confirmUrl}" style="display:inline-block;background:#166534;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">✅ Confirm I Received My Document</a>
              <p style="font-size:11px;color:#94a3b8;margin-top:12px">
                This link expires in 30 days.</p>
            </div>
            <p style="font-size:13px;color:#94a3b8">
              If you have any questions, please contact the Secretary's Office at BIT.</p>
          </div>
          <div style="background:#f8fafc;border-top:1px solid #e2e8f0;
            padding:20px 32px;text-align:center;font-size:12px;color:#94a3b8">
            © ${new Date().getFullYear()} Burkina Institute of Technology — Koudougou
          </div>
        </div>`,
      attachments: [{ filename: originalName, path: filePath, contentType: 'application/pdf' }],
    });

    console.log('Email sent:', info.messageId);

    // Delete temp file
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Could not delete temp file:', err.message);
    });

    res.json({ message: 'PDF sent successfully to student email', emailSent: true });
  } catch (err) {
    console.error('sendPdf error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /api/requests/:id/reopen ──────────────────────────────────────────────
// Department agent that rejected a request can reopen it after student resolves the issue.
// Only the service that originally rejected can reopen.
const reopenRequest = async (req, res) => {
  const { id } = req.params;
  const service = req.user.role; // CAISSE | IT | LABORATOIRE

  try {
    // Confirm this request was rejected by the calling service
    const { rows } = await db.query(
      `SELECT * FROM requests
        WHERE id = $1
          AND rejection_service = $2
          AND statut = 'EN_ATTENTE_JUSTIFICATION'`,
      [id, service]
    );
    if (!rows[0]) {
      return res.status(403).json({ error: 'Only the rejecting department can reopen this request, or it is not pending justification.' });
    }

    // Reset this department's validation row to EN_ATTENTE
    await db.query(
      `UPDATE validations
          SET statut          = 'EN_ATTENTE',
              commentaire     = NULL,
              date_validation = NULL,
              agent_id        = NULL
        WHERE request_id = $1 AND service = $2`,
      [id, service]
    );

    // Restore request to EN_TRAITEMENT, clear rejection fields
    await db.query(
      `UPDATE requests
          SET statut            = 'EN_TRAITEMENT',
              rejection_service = NULL,
              rejection_reason  = NULL
        WHERE id = $1`,
      [id]
    );

    // Notify student
    await createNotification(
      rows[0].student_id,
      'Request Reopened',
      'Your request has been reopened and is back in the validation process.',
      'SUCCESS', id, 'REQUEST'
    );

    res.json({ message: 'Request reopened successfully' });
  } catch (err) {
    console.error('reopenRequest error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/requests/confirm/:token ─────────────────────────────────────────
// Public — student clicks email link → serves HTML page directly (no React)
const confirmReception = async (req, res) => {
  const { token } = req.params;
  const cleanToken = (token || '').trim().replace(/\s+/g, '');
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
  const year = new Date().getFullYear();

  console.log('=== CONFIRM RECEPTION ===');
  console.log('Token:', cleanToken.substring(0, 20) + '...');
  console.log('Length:', cleanToken.length);

  const successHTML = (name, docType) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reception Confirmed — BIT Academic Manager</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:16px;padding:48px 40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px;width:100%}
    .hdr{background:#0F1929;border-radius:10px;padding:16px 24px;margin-bottom:32px}
    .hdr h1{color:#C8184A;font-size:20px;margin:0}
    .hdr p{color:rgba(255,255,255,.6);font-size:12px;margin-top:4px}
    .circle{width:80px;height:80px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;box-shadow:0 4px 16px rgba(34,197,94,.4)}
    .circle svg{width:40px;height:40px}
    h2{color:#166534;font-size:26px;margin-bottom:12px}
    .msg{color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px}
    .info{background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #22c55e;border-radius:8px;padding:14px 18px;margin-bottom:28px;font-size:13px;color:#166534;text-align:left;line-height:1.6}
    .btn{display:block;width:100%;background:#C8184A;color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;margin-bottom:10px}
    .btn2{display:block;width:100%;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;padding:12px;font-size:14px;cursor:pointer;text-decoration:none}
    .foot{margin-top:24px;font-size:12px;color:#94a3b8}
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr"><h1>BIT Academic Manager</h1><p>Burkina Institute of Technology</p></div>
    <div class="circle">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <h2>Reception Confirmed!</h2>
    <p class="msg">Thank you for confirming that you received your document.</p>
    <div class="info">
      ✅ Your <strong>${docType}</strong> request has been marked as <strong>Collected</strong> and archived.<br>
      The Secretary's Office has been notified.
    </div>
    <a href="${FRONTEND}/login" class="btn">Go to My Requests</a>
    <a href="javascript:window.close()" class="btn2">Close this page</a>
    <div class="foot">© ${year} Burkina Institute of Technology — Koudougou</div>
  </div>
</body>
</html>`;

  const errorHTML = (title, message) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Error — BIT Academic Manager</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:16px;padding:48px 40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:420px;width:100%}
    .hdr{background:#0F1929;border-radius:10px;padding:16px 24px;margin-bottom:32px}
    .hdr h1{color:#C8184A;font-size:20px;margin:0}
    .hdr p{color:rgba(255,255,255,.6);font-size:12px;margin-top:4px}
    .icon{font-size:56px;margin-bottom:16px}
    h2{color:#991b1b;font-size:20px;margin-bottom:12px}
    .info{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#991b1b;line-height:1.6}
    .note{color:#64748b;font-size:13px;margin-bottom:24px}
    .btn{display:block;width:100%;background:#0F1929;color:#fff;border:none;border-radius:10px;padding:12px 28px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}
    .foot{margin-top:24px;font-size:12px;color:#94a3b8}
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr"><h1>BIT Academic Manager</h1><p>Burkina Institute of Technology</p></div>
    <div class="icon">⚠️</div>
    <h2>${title}</h2>
    <div class="info">${message}</div>
    <p class="note">If you believe this is an error, please contact the Secretary's Office at BIT.</p>
    <a href="${FRONTEND}/login" class="btn">Go to Login</a>
    <div class="foot">© ${year} Burkina Institute of Technology — Koudougou</div>
  </div>
</body>
</html>`;

  try {
    const { rows } = await db.query(
      `SELECT r.id, r.type, r.statut,
              r.confirmation_token,
              r.confirmation_token_expiry,
              u.id AS student_id,
              u.nom, u.prenom, u.email
         FROM requests r
         JOIN users u ON r.student_id = u.id
        WHERE TRIM(r.confirmation_token) = TRIM($1)`,
      [cleanToken]
    );

    console.log('Rows found:', rows.length);

    if (rows.length === 0) {
      const { rows: all } = await db.query(
        `SELECT id, statut, LEFT(confirmation_token,20) AS preview FROM requests WHERE confirmation_token IS NOT NULL`
      );
      console.log('All tokens in DB:', JSON.stringify(all));
      return res.status(400).send(errorHTML('Link Already Used', 'This confirmation link is invalid or has already been used.'));
    }

    const request = rows[0];
    console.log('Request found:', { id: request.id, statut: request.statut });

    if (new Date() > new Date(request.confirmation_token_expiry)) {
      console.log('Token expired');
      return res.status(400).send(errorHTML('Link Expired', 'This confirmation link has expired (links are valid for 30 days).'));
    }

    if (request.statut === 'RETIRE') {
      console.log('Already collected');
      return res.status(200).send(errorHTML('Already Confirmed', 'This document has already been confirmed as collected. No further action needed.'));
    }

    // Mark as collected + clear token
    const { rows: updated } = await db.query(
      `UPDATE requests
          SET statut = 'RETIRE',
              confirmation_token = NULL,
              confirmation_token_expiry = NULL
        WHERE id = $1
        RETURNING *`,
      [request.id]
    );
    console.log('Request updated to RETIRE:', updated[0]?.id);

    const TYPE_LABELS_HTML = {
      RELEVE_NOTES: 'Transcript', ATTESTATION_INSCRIPTION: 'Enrollment Certificate',
      DIPLOME: 'Diploma', AUTRE: 'Document',
    };
    const docType = TYPE_LABELS_HTML[request.type] || request.type;

    // Notify secretaries
    const { rows: secRows } = await db.query(
      `SELECT id, nom FROM users WHERE role = 'SECRETAIRE' AND active = true`
    );
    console.log('Notifying', secRows.length, 'secretaries...');
    for (const sec of secRows) {
      await createNotification(sec.id, '✅ Document collected — Request archived',
        `${request.prenom} ${request.nom} confirmed reception of their ${docType}. Request #${request.id} is now archived.`,
        'SUCCESS', request.id, 'REQUEST');
      console.log('Secretary', sec.nom, 'notified ✅');
    }

    // Notify student
    await createNotification(request.student_id, 'Reception confirmed — Request closed',
      'Thank you! Your request has been marked as Collected and archived.',
      'SUCCESS', request.id, 'REQUEST');

    res.status(200).send(successHTML(`${request.prenom} ${request.nom}`, docType));
  } catch (err) {
    console.error('confirmReception error:', err.message);
    res.status(500).send(errorHTML('Server Error', 'An unexpected error occurred. Please try again or contact the Secretary\'s Office.'));
  }
};

module.exports = { create, getMy, getAll, updateStatut, getById, createForStudent, forward, getReadyForSecretary, schedulePickup, sendPdf, reopenRequest, confirmReception };
