'use strict';

/**
 * FHIR R4 read API edge-case tests (Phase 1 — see the FHIR scoping plan).
 *
 * Covers:
 *  - Auth: no token → 401, non-admin token → 403
 *  - CapabilityStatement and Organization shape
 *  - Patient/Practitioner/Encounter read + search
 *  - Condition/Observation/MedicationRequest/Consent search (patient param required)
 *
 * Self-contained: creates a minimal clinical chain (patient → doctor →
 * appointment → medical record → lab order/result → prescription →
 * consent record), runs assertions, then cleans up.
 */

const { Pool } = require('pg');
const { mintToken, req, assert } = require('./helpers');

module.exports = async function testFhir(BASE, adminUserId) {
  console.log('\n[FHIR] Read API — Auth & Resource Mapping');

  const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const adminToken = mintToken({ userId: adminUserId, email: 'admin@hms.com', role: 'admin', patientId: null });

  // authenticate middleware looks the user up by id (is_active check), so the
  // non-admin token needs to belong to a real, active, non-admin user.
  const { rows: nonAdminRows } = await pool.query(
    `SELECT user_id, role FROM users WHERE role != 'admin' AND is_active = TRUE LIMIT 1`
  );
  if (!nonAdminRows.length) throw new Error('No active non-admin user found in DB for FHIR auth test.');
  const nurseToken = mintToken({ userId: nonAdminRows[0].user_id, email: 'nonadmin@hms.com', role: nonAdminRows[0].role, patientId: null });

  let patientId, doctorId, apptId, recordId, labOrderId, prescriptionId, consentId;
  let hasShaColumns = true;

  // Pre-test cleanup for debris from failed previous runs
  try {
    await pool.query(`DELETE FROM doctors WHERE license_number = 'LIC-FHIR-01'`);
    await pool.query(`DELETE FROM patients WHERE first_name = 'Test' AND last_name = 'Fhir'`);
  } catch (_) {}

  try {
    let patient;
    try {
      patient = await pool.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, gender, contact_number, national_id, sha_number)
         VALUES ('Test','Fhir','1990-01-01','Female','0700000000','12345678','SHA-000111')
         RETURNING patient_id`
      );
    } catch (_) {
      // national_id/sha_number don't exist in this DB yet — see config/db.js migration notes.
      hasShaColumns = false;
      patient = await pool.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, gender, contact_number)
         VALUES ('Test','Fhir','1990-01-01','Female','0700000000')
         RETURNING patient_id`
      );
    }
    patientId = patient.rows[0].patient_id;

    const doctor = await pool.query(
      `INSERT INTO doctors (first_name, last_name, license_number) VALUES ('Test','DocF','LIC-FHIR-01') RETURNING doctor_id`
    );
    doctorId = doctor.rows[0].doctor_id;

    const appt = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_datetime, reason, status)
       VALUES ($1, $2, NOW(), 'Checkup', 'Completed') RETURNING appointment_id`,
      [patientId, doctorId]
    );
    apptId = appt.rows[0].appointment_id;

    const record = await pool.query(
      `INSERT INTO medical_records (appointment_id, diagnosis, consultation_notes)
       VALUES ($1, 'Seasonal flu', 'Rest and fluids') RETURNING record_id`,
      [apptId]
    );
    recordId = record.rows[0].record_id;

    const labOrder = await pool.query(
      `INSERT INTO lab_orders (record_id, test_name, status) VALUES ($1, 'CBC', 'Completed') RETURNING lab_order_id`,
      [recordId]
    );
    labOrderId = labOrder.rows[0].lab_order_id;

    await pool.query(
      `INSERT INTO lab_results (lab_order_id, result_data, status) VALUES ($1, 'WBC 6.2', 'Results Reviewed')`,
      [labOrderId]
    );

    const prescription = await pool.query(
      `INSERT INTO prescriptions (record_id, medication_name, dosage, instructions)
       VALUES ($1, 'Paracetamol', '500mg', 'Twice daily') RETURNING prescription_id`,
      [recordId]
    );
    prescriptionId = prescription.rows[0].prescription_id;

    try {
      const consent = await pool.query(
        `INSERT INTO consent_records (patient_id, consent_type, recorded_by) VALUES ($1, 'TREATMENT', $2) RETURNING id`,
        [patientId, adminUserId]
      );
      consentId = consent.rows[0].id;
    } catch (_) {
      // consent_records may not exist yet in this environment — see config/db.js migration notes.
    }

    // ── auth ────────────────────────────────────────────────────────────────
    // CapabilityStatement is deliberately unauthenticated (conformance-testing
    // tools discover the API before they have credentials); every other FHIR
    // resource stays behind admin auth, so the auth check moved to Organization.
    const { status: sNoAuth } = await req('GET', '/fhir/Organization', {}, BASE);
    assert('No token → 401', sNoAuth === 401, `got ${sNoAuth}`);

    const { status: sNonAdmin } = await req('GET', '/fhir/Organization', { token: nurseToken }, BASE);
    assert('Non-admin token → 403', sNonAdmin === 403, `got ${sNonAdmin}`);

    // ── CapabilityStatement ────────────────────────────────────────────────
    const { status: sMetaNoAuth } = await req('GET', '/fhir/metadata', {}, BASE);
    assert('metadata reachable without auth → 200', sMetaNoAuth === 200, `got ${sMetaNoAuth}`);

    const { status: sMeta, json: jMeta } = await req('GET', '/fhir/metadata', { token: adminToken }, BASE);
    assert('metadata → 200', sMeta === 200, `got ${sMeta}`);
    assert('metadata resourceType', jMeta?.resourceType === 'CapabilityStatement', `got ${jMeta?.resourceType}`);
    assert('metadata fhirVersion 4.0.1', jMeta?.fhirVersion === '4.0.1', `got ${jMeta?.fhirVersion}`);

    // ── Organization ────────────────────────────────────────────────────────
    const { status: sOrg, json: jOrg } = await req('GET', '/fhir/Organization', { token: adminToken }, BASE);
    assert('Organization → 200', sOrg === 200, `got ${sOrg}`);
    assert('Organization resourceType', jOrg?.resourceType === 'Organization', `got ${jOrg?.resourceType}`);

    // ── Patient ─────────────────────────────────────────────────────────────
    const { status: sPat, json: jPat } = await req('GET', `/fhir/Patient/${patientId}`, { token: adminToken }, BASE);
    assert('Patient read → 200', sPat === 200, `got ${sPat}`);
    assert('Patient resourceType', jPat?.resourceType === 'Patient', `got ${jPat?.resourceType}`);
    assert('Patient name maps', jPat?.name?.[0]?.family === 'Fhir', `got ${JSON.stringify(jPat?.name)}`);

    const { status: s404, json: j404 } = await req('GET', '/fhir/Patient/9999999', { token: adminToken }, BASE);
    assert('Patient not found → 404', s404 === 404, `got ${s404}`);
    assert('Not found is an OperationOutcome', j404?.resourceType === 'OperationOutcome', `got ${j404?.resourceType}`);

    if (hasShaColumns) {
      assert('Patient identifier includes SHA number', (jPat?.identifier ?? []).some((i) => i.value === 'SHA-000111'), `got ${JSON.stringify(jPat?.identifier)}`);

      const { status: sSearch, json: jSearch } = await req('GET', `/fhir/Patient?identifier=SHA-000111`, { token: adminToken }, BASE);
      assert('Patient identifier search → 200', sSearch === 200, `got ${sSearch}`);
      assert('Patient identifier search Bundle', jSearch?.resourceType === 'Bundle', `got ${jSearch?.resourceType}`);
      assert('Patient identifier search finds patient', jSearch?.entry?.some((e) => e.resource.id === String(patientId)), 'patient not found in bundle');
    } else {
      console.log('  (skipped SHA-identifier assertions — national_id/sha_number not present in this DB)');
    }

    // ── Practitioner ────────────────────────────────────────────────────────
    const { status: sPrac, json: jPrac } = await req('GET', `/fhir/Practitioner/${doctorId}`, { token: adminToken }, BASE);
    assert('Practitioner read → 200', sPrac === 200, `got ${sPrac}`);
    assert('Practitioner resourceType', jPrac?.resourceType === 'Practitioner', `got ${jPrac?.resourceType}`);

    // ── Encounter ───────────────────────────────────────────────────────────
    const { status: sEnc, json: jEnc } = await req('GET', `/fhir/Encounter/${apptId}`, { token: adminToken }, BASE);
    assert('Encounter read → 200', sEnc === 200, `got ${sEnc}`);
    assert('Encounter status mapped', jEnc?.status === 'finished', `got ${jEnc?.status}`);
    assert('Encounter subject reference', jEnc?.subject?.reference === `Patient/${patientId}`, `got ${jEnc?.subject?.reference}`);

    const { status: sEncMissing } = await req('GET', '/fhir/Encounter', { token: adminToken }, BASE);
    assert('Encounter search without patient → 400', sEncMissing === 400, `got ${sEncMissing}`);

    const { status: sEncSearch, json: jEncSearch } = await req('GET', `/fhir/Encounter?patient=${patientId}`, { token: adminToken }, BASE);
    assert('Encounter search → 200', sEncSearch === 200, `got ${sEncSearch}`);
    assert('Encounter search finds encounter', jEncSearch?.entry?.length >= 1, 'no encounters in bundle');

    // ── Condition ───────────────────────────────────────────────────────────
    const { status: sCond, json: jCond } = await req('GET', `/fhir/Condition?patient=${patientId}`, { token: adminToken }, BASE);
    assert('Condition search → 200', sCond === 200, `got ${sCond}`);
    assert('Condition maps diagnosis', jCond?.entry?.[0]?.resource?.code?.text === 'Seasonal flu', `got ${JSON.stringify(jCond?.entry?.[0]?.resource?.code)}`);

    // ── Observation ─────────────────────────────────────────────────────────
    const { status: sObs, json: jObs } = await req('GET', `/fhir/Observation?patient=${patientId}`, { token: adminToken }, BASE);
    assert('Observation search → 200', sObs === 200, `got ${sObs}`);
    assert('Observation maps result', jObs?.entry?.[0]?.resource?.valueString === 'WBC 6.2', `got ${JSON.stringify(jObs?.entry?.[0]?.resource)}`);

    // ── MedicationRequest ───────────────────────────────────────────────────
    const { status: sMed, json: jMed } = await req('GET', `/fhir/MedicationRequest?patient=${patientId}`, { token: adminToken }, BASE);
    assert('MedicationRequest search → 200', sMed === 200, `got ${sMed}`);
    assert('MedicationRequest maps medication', jMed?.entry?.[0]?.resource?.medicationCodeableConcept?.text === 'Paracetamol', `got ${JSON.stringify(jMed?.entry?.[0]?.resource)}`);

    // ── Consent ─────────────────────────────────────────────────────────────
    if (consentId) {
      const { status: sCon, json: jCon } = await req('GET', `/fhir/Consent?patient=${patientId}`, { token: adminToken }, BASE);
      assert('Consent search → 200', sCon === 200, `got ${sCon}`);
      assert('Consent maps status active', jCon?.entry?.[0]?.resource?.status === 'active', `got ${JSON.stringify(jCon?.entry?.[0]?.resource)}`);
    } else {
      console.log('  (skipped Consent assertions — consent_records not present in this DB)');
    }
  } finally {
    // ── cleanup ───────────────────────────────────────────────────────────
    try {
      if (consentId) await pool.query('DELETE FROM consent_records WHERE id = $1', [consentId]);
      if (prescriptionId) await pool.query('DELETE FROM prescriptions WHERE prescription_id = $1', [prescriptionId]);
      if (labOrderId) {
        await pool.query('DELETE FROM lab_results WHERE lab_order_id = $1', [labOrderId]);
        await pool.query('DELETE FROM lab_orders WHERE lab_order_id = $1', [labOrderId]);
      }
      if (recordId) await pool.query('DELETE FROM medical_records WHERE record_id = $1', [recordId]);
      if (apptId) await pool.query('DELETE FROM appointments WHERE appointment_id = $1', [apptId]);
      if (doctorId) await pool.query('DELETE FROM doctors WHERE doctor_id = $1', [doctorId]);
      if (patientId) await pool.query('DELETE FROM patients WHERE patient_id = $1', [patientId]);
    } catch (_) {}
    await pool.end();
  }
};
