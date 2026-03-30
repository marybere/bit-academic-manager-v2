const db = require('../config/db');

// ── GET /api/analytics/absences ───────────────────────────────────────────────
const getAbsenceStats = async (req, res) => {
  try {
    // 1. Global absenteeism rate
    const { rows: globalRows } = await db.query(
      `SELECT ROUND(
         COUNT(*) FILTER (WHERE statut = 'ABSENT')::numeric
         / NULLIF(COUNT(*), 0) * 100, 1
       ) AS global_rate
         FROM attendances`
    );

    // 2. Per-class breakdown
    const { rows: byClassRows } = await db.query(
      `SELECT c.id,
              c.nom                                                              AS class_name,
              COUNT(*) FILTER (WHERE a.statut = 'ABSENT')                       AS total_absences,
              ROUND(
                COUNT(*) FILTER (WHERE a.statut = 'ABSENT')::numeric
                / NULLIF(COUNT(*), 0) * 100, 1
              )                                                                  AS rate
         FROM attendances a
         JOIN classes c ON c.id = a.class_id
        GROUP BY c.id, c.nom
        ORDER BY rate DESC`
    );

    // 3. Absences by month — last 6 months
    const { rows: byMonthRows } = await db.query(
      `SELECT TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS month,
              COUNT(*) FILTER (WHERE statut = 'ABSENT')      AS total_absences
         FROM attendances
        WHERE date >= date_trunc('month', NOW()) - INTERVAL '5 months'
        GROUP BY month
        ORDER BY month ASC`
    );

    // 4. At-risk students (absence rate > 20%)
    const { rows: atRiskRows } = await db.query(
      `SELECT u.id,
              u.nom, u.prenom,
              c.nom                                                             AS classe,
              COUNT(*) FILTER (WHERE a.statut = 'ABSENT')                      AS absences,
              COUNT(*)                                                          AS total,
              ROUND(
                COUNT(*) FILTER (WHERE a.statut = 'ABSENT')::numeric
                / NULLIF(COUNT(*), 0) * 100, 1
              )                                                                 AS rate
         FROM attendances a
         JOIN users u ON u.id = a.student_id
         LEFT JOIN classes c ON c.id = u.classe_id
        GROUP BY u.id, u.nom, u.prenom, c.nom
       HAVING ROUND(
                COUNT(*) FILTER (WHERE a.statut = 'ABSENT')::numeric
                / NULLIF(COUNT(*), 0) * 100, 1
              ) > 20
        ORDER BY rate DESC`
    );

    res.json({
      global_rate:       parseFloat(globalRows[0].global_rate) || 0,
      by_class:          byClassRows,
      by_month:          byMonthRows,
      at_risk_students:  atRiskRows,
    });
  } catch (err) {
    console.error('getAbsenceStats error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/analytics/requests ───────────────────────────────────────────────
const getRequestStats = async (req, res) => {
  try {
    // Counts
    const { rows: countsRows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE statut = 'EN_ATTENTE')                         AS total_pending,
         COUNT(*) FILTER (WHERE date_demande::date = CURRENT_DATE
                            AND statut != 'EN_ATTENTE')                        AS processed_today,
         COUNT(*) FILTER (WHERE type = 'RELEVE_NOTES'
                            AND date_trunc('month', date_demande)
                              = date_trunc('month', NOW()))                    AS transcripts_this_month
         FROM requests`
    );

    // Average processing time (date_demande → updated_at for PRET/RETIRE)
    const { rows: avgRows } = await db.query(
      `SELECT ROUND(
         AVG(EXTRACT(EPOCH FROM (updated_at - date_demande)) / 86400), 1
       ) AS avg_processing_days
         FROM requests
        WHERE statut IN ('PRET', 'RETIRE')`
    );

    // By type
    const { rows: byTypeRows } = await db.query(
      `SELECT type, COUNT(*) AS count
         FROM requests
        GROUP BY type
        ORDER BY count DESC`
    );

    // By status
    const { rows: byStatutRows } = await db.query(
      `SELECT statut, COUNT(*) AS count
         FROM requests
        GROUP BY statut
        ORDER BY count DESC`
    );

    const c = countsRows[0];
    res.json({
      total_pending:          parseInt(c.total_pending)          || 0,
      processed_today:        parseInt(c.processed_today)        || 0,
      transcripts_this_month: parseInt(c.transcripts_this_month) || 0,
      avg_processing_days:    parseFloat(avgRows[0].avg_processing_days) || 0,
      by_type:                byTypeRows,
      by_status:              byStatutRows,
    });
  } catch (err) {
    console.error('getRequestStats error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getAbsenceStats, getRequestStats };
