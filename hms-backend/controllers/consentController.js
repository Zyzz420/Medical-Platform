const pool = require('../config/db');
const { logAudit } = require('../middleware/audit');

const CONSENT_TYPES = ['TREATMENT', 'DATA_PROCESSING', 'RESEARCH'];

const getPatientConsents = async (req, res, next) => {
  const patientId = req.params.patientId;
  if (req.user.role === 'patient' && Number(req.user.patientId) !== Number(patientId)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM consent_records WHERE patient_id = $1 ORDER BY created_at DESC',
      [patientId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const createConsent = async (req, res, next) => {
  const { patient_id, consent_type, version } = req.body;
  if (req.user.role === 'patient' && Number(req.user.patientId) !== Number(patient_id)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  if (!CONSENT_TYPES.includes(consent_type)) {
    return res.status(400).json({ message: `consent_type must be one of: ${CONSENT_TYPES.join(', ')}` });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO consent_records (patient_id, consent_type, version, recorded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [patient_id, consent_type, version ?? '1.0', req.user.userId]
    );
    logAudit(req, 'CREATE', 'consent_records', rows[0].id);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const withdrawConsent = async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM consent_records WHERE id = $1', [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ message: 'Consent record not found' });
    if (req.user.role === 'patient' && Number(req.user.patientId) !== Number(existing[0].patient_id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { rows } = await pool.query(
      `UPDATE consent_records SET withdrawn_at = NOW()
       WHERE id = $1 AND withdrawn_at IS NULL
       RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(409).json({ message: 'Consent already withdrawn' });
    logAudit(req, 'UPDATE', 'consent_records', rows[0].id);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { getPatientConsents, createConsent, withdrawConsent };
