const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const {
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
} = require('../controllers/fhirController');

// Phase 1: read-only FHIR R4 API over this facility's own data, for DHA
// conformance testing ahead of SHA/DHA integration. Auth here is a
// placeholder (existing JWT + admin-only) — TODO: replace with the actual
// SHA/DHA auth scheme (likely OAuth2 client-credentials / SMART on FHIR
// backend services) once that spec is available. See the FHIR scoping plan.

// CapabilityStatement is left unauthenticated: it's the entry point DHA's
// conformance-testing tooling (and any FHIR client) hits first to discover
// what the server supports, before it has credentials. It exposes no
// patient data, only the shape of the API.
router.get('/metadata', getCapabilityStatement);

router.use(authenticate);
router.use(authorize('admin'));

router.get('/Organization', getOrganization);

router.get('/Patient', searchPatients);
router.get('/Patient/:id', getPatient);

router.get('/Practitioner', searchPractitioners);
router.get('/Practitioner/:id', getPractitioner);

router.get('/Encounter', searchEncounters);
router.get('/Encounter/:id', getEncounter);

router.get('/Condition', searchConditions);
router.get('/Observation', searchObservations);
router.get('/MedicationRequest', searchMedicationRequests);
router.get('/Consent', searchConsents);

module.exports = router;
