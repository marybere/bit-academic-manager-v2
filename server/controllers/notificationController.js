const db = require('../config/db');

// ── GET /api/notifications/my ─────────────────────────────────────────────────
const getMyNotifications = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.user.id]
    );
    const unread = rows.filter(n => !n.read).length;
    res.json({ notifications: rows, unread });
  } catch (err) {
    console.error('getMyNotifications error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/notifications/read-all ──────────────────────────────────────────
const markAllRead = async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET read = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('markAllRead error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/notifications/:id/read ──────────────────────────────────────────
const markRead = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `UPDATE notifications SET read = true
        WHERE id = $1 AND user_id = $2
        RETURNING *`,
      [id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: rows[0] });
  } catch (err) {
    console.error('markRead error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── Helper: createNotification ────────────────────────────────────────────────
// Used internally by other controllers to insert notifications.
const createNotification = async (userId, title, message, type = 'INFO', referenceId = null, referenceType = null) => {
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, title, message, type, referenceId, referenceType]
  );
};

module.exports = { getMyNotifications, markAllRead, markRead, createNotification };
