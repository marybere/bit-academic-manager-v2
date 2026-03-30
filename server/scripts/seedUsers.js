require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

async function seed() {
  const hash = await bcrypt.hash('password123', 10)

  // ── Classes ──────────────────────────────────────────────────────────────
  const classes = [
    { nom: 'Licence 3 Computer Science', filiere: 'Informatique', niveau: 'L3', annee_academique: '2023-2024' },
    { nom: 'Licence 2 Networks',         filiere: 'Reseaux',      niveau: 'L2', annee_academique: '2023-2024' },
  ]

  console.log('\nInserting classes...')
  for (const c of classes) {
    await pool.query(
      `INSERT INTO classes (nom, filiere, niveau, annee_academique)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [c.nom, c.filiere, c.niveau, c.annee_academique]
    )
    console.log(`  ✔ ${c.nom}`)
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const users = [
    { email: 'chef@bit.edu',       role: 'CHEF_CLASSE',  nom: 'Koné',      prenom: 'Ibrahim' },
    { email: 'secretaire@bit.edu', role: 'SECRETAIRE',   nom: 'Ouedraogo', prenom: 'Marie'   },
    { email: 'directeur@bit.edu',  role: 'DIRECTEUR',    nom: 'Traore',    prenom: 'Jean'    },
    { email: 'etudiant@bit.edu',   role: 'STUDENT',      nom: 'Bere',      prenom: 'Lydia'   },
    { email: 'caisse@bit.edu',     role: 'CAISSE',       nom: 'Zongo',     prenom: 'Paul'    },
    { email: 'it@bit.edu',         role: 'IT',           nom: 'Sawadogo',  prenom: 'Eric'    },
    { email: 'labo@bit.edu',       role: 'LABORATOIRE',  nom: 'Kabore',    prenom: 'Aline'   },
  ]

  console.log('\nInserting users...')
  for (const u of users) {
    await pool.query(
      `INSERT INTO users (email, password_hash, role, nom, prenom)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role          = EXCLUDED.role,
             nom           = EXCLUDED.nom,
             prenom        = EXCLUDED.prenom`,
      [u.email, hash, u.role, u.nom, u.prenom]
    )
    console.log(`  ✔ ${u.email} (${u.role})`)
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\nAll users in database:')
  const { rows } = await pool.query(
    'SELECT email, role, nom FROM users ORDER BY id'
  )
  console.table(rows)

  await pool.end()
  console.log('\nSeed complete.')
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
