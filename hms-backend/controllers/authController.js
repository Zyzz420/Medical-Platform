const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const { ROLES } = require('../config/permissions');

const SALT_ROUNDS = 12;
const COOKIE_NAME = 'hms_token';

const STAFF_ROLES = ['admin', 'receptionist', 'doctor', 'nurse', 'pharmacist', 'lab_technician'];

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

async function fetchPatientProfile(client, patient_id) {
  if (!patient_id) return null;
  const { rows } = await client.query(
    `SELECT patient_id, first_name, last_name, date_of_birth, gender,
            blood_type, contact_number, email, address, national_id, sha_number
     FROM patients WHERE patient_id = $1`,
    [patient_id]
  );
  return rows[0] ?? null;
}

// POST /api/auth/register
const register = async (req, res, next) => {
  const {
    email, password, role,
    doctor_id, patient_id,
    first_name, last_name, date_of_birth, gender, blood_type, contact_number, address,
    national_id, sha_number,
  } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'email, password, and role are required' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ message: `role must be one of: ${ROLES.join(', ')}` });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  if (STAFF_ROLES.includes(role)) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Creating staff accounts requires admin authentication' });
    }
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      if (decoded.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can create staff accounts' });
      }
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  }

  if (role === 'patient' && first_name && last_name && date_of_birth) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const patientRes = await client.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, gender, blood_type, contact_number, email, address, national_id, sha_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING patient_id`,
        [first_name, last_name, date_of_birth,
         gender || null, blood_type || null, contact_number || null, email, address || null,
         national_id || null, sha_number || null]
      );
      const newPatientId = patientRes.rows[0].patient_id;

      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      const userRes = await client.query(
        `INSERT INTO users (email, password, role, patient_id)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, email, role, patient_id, created_at`,
        [email, hashed, 'patient', newPatientId]
      );

      await client.query('COMMIT');

      const user    = userRes.rows[0];
      const profile = await fetchPatientProfile(pool, newPatientId);
      const token   = signToken({ userId: user.user_id, email: user.email, role: user.role, patientId: newPatientId });
      res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
      return res.status(201).json({ token, user: { ...user, profile } });
    } catch (err) {
      await client.query('ROLLBACK');
      return next(err);
    } finally {
      client.release();
    }
  }

  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password, role, doctor_id, patient_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, email, role, doctor_id, patient_id, created_at`,
      [email, hashed, role, doctor_id ?? null, patient_id ?? null]
    );
    const user    = rows[0];
    const profile = await fetchPatientProfile(pool, user.patient_id);
    const token   = signToken({ userId: user.user_id, email: user.email, role: user.role, patientId: user.patient_id ?? null });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.status(201).json({ token, user: { ...user, profile } });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );
    const user = rows[0];

    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, '$2b$12$invalidhashfortimingnullcase00');

    if (!user || !passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const profile = await fetchPatientProfile(pool, user.patient_id);
    const token   = signToken({ userId: user.user_id, email: user.email, role: user.role, patientId: user.patient_id ?? null });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.json({
      token,
      user: {
        user_id:    user.user_id,
        email:      user.email,
        role:       user.role,
        doctor_id:  user.doctor_id,
        patient_id: user.patient_id,
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Logged out' });
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, email, role, doctor_id, patient_id, is_active, created_at
       FROM users WHERE user_id = $1`,
      [req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const user    = rows[0];
    const profile = await fetchPatientProfile(pool, user.patient_id);
    res.json({ ...user, profile });
  } catch (err) {
    next(err);
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  const { first_name, last_name, date_of_birth, gender, blood_type, contact_number, address, national_id, sha_number } = req.body;

  try {
    const { rows: userRows } = await pool.query(
      'SELECT patient_id FROM users WHERE user_id = $1',
      [req.user.userId]
    );
    const patient_id = userRows[0]?.patient_id;
    if (!patient_id) {
      return res.status(400).json({ message: 'No patient profile linked to this account' });
    }

    const { rows } = await pool.query(
      `UPDATE patients
       SET first_name = COALESCE($1, first_name),
           last_name  = COALESCE($2, last_name),
           date_of_birth = COALESCE($3, date_of_birth),
           gender        = COALESCE($4, gender),
           blood_type    = COALESCE($5, blood_type),
           contact_number = COALESCE($6, contact_number),
           address       = COALESCE($7, address),
           national_id   = COALESCE($8, national_id),
           sha_number    = COALESCE($9, sha_number)
       WHERE patient_id = $10
       RETURNING patient_id, first_name, last_name, date_of_birth, gender, blood_type, contact_number, email, address, national_id, sha_number`,
      [first_name ?? null, last_name ?? null, date_of_birth ?? null,
       gender ?? null, blood_type ?? null, contact_number ?? null, address ?? null,
       national_id ?? null, sha_number ?? null,
       patient_id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, getMe, updateProfile };
