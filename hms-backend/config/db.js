const { Pool, types } = require('pg');

// Return TIMESTAMP columns as plain strings so node-postgres doesn't
// shift them to UTC (the DB stores local wall-clock time without a timezone).
types.setTypeParser(1114, (val) => val);

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Supabase and other managed providers require SSL
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // Keep a few idle connections ready; limit burst connections
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// expose a migration helper so server.js can await it before listen()
async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deleted_records (
      table_name VARCHAR(50) NOT NULL,
      record_id  INT         NOT NULL,
      deleted_by INT REFERENCES users(user_id) ON DELETE SET NULL,
      deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (table_name, record_id)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_deleted_records_table
      ON deleted_records(table_name, record_id)
  `);
  // Soft-delete columns — require table ownership (postgres on local dev, app user on Render).
  // On Render this succeeds automatically; locally, run database/migration_patients_appointments_soft_deletes.sql as postgres.
  try {
    await pool.query(`ALTER TABLE patients     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
    await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_patients_deleted_at     ON patients(deleted_at)     WHERE deleted_at IS NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_deleted_at ON appointments(deleted_at) WHERE deleted_at IS NULL`);
  } catch (err) {
    console.warn('Soft-delete migration skipped (run as table owner to apply):', err.message);
  }
  // SHA/DHA compliance: beneficiary identifiers + consent records.
  // See database/migration_sha_dha_compliance.sql for the standalone version.
  // These run as two independent steps: the ALTER TABLEs need ownership of
  // `patients` (may not be available to the app's DB user — see soft-delete
  // note above), but consent_records only needs CREATE on the schema, which
  // the app user does have. Bundling them in one try/catch would let an
  // ALTER failure silently skip the unrelated, otherwise-successful CREATE
  // TABLE — which is exactly what happened here before this fix.
  try {
    await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS national_id VARCHAR(20)`);
    await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS sha_number   VARCHAR(30)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_patients_sha_number ON patients(sha_number) WHERE sha_number IS NOT NULL`);
  } catch (err) {
    console.warn('SHA/DHA beneficiary-identifier migration skipped (run as table owner to apply):', err.message);
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consent_records (
        id            SERIAL PRIMARY KEY,
        patient_id    INT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
        consent_type  VARCHAR(50) NOT NULL,
        version       VARCHAR(20) NOT NULL DEFAULT '1.0',
        recorded_by   INT REFERENCES users(user_id) ON DELETE SET NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        withdrawn_at  TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_consent_records_patient_id ON consent_records(patient_id)`);
  } catch (err) {
    console.warn('Consent-records migration skipped:', err.message);
  }
  console.log('Migrations complete');
}

pool.runMigrations = runMigrations;

module.exports = pool;
