const pool = require('../config/db');
const { parsePagination, paginatedResponse } = require('../utils/paginate');
const { logAudit } = require('../middleware/audit');

const getAllPatients = async (req, res, next) => {
  const { page, limit, offset } = parsePagination(req.query);
  try {
    const { rows } = await pool.query(
      `SELECT *, COUNT(*) OVER() AS _total
       FROM patients
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(paginatedResponse(rows, page, limit));
  } catch (err) {
    next(err);
  }
};

const getPatientById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM patients WHERE patient_id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Patient not found' });
    logAudit(req, 'READ', 'patients', rows[0].patient_id);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const createPatient = async (req, res, next) => {
  const { first_name, last_name, date_of_birth, gender, blood_type,
          contact_number, email, address, national_id, sha_number } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO patients
         (first_name, last_name, date_of_birth, gender, blood_type, contact_number, email, address, national_id, sha_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [first_name, last_name, date_of_birth, gender, blood_type, contact_number, email, address,
       national_id ?? null, sha_number ?? null]
    );
    logAudit(req, 'CREATE', 'patients', rows[0].patient_id);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const updatePatient = async (req, res, next) => {
  const { first_name, last_name, date_of_birth, gender, blood_type,
          contact_number, email, address, national_id, sha_number } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE patients
       SET first_name = $1, last_name = $2, date_of_birth = $3, gender = $4,
           blood_type = $5, contact_number = $6, email = $7, address = $8,
           national_id = $9, sha_number = $10
       WHERE patient_id = $11 AND deleted_at IS NULL
       RETURNING *`,
      [first_name, last_name, date_of_birth, gender, blood_type,
       contact_number, email, address, national_id ?? null, sha_number ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Patient not found' });
    logAudit(req, 'UPDATE', 'patients', rows[0].patient_id);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Soft-delete: stamps deleted_at and deactivates any linked user account.
// Records are retained to satisfy the health records retention requirement.
const deletePatient = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE patients SET deleted_at = NOW()
       WHERE patient_id = $1 AND deleted_at IS NULL
       RETURNING patient_id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Patient not found' });

    // Deactivate the linked user account so they can no longer log in
    await client.query(
      `UPDATE users SET is_active = false
       WHERE patient_id = $1 AND is_active = true`,
      [req.params.id]
    );

    await client.query('COMMIT');
    logAudit(req, 'DELETE', 'patients', Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// Subject Access Request export (Data Protection Act, 2019 s.26): a full bundle
// of everything the platform holds on a patient, for the patient or an admin to retrieve.
const exportPatientData = async (req, res, next) => {
  const patientId = req.params.id;
  if (req.user.role === 'patient' && Number(req.user.patientId) !== Number(patientId)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const { rows: patientRows } = await pool.query('SELECT * FROM patients WHERE patient_id = $1', [patientId]);
    if (!patientRows.length) return res.status(404).json({ message: 'Patient not found' });

    const [appointments, medicalRecords, labOrders, prescriptions, consents] = await Promise.all([
      pool.query(
        'SELECT * FROM appointments WHERE patient_id = $1 ORDER BY appointment_datetime',
        [patientId]
      ),
      pool.query(
        `SELECT mr.* FROM medical_records mr
         JOIN appointments a ON mr.appointment_id = a.appointment_id
         WHERE a.patient_id = $1
         ORDER BY mr.created_at`,
        [patientId]
      ),
      pool.query(
        `SELECT DISTINCT lo.* FROM lab_orders lo
         LEFT JOIN medical_records mr  ON lo.record_id    = mr.record_id
         LEFT JOIN admissions      ad  ON lo.admission_id = ad.admission_id
         LEFT JOIN medical_records mr2 ON ad.record_id    = mr2.record_id
         LEFT JOIN appointments    a   ON COALESCE(mr.appointment_id, mr2.appointment_id) = a.appointment_id
         WHERE a.patient_id = $1
         ORDER BY lo.order_date`,
        [patientId]
      ),
      pool.query(
        `SELECT DISTINCT p.* FROM prescriptions p
         LEFT JOIN medical_records mr  ON p.record_id    = mr.record_id
         LEFT JOIN admissions      ad  ON p.admission_id = ad.admission_id
         LEFT JOIN medical_records mr2 ON ad.record_id   = mr2.record_id
         LEFT JOIN appointments    a   ON COALESCE(mr.appointment_id, mr2.appointment_id) = a.appointment_id
         WHERE a.patient_id = $1`,
        [patientId]
      ),
      pool.query('SELECT * FROM consent_records WHERE patient_id = $1 ORDER BY created_at', [patientId]),
    ]);

    const labOrderIds = labOrders.rows.map((r) => r.lab_order_id);
    const { rows: labResults } = labOrderIds.length
      ? await pool.query('SELECT * FROM lab_results WHERE lab_order_id = ANY($1)', [labOrderIds])
      : { rows: [] };

    logAudit(req, 'READ', 'patients', Number(patientId));
    res.json({
      generated_at: new Date().toISOString(),
      patient: patientRows[0],
      appointments: appointments.rows,
      medical_records: medicalRecords.rows,
      lab_orders: labOrders.rows,
      lab_results: labResults,
      prescriptions: prescriptions.rows,
      consent_records: consents.rows,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllPatients, getPatientById, createPatient, updatePatient, deletePatient, exportPatientData };
