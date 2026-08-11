const GENDER_MAP = { Male: 'male', Female: 'female', Other: 'other' };

function patientToFhir(row) {
  const identifier = [
    row.national_id && { system: 'https://dha.go.ke/identifiers/national-id', value: row.national_id },
    row.sha_number && { system: 'https://sha.go.ke/identifiers/beneficiary-number', value: row.sha_number },
  ].filter(Boolean);

  const telecom = [
    row.contact_number && { system: 'phone', value: row.contact_number },
    row.email && { system: 'email', value: row.email },
  ].filter(Boolean);

  return {
    resourceType: 'Patient',
    id: String(row.patient_id),
    active: row.deleted_at == null,
    identifier,
    name: [{ family: row.last_name, given: [row.first_name] }],
    gender: GENDER_MAP[row.gender] ?? 'unknown',
    birthDate: row.date_of_birth
      ? (row.date_of_birth instanceof Date ? row.date_of_birth.toISOString() : String(row.date_of_birth)).slice(0, 10)
      : undefined,
    telecom,
    address: row.address ? [{ text: row.address }] : undefined,
  };
}

module.exports = { patientToFhir };
