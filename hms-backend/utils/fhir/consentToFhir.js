function consentToFhir(row) {
  return {
    resourceType: 'Consent',
    id: String(row.id),
    status: row.withdrawn_at ? 'inactive' : 'active',
    scope: { text: row.consent_type },
    category: [{ text: row.consent_type }],
    patient: { reference: `Patient/${row.patient_id}` },
    dateTime: row.created_at,
    policyRule: { text: `v${row.version}` },
  };
}

module.exports = { consentToFhir };
