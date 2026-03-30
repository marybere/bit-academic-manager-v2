require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const SEED_STUDENTS = {
  CS: [
    { nom: 'Compaoré', prenom: 'Issa',    email_prefix: 'issa.compaore' },
    { nom: 'Ilboudo',  prenom: 'Rasmata', email_prefix: 'rasmata.ilboudo' },
    { nom: 'Nikiema',  prenom: 'Wendlam', email_prefix: 'wendlam.nikiema' },
  ],
  EE: [
    { nom: 'Sawadogo', prenom: 'Adama',   email_prefix: 'adama.sawadogo' },
    { nom: 'Ouedraogo',prenom: 'Aminata', email_prefix: 'aminata.ouedraogo' },
    { nom: 'Kaboré',   prenom: 'Seydou',  email_prefix: 'seydou.kabore' },
  ],
  ME: [
    { nom: 'Traoré',   prenom: 'Salif',   email_prefix: 'salif.traore' },
    { nom: 'Sanogo',   prenom: 'Mariam',  email_prefix: 'mariam.sanogo' },
    { nom: 'Diallo',   prenom: 'Ibrahim', email_prefix: 'ibrahim.diallo' },
  ],
};

async function seedAllClasses() {
  const defaultPassword = 'student123';
  console.log(`Hashing password "${defaultPassword}"...`);
  const hash = await bcrypt.hash(defaultPassword, 10);

  const { rows: classes } = await query(
    'SELECT id, nom, filiere, niveau FROM classes ORDER BY filiere, niveau'
  );

  console.log(`\nFound ${classes.length} classes.\n`);

  for (const cls of classes) {
    const { rows: countRows } = await query(
      "SELECT COUNT(*) AS cnt FROM users WHERE classe_id = $1 AND role = 'STUDENT'",
      [cls.id]
    );
    const count = parseInt(countRows[0].cnt);

    if (count > 0) {
      console.log(`⏭  ${cls.nom.padEnd(30)} already has ${count} student(s) — skipping`);
      continue;
    }

    const templates = SEED_STUDENTS[cls.filiere] || [];
    let added = 0;
    for (const t of templates) {
      const email = `${t.email_prefix}.${cls.niveau.toLowerCase()}@bit.edu`;
      await query(
        `INSERT INTO users (nom, prenom, email, password_hash, role, classe_id)
         VALUES ($1, $2, $3, $4, 'STUDENT', $5)
         ON CONFLICT (email) DO NOTHING`,
        [t.nom, t.prenom, email, hash, cls.id]
      );
      added++;
    }
    console.log(`✅ ${cls.nom.padEnd(30)} — added ${added} students`);
  }

  // Summary
  const { rows: summary } = await query(`
    SELECT c.nom, c.filiere, c.niveau,
           COUNT(u.id) AS student_count,
           STRING_AGG(u.email, ', ' ORDER BY u.nom, u.prenom) AS emails
      FROM classes c
      LEFT JOIN users u ON u.classe_id = c.id AND u.role = 'STUDENT'
     GROUP BY c.id, c.nom, c.filiere, c.niveau
     ORDER BY c.filiere, c.niveau
  `);

  console.log('\n=== FINAL CLASS SUMMARY ===\n');
  summary.forEach(r => {
    console.log(`${r.nom.padEnd(30)} ${r.student_count} student(s)`);
    if (r.emails) {
      r.emails.split(', ').forEach(e => console.log(`   ${e} / ${defaultPassword}`));
    }
  });

  process.exit(0);
}

seedAllClasses().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
