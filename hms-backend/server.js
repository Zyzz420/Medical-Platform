require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const authRoutes          = require('./routes/authRoutes');
const staffRoutes         = require('./routes/staffRoutes');
const patientRoutes       = require('./routes/patientRoutes');
const doctorRoutes        = require('./routes/doctorRoutes');
const wardRoutes          = require('./routes/wardRoutes');
const bedRoutes           = require('./routes/bedRoutes');
const appointmentRoutes   = require('./routes/appointmentRoutes');
const medicalRecordRoutes = require('./routes/medicalRecordRoutes');
const labOrderRoutes      = require('./routes/labOrderRoutes');
const labResultRoutes     = require('./routes/labResultRoutes');
const prescriptionRoutes  = require('./routes/prescriptionRoutes');
const dispensingRoutes    = require('./routes/dispensingRoutes');
const drugInventoryRoutes = require('./routes/drugInventoryRoutes');
const admissionRoutes     = require('./routes/admissionRoutes');
const dischargeRoutes     = require('./routes/dischargeRoutes');
const consentRoutes       = require('./routes/consentRoutes');
const fhirRoutes          = require('./routes/fhirRoutes');
const errorHandler        = require('./middleware/errorHandler');

const pool = require('./config/db');
const { runMigrations } = pool;

const app  = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_ALT,
].filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '50kb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth/login',          loginLimiter);
app.use('/api/auth',                authRoutes);
app.use('/api/staff',               staffRoutes);
app.use('/api/patients',            patientRoutes);
app.use('/api/doctors',             doctorRoutes);
app.use('/api/wards',               wardRoutes);
app.use('/api/beds',                bedRoutes);
app.use('/api/appointments',        appointmentRoutes);
app.use('/api/medical-records',     medicalRecordRoutes);
app.use('/api/lab-orders',          labOrderRoutes);
app.use('/api/lab-results',         labResultRoutes);
app.use('/api/prescriptions',       prescriptionRoutes);
app.use('/api/pharmacy-dispensing', dispensingRoutes);
app.use('/api/drug-inventory',      drugInventoryRoutes);
app.use('/api/admissions',          admissionRoutes);
app.use('/api/discharges',          dischargeRoutes);
app.use('/api/consent',             consentRoutes);
app.use('/fhir',                    fhirRoutes);

app.use(errorHandler);

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`HMS server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Startup migration failed, exiting:', err.message);
    process.exit(1);
  });
