require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

async function resetPasswords() {
  const defaultPassword = 'student123';
  console.log(`Hashing password "${defaultPassword}"...`);
  const hash = await bcrypt.hash(defaultPassword, 10);

  const result = await query(
    `UPDATE users
        SET password_hash = $1
      WHERE role = 'STUDENT'
      RETURNING id, nom, prenom, email, classe_id`,
    [hash]
  );

  if (result.rows.length === 0) {
    console.log('No student accounts found.');
  } else {
    console.log(`\nUpdated ${result.rows.length} student(s):\n`);
    result.rows.forEach(s => {
      console.log(`  ${s.email.padEnd(30)} → password: ${defaultPassword}  (classe_id: ${s.classe_id ?? '—'})`);
    });
    console.log(`\nAll students can now log in with their email and "${defaultPassword}".`);
  }

  process.exit(0);
}

resetPasswords().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
