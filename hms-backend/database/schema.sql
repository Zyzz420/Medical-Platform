-- HMS PostgreSQL Schema — current as of May 2026
-- Run once against a fresh database: psql -U postgres -d hms_db -f database/schema.sql
-- For existing databases apply the migration files in database/migration_*.sql instead.

-- ============================================================
-- PHASE 1: Foundation (no dependencies)
-- ============================================================

CREATE TABLE patients (
    patient_id     SERIAL PRIMARY KEY,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    date_of_birth  DATE NOT NULL,
    gender         VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other')),
    blood_type     VARCHAR(5)  CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    contact_number VARCHAR(20),
    email          VARCHAR(255) UNIQUE,
    address        TEXT,
    national_id    VARCHAR(20),
    sha_number     VARCHAR(30),  -- SHA beneficiary number, used for claims/service verification
    deleted_at     TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doctors (
    doctor_id      SERIAL PRIMARY KEY,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    specialty      VARCHAR(100),
    license_number VARCHAR(50) UNIQUE NOT NULL,
    contact_number VARCHAR(20),
    email          VARCHAR(255) UNIQUE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id    SERIAL PRIMARY KEY,
    email      VARCHAR(255) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(50) NOT NULL CHECK (role IN ('admin','receptionist','doctor','nurse','pharmacist','lab_technician','patient')),
    doctor_id  INT REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    patient_id INT REFERENCES patients(patient_id) ON DELETE SET NULL,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_invites (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    role       VARCHAR(50)  NOT NULL,
    token      VARCHAR(255) NOT NULL UNIQUE,
    used       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE TABLE drug_inventory (
    drug_id            SERIAL PRIMARY KEY,
    medication_name    VARCHAR(255) NOT NULL UNIQUE,
    unit               VARCHAR(50)  NOT NULL DEFAULT 'tablets',
    quantity_in_stock  INT          NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
    reorder_threshold  INT          NOT NULL DEFAULT 10,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wards (
    ward_id   SERIAL PRIMARY KEY,
    ward_name VARCHAR(100) NOT NULL,
    ward_type VARCHAR(50) CHECK (ward_type IN ('General', 'ICU', 'Maternity', 'Pediatric', 'Surgical', 'Emergency'))
);

CREATE TABLE beds (
    bed_id      SERIAL PRIMARY KEY,
    ward_id     INT NOT NULL REFERENCES wards(ward_id),
    bed_number  VARCHAR(20) NOT NULL,
    is_occupied BOOLEAN DEFAULT FALSE,
    UNIQUE (ward_id, bed_number)
);

-- ============================================================
-- PHASE 2: Core Clinical Workflow
-- ============================================================

CREATE TABLE appointments (
    appointment_id       SERIAL PRIMARY KEY,
    patient_id           INT NOT NULL REFERENCES patients(patient_id),
    doctor_id            INT NOT NULL REFERENCES doctors(doctor_id),
    appointment_datetime TIMESTAMP NOT NULL,
    reason               TEXT,
    status               VARCHAR(50) DEFAULT 'Scheduled'
                             CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'No-Show')),
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medical_records (
    record_id          SERIAL PRIMARY KEY,
    appointment_id     INT NOT NULL UNIQUE REFERENCES appointments(appointment_id),
    consultation_notes TEXT,
    diagnosis          TEXT,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PHASE 3: Laboratory Module
-- ============================================================

CREATE TABLE lab_orders (
    lab_order_id SERIAL PRIMARY KEY,
    record_id    INT REFERENCES medical_records(record_id),   -- nullable: inpatient orders use admission_id
    admission_id INT,                                          -- FK added after admissions table below
    test_name    VARCHAR(255) NOT NULL,
    status       VARCHAR(50) DEFAULT 'Ordered'
                     CHECK (status IN ('Ordered', 'Sample Collected', 'Processing', 'Completed', 'Cancelled')),
    order_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lab_results (
    result_id    SERIAL PRIMARY KEY,
    lab_order_id INT NOT NULL UNIQUE REFERENCES lab_orders(lab_order_id),
    result_data  TEXT NOT NULL,
    status       VARCHAR(50) DEFAULT 'Pending Review'
                     CHECK (status IN ('Pending Review', 'Results Reviewed', 'Requires Follow-up')),
    reviewed_at  TIMESTAMP
);

-- ============================================================
-- PHASE 4: Pharmacy Module
-- ============================================================

CREATE TABLE prescriptions (
    prescription_id SERIAL PRIMARY KEY,
    record_id       INT REFERENCES medical_records(record_id),  -- nullable: inpatient prescriptions use admission_id
    admission_id    INT,                                          -- FK added after admissions table below
    medication_name VARCHAR(255) NOT NULL,
    dosage          VARCHAR(100) NOT NULL,
    instructions    TEXT,
    status          VARCHAR(50) DEFAULT 'Created'
                        CHECK (status IN ('Created', 'Sent to Pharmacy', 'Dispensed', 'Cancelled'))
);

CREATE TABLE pharmacy_dispensing (
    dispense_id         SERIAL PRIMARY KEY,
    prescription_id     INT NOT NULL REFERENCES prescriptions(prescription_id),
    dispensed_date      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    quantity_dispensed  INT NOT NULL CHECK (quantity_dispensed > 0),
    status              VARCHAR(50) DEFAULT 'Stock Verified'
                            CHECK (status IN ('Stock Verified', 'Medication Dispensed', 'Partially Dispensed'))
);

-- ============================================================
-- PHASE 5: Inpatient Workflow
-- ============================================================

CREATE TABLE admissions (
    admission_id               SERIAL PRIMARY KEY,
    record_id                  INT NOT NULL REFERENCES medical_records(record_id),
    bed_id                     INT NOT NULL REFERENCES beds(bed_id),
    admission_date             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    inpatient_monitoring_notes TEXT,
    status                     VARCHAR(50) DEFAULT 'Admitted'
                                   CHECK (status IN ('Admitted', 'Transferred', 'Discharged'))
);

CREATE TABLE discharges (
    discharge_id      SERIAL PRIMARY KEY,
    admission_id      INT NOT NULL UNIQUE REFERENCES admissions(admission_id),
    discharge_date    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    discharge_summary TEXT NOT NULL,
    follow_up_plan    TEXT
);

-- Back-fill FK from lab_orders and prescriptions to admissions
ALTER TABLE lab_orders   ADD CONSTRAINT fk_lab_orders_admission   FOREIGN KEY (admission_id) REFERENCES admissions(admission_id) ON DELETE SET NULL;
ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_admission FOREIGN KEY (admission_id) REFERENCES admissions(admission_id) ON DELETE SET NULL;

-- ============================================================
-- PHASE 6: Audit & Soft-Delete Infrastructure
-- ============================================================

-- Audit trail: records who did what to sensitive clinical data
CREATE TABLE audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(user_id) ON DELETE SET NULL,
    role        VARCHAR(50),
    action      VARCHAR(20) NOT NULL,   -- READ | CREATE | UPDATE | DELETE
    resource    VARCHAR(100) NOT NULL,
    resource_id INT,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Soft-delete ledger: clinical records are never permanently destroyed
CREATE TABLE deleted_records (
    table_name VARCHAR(50) NOT NULL,
    record_id  INT        NOT NULL,
    deleted_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (table_name, record_id)
);

-- ============================================================
-- PHASE 7: SHA/DHA Compliance (Data Protection Act consent)
-- ============================================================

CREATE TABLE consent_records (
    id           SERIAL PRIMARY KEY,
    patient_id   INT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL,   -- TREATMENT | DATA_PROCESSING | RESEARCH
    version      VARCHAR(20) NOT NULL DEFAULT '1.0',
    recorded_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawn_at TIMESTAMP
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_beds_ward_id               ON beds(ward_id);
CREATE INDEX idx_appointments_patient_id    ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id     ON appointments(doctor_id);
CREATE INDEX idx_medical_records_appt_id    ON medical_records(appointment_id);
CREATE INDEX idx_lab_orders_record_id       ON lab_orders(record_id);
CREATE INDEX idx_lab_orders_admission_id    ON lab_orders(admission_id);
CREATE INDEX idx_lab_results_order_id       ON lab_results(lab_order_id);
CREATE INDEX idx_prescriptions_record_id    ON prescriptions(record_id);
CREATE INDEX idx_prescriptions_admission_id ON prescriptions(admission_id);
CREATE INDEX idx_dispensing_prescription_id ON pharmacy_dispensing(prescription_id);
CREATE INDEX idx_admissions_record_id       ON admissions(record_id);
CREATE INDEX idx_admissions_bed_id          ON admissions(bed_id);
CREATE INDEX idx_discharges_admission_id    ON discharges(admission_id);
CREATE INDEX idx_audit_log_user_id          ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource         ON audit_log(resource, resource_id);
CREATE INDEX idx_audit_log_created_at       ON audit_log(created_at DESC);
CREATE INDEX idx_deleted_records_table      ON deleted_records(table_name, record_id);
CREATE INDEX idx_users_email                ON users(email);
CREATE INDEX idx_patients_sha_number        ON patients(sha_number) WHERE sha_number IS NOT NULL;
CREATE INDEX idx_consent_records_patient_id ON consent_records(patient_id);
CREATE INDEX idx_users_patient_id           ON users(patient_id);
CREATE INDEX idx_drug_inventory_name        ON drug_inventory(medication_name);

-- ============================================================
-- Auto-update updated_at via trigger
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_medical_records_updated_at
    BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_drug_inventory_updated_at
    BEFORE UPDATE ON drug_inventory
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
