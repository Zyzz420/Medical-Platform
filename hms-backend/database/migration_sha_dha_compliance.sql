-- SHA/DHA compliance migration
-- Run as the table owner: psql -U postgres -d hms_db -f database/migration_sha_dha_compliance.sql
-- On Render/Supabase this is applied automatically on server startup (see config/db.js).
--
-- 1. Beneficiary identifiers needed for SHA claims verification and service checks.
-- 2. Consent records to satisfy Data Protection Act, 2019 consent-management requirements.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS national_id VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sha_number   VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_patients_sha_number ON patients(sha_number) WHERE sha_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS consent_records (
  id            SERIAL PRIMARY KEY,
  patient_id    INT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  consent_type  VARCHAR(50) NOT NULL,   -- TREATMENT | DATA_PROCESSING | RESEARCH
  version       VARCHAR(20) NOT NULL DEFAULT '1.0',
  recorded_by   INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consent_records_patient_id ON consent_records(patient_id);
