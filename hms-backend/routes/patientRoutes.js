const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  exportPatientData,
  getRetentionReview,
} = require('../controllers/patientController');

// All routes require a valid JWT
router.use(authenticate);

//                                    ┌── who can do it
router.get('/',    authorize('admin', 'receptionist', 'doctor', 'nurse'),             getAllPatients);
router.get('/retention/review', authorize('admin'),                                   getRetentionReview);
router.get('/:id', authorize('admin', 'receptionist', 'doctor', 'nurse', 'patient'),  getPatientById);
router.get('/:id/export', authorize('admin', 'patient'),                              exportPatientData);
router.post('/',   authorize('admin', 'receptionist', 'doctor'),                       createPatient);
router.put('/:id', authorize('admin', 'receptionist', 'doctor'),                       updatePatient);
router.delete('/:id', authorize('admin'),                                              deletePatient);

module.exports = router;
