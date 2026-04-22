const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.warn('Email service unavailable:', error.message);
  } else {
    console.log('Email service ready ✓');
  }
});

// ── Shared constants ─────────────────────────────────────────────────────────

const TYPE_LABEL = {
  RELEVE_NOTES:            'Transcript (Relevé de notes)',
  ATTESTATION_INSCRIPTION: 'Enrollment Certificate',
  DIPLOME:                 'Diploma',
  AUTRE:                   'Other Document',
};

const ROLE_LABEL = {
  SECRETAIRE:  'Secretary',
  DIRECTEUR:   'Director',
  CAISSE:      'Finance Agent',
  IT:          'IT Agent',
  LABORATOIRE: 'Laboratory Agent',
  ADMIN:       'Administrator',
};

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Base HTML wrapper ────────────────────────────────────────────────────────

const wrapEmail = (bodyHtml) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: #0F1929; padding: 28px 32px; text-align: center; }
    .header h1 { color: #C8184A; margin: 0 0 6px; font-size: 22px; letter-spacing: 0.5px; }
    .header p { color: rgba(255,255,255,0.55); margin: 0; font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; color: #0f172a; margin: 0 0 14px; font-weight: 600; }
    .message { font-size: 14px; color: #475569; line-height: 1.7; margin: 0 0 22px; }
    .info-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 18px 22px; margin: 0 0 22px; }
    .info-row { display: flex; align-items: flex-start; margin-bottom: 10px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; width: 110px; flex-shrink: 0; padding-top: 2px; }
    .info-value { font-size: 14px; color: #0f172a; font-weight: 600; }
    .pwd-value { font-size: 18px; color: #C8184A; font-weight: 700; letter-spacing: 2px; background: #fff0f3; padding: 4px 12px; border-radius: 6px; border: 1px dashed #fecdd3; }
    .banner-success { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 14px 18px; margin: 0 0 22px; }
    .banner-success p { font-size: 13px; color: #166534; margin: 0; line-height: 1.6; }
    .banner-warning { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin: 0 0 22px; }
    .banner-warning p { font-size: 13px; color: #92400e; margin: 0; line-height: 1.6; }
    .banner-info { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 0 0 22px; }
    .banner-info p { font-size: 13px; color: #1e40af; margin: 0; line-height: 1.6; }
    .banner-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 0 0 22px; }
    .banner-error p { font-size: 13px; color: #991b1b; margin: 0; line-height: 1.6; }
    .divider { border: none; border-top: 1px solid #f1f5f9; margin: 22px 0; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.6; }
    a { color: #C8184A; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>BIT Academic Manager</h1>
      <p>Burkina Institute of Technology</p>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>This is an automated message — please do not reply.<br>
         <a href="${APP_URL}">${APP_URL}</a></p>
    </div>
  </div>
</body>
</html>`;

const send = (to, subject, bodyHtml) =>
  transporter.sendMail({
    from: `"BIT Academic Manager" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: wrapEmail(bodyHtml),
  });

// ── 1. Password reset ────────────────────────────────────────────────────────

const sendPasswordResetEmail = async (toEmail, userName, newPassword, resetBy = 'Administrator') => {
  console.log(`Sending password reset email to: ${toEmail}`);
  const info = await send(toEmail, 'Your Password Has Been Reset — BIT Academic Manager', `
    <p class="greeting">Hello, ${userName}</p>
    <p class="message">Your password has been reset by <strong>${resetBy}</strong>.
      Use the credentials below to sign in, then change your password immediately.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${toEmail}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Password</span>
        <span class="pwd-value">${newPassword}</span>
      </div>
    </div>
    <div class="banner-warning">
      <p><strong>⚠ Important:</strong> Change this password after logging in.
         Do not share this email with anyone.</p>
    </div>
    <hr class="divider">
    <p style="font-size:13px;color:#64748b;margin:0;">Sign in at: <a href="${APP_URL}">${APP_URL}</a></p>
  `);
  return info;
};

// ── 2. Request status — APPROUVE or EN_ATTENTE_JUSTIFICATION ─────────────────

const sendRequestStatusEmail = async (toEmail, userName, requestType, status, notes = '') => {
  const typeLabel = TYPE_LABEL[requestType] || requestType;

  if (status === 'APPROUVE') {
    console.log(`Sending approval email to: ${toEmail}`);
    return send(toEmail, `Your ${typeLabel} Request Has Been Approved — BIT Academic Manager`, `
      <p class="greeting">Hello, ${userName}</p>
      <p class="message">Great news! Your document request has been approved by all departments.
        The secretary will contact you shortly to arrange delivery or pickup.</p>
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Document</span>
          <span class="info-value">${typeLabel}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status</span>
          <span class="info-value" style="color:#166534;">✓ Approved</span>
        </div>
      </div>
      <div class="banner-success">
        <p>All departments (Finance, IT, Laboratory) have validated your request.
           The Secretary Office will process it and notify you when it's ready.</p>
      </div>
      <hr class="divider">
      <p style="font-size:13px;color:#64748b;margin:0;">Track your request at: <a href="${APP_URL}">${APP_URL}</a></p>
    `);
  }

  if (status === 'EN_ATTENTE_JUSTIFICATION') {
    console.log(`Sending rejection/justification email to: ${toEmail}`);
    return send(toEmail, `Action Required — Your ${typeLabel} Request Needs Attention`, `
      <p class="greeting">Hello, ${userName}</p>
      <p class="message">Your document request requires attention before it can be processed further.</p>
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Document</span>
          <span class="info-value">${typeLabel}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status</span>
          <span class="info-value" style="color:#c2410c;">⚠ Pending Justification</span>
        </div>
        ${notes ? `
        <div class="info-row">
          <span class="info-label">Reason</span>
          <span class="info-value">${notes}</span>
        </div>` : ''}
      </div>
      <div class="banner-warning">
        <p><strong>Action required:</strong> Please visit or contact the Secretary Office
           to resolve this issue. Your request will resume once the matter is cleared.</p>
      </div>
      <hr class="divider">
      <p style="font-size:13px;color:#64748b;margin:0;">Track your request at: <a href="${APP_URL}">${APP_URL}</a></p>
    `);
  }
};

// ── 3. Pickup scheduled ──────────────────────────────────────────────────────

const sendPickupScheduledEmail = async (toEmail, userName, requestType, pickupDate) => {
  const typeLabel = TYPE_LABEL[requestType] || requestType;
  const dateStr = pickupDate
    ? new Date(pickupDate).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
    : 'To be confirmed';
  console.log(`Sending pickup email to: ${toEmail}`);
  return send(toEmail, `Your ${typeLabel} Is Ready for Pickup — BIT Academic Manager`, `
    <p class="greeting">Hello, ${userName}</p>
    <p class="message">Your document is ready. Please come to the Secretary Office at the scheduled time below.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Document</span>
        <span class="info-value">${typeLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Pickup Date</span>
        <span class="info-value" style="color:#0ea5e9;">${dateStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Location</span>
        <span class="info-value">Secretary Office — BIT Campus</span>
      </div>
    </div>
    <div class="banner-info">
      <p>Please bring your student ID card. If you cannot make this appointment,
         contact the Secretary Office as soon as possible.</p>
    </div>
  `);
};

// ── 4. PDF sent ──────────────────────────────────────────────────────────────

const sendPdfReadyEmail = async (toEmail, userName, requestType) => {
  const typeLabel = TYPE_LABEL[requestType] || requestType;
  console.log(`Sending PDF ready email to: ${toEmail}`);
  return send(toEmail, `Your ${typeLabel} Has Been Sent — BIT Academic Manager`, `
    <p class="greeting">Hello, ${userName}</p>
    <p class="message">Your document has been processed and sent digitally.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Document</span>
        <span class="info-value">${typeLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Format</span>
        <span class="info-value">PDF (digital)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value" style="color:#166534;">✓ Sent</span>
      </div>
    </div>
    <div class="banner-success">
      <p>Please check your email inbox (and spam folder) for the attached document.
         If you do not receive it within 24 hours, contact the Secretary Office.</p>
    </div>
  `);
};

// ── 5. Account created ───────────────────────────────────────────────────────

const sendAccountCreatedEmail = async (toEmail, userName, password, role) => {
  const roleLabel = ROLE_LABEL[role] || role;
  console.log(`Sending welcome email to: ${toEmail}`);
  return send(toEmail, 'Welcome to BIT Academic Manager — Your Account Is Ready', `
    <p class="greeting">Welcome, ${userName}!</p>
    <p class="message">Your staff account has been created on BIT Academic Manager.
      Use the credentials below to sign in for the first time.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${toEmail}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Password</span>
        <span class="pwd-value">${password}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Role</span>
        <span class="info-value">${roleLabel}</span>
      </div>
    </div>
    <div class="banner-warning">
      <p><strong>⚠ Important:</strong> Please change this password immediately after logging in
         via your profile settings.</p>
    </div>
    <hr class="divider">
    <p style="font-size:13px;color:#64748b;margin:0;">Sign in at: <a href="${APP_URL}">${APP_URL}</a></p>
  `);
};

// ── 6. Account deactivated ───────────────────────────────────────────────────

const sendAccountDeactivatedEmail = async (toEmail, userName, adminName = 'Administrator') => {
  console.log(`Sending deactivation email to: ${toEmail}`);
  return send(toEmail, 'Your Account Has Been Deactivated — BIT Academic Manager', `
    <p class="greeting">Hello, ${userName}</p>
    <p class="message">Your BIT Academic Manager account has been deactivated by <strong>${adminName}</strong>.
      You will no longer be able to sign in until your account is reactivated.</p>
    <div class="banner-error">
      <p>If you believe this is a mistake or need your account restored,
         please contact the system administrator.</p>
    </div>
  `);
};

// ── 7. Account reactivated ───────────────────────────────────────────────────

const sendAccountReactivatedEmail = async (toEmail, userName, adminName = 'Administrator') => {
  console.log(`Sending reactivation email to: ${toEmail}`);
  return send(toEmail, 'Your Account Has Been Reactivated — BIT Academic Manager', `
    <p class="greeting">Hello, ${userName}</p>
    <p class="message">Your BIT Academic Manager account has been reactivated by <strong>${adminName}</strong>.
      You can now sign in again normally.</p>
    <div class="banner-success">
      <p>Your access has been fully restored. Welcome back!</p>
    </div>
    <hr class="divider">
    <p style="font-size:13px;color:#64748b;margin:0;">Sign in at: <a href="${APP_URL}">${APP_URL}</a></p>
  `);
};

// ── 8. Class rep changed ─────────────────────────────────────────────────────

const sendClassRepChangedEmail = async (toEmail, userName, className, isNewChef) => {
  if (isNewChef) {
    console.log(`Sending new class rep email to: ${toEmail}`);
    return send(toEmail, `You've Been Appointed Class Representative — ${className}`, `
      <p class="greeting">Congratulations, ${userName}!</p>
      <p class="message">You have been appointed as the Class Representative for
        <strong>${className}</strong> on BIT Academic Manager.</p>
      <div class="banner-success">
        <p>You now have access to the Class Representative interface, including
           attendance management for your class.</p>
      </div>
      <div class="banner-warning">
        <p><strong>Note:</strong> You must log out and log back in to access your new interface.</p>
      </div>
      <hr class="divider">
      <p style="font-size:13px;color:#64748b;margin:0;">Sign in at: <a href="${APP_URL}">${APP_URL}</a></p>
    `);
  } else {
    console.log(`Sending class rep removal email to: ${toEmail}`);
    return send(toEmail, `Class Representative Role Removed — ${className}`, `
      <p class="greeting">Hello, ${userName}</p>
      <p class="message">Your Class Representative role for <strong>${className}</strong>
        has been transferred to another student.</p>
      <div class="banner-info">
        <p>You have been returned to a standard student account. Your academic data remains intact.
           Please log out and log back in to update your session.</p>
      </div>
      <hr class="divider">
      <p style="font-size:13px;color:#64748b;margin:0;">Sign in at: <a href="${APP_URL}">${APP_URL}</a></p>
    `);
  }
};

module.exports = {
  send,
  sendPasswordResetEmail,
  sendRequestStatusEmail,
  sendPickupScheduledEmail,
  sendPdfReadyEmail,
  sendAccountCreatedEmail,
  sendAccountDeactivatedEmail,
  sendAccountReactivatedEmail,
  sendClassRepChangedEmail,
};
