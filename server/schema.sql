-- ============================================================
--  BIT Academic Manager — PostgreSQL schema
--  Run once against an empty database:
--    psql -U postgres -d bit_academic_manager -f schema.sql
-- ============================================================

-- ── Roles enum ───────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'STUDENT',
  'CHEF_CLASSE',
  'SECRETAIRE',
  'DIRECTEUR',
  'CAISSE',
  'IT',
  'LABORATOIRE',
  'ADMIN'
);

-- ── Classes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id                SERIAL PRIMARY KEY,
  nom               VARCHAR(100)  NOT NULL,          -- e.g. "Licence 3 CS"
  filiere           VARCHAR(100)  NOT NULL,          -- e.g. "Informatique"
  niveau            VARCHAR(50)   NOT NULL,          -- e.g. "Licence 3"
  annee_academique  VARCHAR(9)    NOT NULL,          -- e.g. "2023-2024"
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  nom            VARCHAR(100)  NOT NULL,
  prenom         VARCHAR(100)  NOT NULL,
  email          VARCHAR(255)  NOT NULL UNIQUE,
  password_hash  TEXT          NOT NULL,
  role           user_role     NOT NULL DEFAULT 'STUDENT',
  classe_id      INTEGER       REFERENCES classes(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_classe   ON users(classe_id);

-- ── Attendances ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendances (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER       NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  class_id    INTEGER       NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  date        DATE          NOT NULL,
  statut      VARCHAR(20)   NOT NULL CHECK (statut IN ('PRESENT', 'ABSENT', 'RETARD', 'EXCUSE')),
  created_by  INTEGER       NOT NULL REFERENCES users(id),   -- CHEF_CLASSE who recorded it
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, class_id, date)                        -- one record per student per day
);

CREATE INDEX IF NOT EXISTS idx_att_student   ON attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_att_class     ON attendances(class_id);
CREATE INDEX IF NOT EXISTS idx_att_date      ON attendances(date);

-- ── Requests ─────────────────────────────────────────────────
CREATE TYPE request_type   AS ENUM ('RELEVE_NOTES', 'ATTESTATION_INSCRIPTION', 'DIPLOME', 'AUTRE');
CREATE TYPE request_format AS ENUM ('PDF', 'PAPIER');
CREATE TYPE request_statut AS ENUM ('EN_ATTENTE', 'EN_TRAITEMENT', 'PRET', 'RETIRE', 'REJETE');

CREATE TABLE IF NOT EXISTS requests (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          request_type     NOT NULL,
  format        request_format   NOT NULL DEFAULT 'PDF',
  statut        request_statut   NOT NULL DEFAULT 'EN_ATTENTE',
  notes         TEXT,                                        -- student's comment/justification
  rendez_vous   TIMESTAMPTZ,                                 -- scheduled pickup date
  date_demande  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_req_student  ON requests(student_id);
CREATE INDEX IF NOT EXISTS idx_req_statut   ON requests(statut);

-- ── Validations (workflow: CAISSE → IT → LABORATOIRE) ────────
CREATE TYPE service_type        AS ENUM ('CAISSE', 'IT', 'LABORATOIRE');
CREATE TYPE validation_statut   AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE');

CREATE TABLE IF NOT EXISTS validations (
  id              SERIAL PRIMARY KEY,
  request_id      INTEGER             NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  service         service_type        NOT NULL,
  statut          validation_statut   NOT NULL DEFAULT 'EN_ATTENTE',
  commentaire     TEXT,
  agent_id        INTEGER             REFERENCES users(id) ON DELETE SET NULL,
  date_validation TIMESTAMPTZ,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, service)                               -- one validation entry per service per request
);

CREATE INDEX IF NOT EXISTS idx_val_request  ON validations(request_id);
CREATE INDEX IF NOT EXISTS idx_val_service  ON validations(service);

-- ── Auto-update updated_at on requests ───────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Seed: default ADMIN account ──────────────────────────────
-- Password: admin123  (bcrypt hash — change immediately in production)
INSERT INTO users (nom, prenom, email, password_hash, role)
VALUES (
  'Admin',
  'BIT',
  'admin@bit.edu',
  '$2a$10$TnSji7F3nGdsY5haP18TX.HIn.fg.dK.I73R1bTvyI/NWi1SlPzcu',  -- "admin123"
  'ADMIN'
) ON CONFLICT (email) DO NOTHING;
