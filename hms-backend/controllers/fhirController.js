const pool = require('../config/db');
const { logAudit } = require('../middleware/audit');
const { toBundle } = require('../utils/fhir/bundle');
const { patientToFhir } = require('../utils/fhir/patientToFhir');
const { practitionerToFhir } = require('../utils/fhir/practitionerToFhir');
const { encounterToFhir } = require('../utils/fhir/encounterToFhir');
const { conditionToFhir } = require('../utils/fhir/conditionToFhir');
const { observationToFhir } = require('../utils/fhir/observationToFhir');
const { medicationRequestToFhir } = require('../utils/fhir/medicationRequestToFhir');
const { consentToFhir } = require('../utils/fhir/consentToFhir');
const { organizationToFhir } = require('../utils/fhir/organizationToFhir');

// GET /fhir/metadata — CapabilityStatement, the entry point any FHIR
// conformance check starts with.
const getCapabilityStatement = (req, res) => {
  const resourceTypes = ['Patient', 'Practitioner', 'Encounter', 'Condition', 'Observation', 'MedicationRequest', 'Consent', 'Organization'];
  res.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    kind: 'instance',
    fhirVersion: '4.0.1',
    format: ['json'],
    rest: [
      {
        mode: 'server',
        resource: resourceTypes.map((type) => ({
          type,
          interaction: [{ code: 'read' }, { code: 'search-type' }],
        })),
      },
    ],
  });
};

const getOrganization = (req, res) => {
  res.json(organizationToFhir());
};

// ---- Patient ----

const getPatient = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM patients WHERE patient_id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] });
    logAudit(req, 'READ', 'fhir_patient', rows[0].patient_id);
    res.json(patientToFhir(rows[0]));
  } catch (err) {
    next(err);
  }
};

// GET /fhir/Patient?identifier=<national_id or sha_number>
const searchPatients = async (req, res, next) => {
  const { identifier } = req.query;
  try {
    const { rows } = identifier
      ? await pool.query(
          'SELECT * FROM patients WHERE (national_id = $1 OR sha_number = $1) AND deleted_at IS NULL',
          [identifier]
        )
      : await pool.query('SELECT * FROM patients WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100');
    logAudit(req, 'READ', 'fhir_patient', null);
    res.json(toBundle(rows.map(patientToFhir)));
  } catch (err) {
    next(err);
  }
};

// ---- Practitioner ----

const getPractitioner = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM doctors WHERE doctor_id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] });
    res.json(practitionerToFhir(rows[0]));
  } catch (err) {
    next(err);
  }
};

const searchPractitioners = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM doctors ORDER BY doctor_id LIMIT 100');
    res.json(toBundle(rows.map(practitionerToFhir)));
  } catch (err) {
    next(err);
  }
};

// ---- Encounter ----

const getEncounter = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM appointments WHERE appointment_id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] });
    logAudit(req, 'READ', 'fhir_encounter', rows[0].appointment_id);
    res.json(encounterToFhir(rows[0]));
  } catch (err) {
    next(err);
  }
};

// GET /fhir/Encounter?patient=<patient_id>
const searchEncounters = async (req, res, next) => {
  const { patient } = req.query;
  if (!patient) return res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'patient search parameter is required' }] });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM appointments WHERE patient_id = $1 AND deleted_at IS NULL ORDER BY appointment_datetime',
      [patient]
    );
    logAudit(req, 'READ', 'fhir_encounter', null);
    res.json(toBundle(rows.map(encounterToFhir)));
  } catch (err) {
    next(err);
  }
};

// ---- Condition ---- (sourced from medical_records.diagnosis)

const searchConditions = async (req, res, next) => {
  const { patient } = req.query;
  if (!patient) return res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'patient search parameter is required' }] });
  try {
    const { rows } = await pool.query(
      `SELECT mr.*, a.patient_id
       FROM medical_records mr
       JOIN appointments a ON mr.appointment_id = a.appointment_id
       WHERE a.patient_id = $1 AND mr.diagnosis IS NOT NULL
       ORDER BY mr.created_at`,
      [patient]
    );
    logAudit(req, 'READ', 'fhir_condition', null);
    res.json(toBundle(rows.map(conditionToFhir)));
  } catch (err) {
    next(err);
  }
};

// ---- Observation ---- (sourced from lab_results)

const searchObservations = async (req, res, next) => {
  const { patient } = req.query;
  if (!patient) return res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'patient search parameter is required' }] });
  try {
    const { rows } = await pool.query(
      `SELECT lr.*, lo.test_name, lo.order_date, a.patient_id
       FROM lab_results lr
       JOIN lab_orders lo ON lr.lab_order_id = lo.lab_order_id
       LEFT JOIN medical_records mr  ON lo.record_id    = mr.record_id
       LEFT JOIN admissions      ad  ON lo.admission_id = ad.admission_id
       LEFT JOIN medical_records mr2 ON ad.record_id    = mr2.record_id
       LEFT JOIN appointments    a   ON COALESCE(mr.appointment_id, mr2.appointment_id) = a.appointment_id
       WHERE a.patient_id = $1
       ORDER BY lo.order_date`,
      [patient]
    );
    logAudit(req, 'READ', 'fhir_observation', null);
    res.json(toBundle(rows.map(observationToFhir)));
  } catch (err) {
    next(err);
  }
};

// ---- MedicationRequest ---- (sourced from prescriptions)

const searchMedicationRequests = async (req, res, next) => {
  const { patient } = req.query;
  if (!patient) return res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'patient search parameter is required' }] });
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT p.*, a.patient_id
       FROM prescriptions p
       LEFT JOIN medical_records mr  ON p.record_id    = mr.record_id
       LEFT JOIN admissions      ad  ON p.admission_id = ad.admission_id
       LEFT JOIN medical_records mr2 ON ad.record_id   = mr2.record_id
       LEFT JOIN appointments    a   ON COALESCE(mr.appointment_id, mr2.appointment_id) = a.appointment_id
       WHERE a.patient_id = $1`,
      [patient]
    );
    logAudit(req, 'READ', 'fhir_medicationrequest', null);
    res.json(toBundle(rows.map(medicationRequestToFhir)));
  } catch (err) {
    next(err);
  }
};

// ---- Consent ----

const searchConsents = async (req, res, next) => {
  const { patient } = req.query;
  if (!patient) return res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'patient search parameter is required' }] });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM consent_records WHERE patient_id = $1 ORDER BY created_at DESC',
      [patient]
    );
    logAudit(req, 'READ', 'fhir_consent', null);
    res.json(toBundle(rows.map(consentToFhir)));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCapabilityStatement,
  getOrganization,
  getPatient,
  searchPatients,
  getPractitioner,
  searchPractitioners,
  getEncounter,
  searchEncounters,
  searchConditions,
  searchObservations,
  searchMedicationRequests,
  searchConsents,
};
