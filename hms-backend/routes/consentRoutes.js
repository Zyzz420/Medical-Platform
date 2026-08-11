const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const {
  getPatientConsents,
  createConsent,
  withdrawConsent,
} = require('../controllers/consentController');

// All routes require a valid JWT
router.use(authenticate);

//                                                ┌── who can do it
router.get('/patient/:patientId', authorize('admin', 'receptionist', 'doctor', 'nurse', 'patient'), getPatientConsents);
router.post('/',                  authorize('admin', 'receptionist', 'doctor', 'patient'),           createConsent);
router.patch('/:id/withdraw',     authorize('admin', 'receptionist', 'patient'),                     withdrawConsent);

module.exports = router;
