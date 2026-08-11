function practitionerToFhir(row) {
  const telecom = [
    row.contact_number && { system: 'phone', value: row.contact_number },
    row.email && { system: 'email', value: row.email },
  ].filter(Boolean);

  return {
    resourceType: 'Practitioner',
    id: String(row.doctor_id),
    identifier: row.license_number
      ? [{ system: 'https://dha.go.ke/identifiers/practitioner-license', value: row.license_number }]
      : [],
    name: [{ family: row.last_name, given: [row.first_name] }],
    telecom,
    qualification: row.specialty ? [{ code: { text: row.specialty } }] : undefined,
  };
}

module.exports = { practitionerToFhir };
