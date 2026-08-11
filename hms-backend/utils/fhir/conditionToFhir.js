// diagnosis is free text today, not ICD-10 coded — see Phase 2 open item in the FHIR scoping plan.
function conditionToFhir(row) {
  return {
    resourceType: 'Condition',
    id: String(row.record_id),
    code: { text: row.diagnosis },
    subject: { reference: `Patient/${row.patient_id}` },
    encounter: { reference: `Encounter/${row.appointment_id}` },
    recordedDate: row.created_at,
  };
}

module.exports = { conditionToFhir };
