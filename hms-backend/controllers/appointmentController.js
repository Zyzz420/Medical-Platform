const pool = require('../config/db');
const { parsePagination, paginatedResponse } = require('../utils/paginate');
const { logAudit } = require('../middleware/audit');

const getAllAppointments = async (req, res, next) => {
  const { page, limit, offset } = parsePagination(req.query);
  try {
    const { rows } = await pool.query(
      `SELECT a.*,
              p.first_name AS patient_first_name, p.last_name AS patient_last_name,
              d.first_name AS doctor_first_name,  d.last_name  AS doctor_last_name,
              COUNT(*) OVER() AS _total
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN doctors  d ON a.doctor_id  = d.doctor_id
       WHERE a.deleted_at IS NULL
       ORDER BY a.appointment_datetime DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(paginatedResponse(rows, page, limit));
  } catch (err) {
    next(err);
  }
};

const getAppointmentById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*,
              p.first_name AS patient_first_name, p.last_name AS patient_last_name,
              d.first_name AS doctor_first_name,  d.last_name  AS doctor_last_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN doctors  d ON a.doctor_id  = d.doctor_id
       WHERE a.appointment_id = $1 AND a.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Appointment not found' });
    if (req.user.role === 'patient' && rows[0].patient_id !== req.user.patientId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    logAudit(req, 'READ', 'appointments', rows[0].appointment_id);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const createAppointment = async (req, res, next) => {
  const { patient_id, doctor_id, appointment_datetime, reason, status } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_datetime, reason, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [patient_id, doctor_id, appointment_datetime, reason, status ?? 'Scheduled']
    );
    logAudit(req, 'CREATE', 'appointments', rows[0].appointment_id);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateAppointment = async (req, res, next) => {
  const { patient_id, doctor_id, appointment_datetime, reason, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE appointments
       SET patient_id = $1, doctor_id = $2, appointment_datetime = $3,
           reason = $4, status = $5
       WHERE appointment_id = $6 AND deleted_at IS NULL
       RETURNING *`,
      [patient_id, doctor_id, appointment_datetime, reason, status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Appointment not found' });
    logAudit(req, 'UPDATE', 'appointments', rows[0].appointment_id);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Soft-delete: stamps deleted_at so the record is hidden from workflows
// but retained to satisfy the health records retention requirement.
const deleteAppointment = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE appointments SET deleted_at = NOW()
       WHERE appointment_id = $1 AND deleted_at IS NULL
       RETURNING appointment_id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Appointment not found' });
    logAudit(req, 'DELETE', 'appointments', rows[0].appointment_id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
};
