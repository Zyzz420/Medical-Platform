const STATUS_MAP = {
  Created:            'draft',
  'Sent to Pharmacy':  'active',
  Dispensed:           'completed',
  Cancelled:           'cancelled',
};

function medicationRequestToFhir(row) {
  const dosageText = [row.dosage, row.instructions].filter(Boolean).join(' — ');

  return {
    resourceType: 'MedicationRequest',
    id: String(row.prescription_id),
    status: STATUS_MAP[row.status] ?? 'unknown',
    intent: 'order',
    medicationCodeableConcept: { text: row.medication_name },
    subject: { reference: `Patient/${row.patient_id}` },
    dosageInstruction: dosageText ? [{ text: dosageText }] : undefined,
  };
}

module.exports = { medicationRequestToFhir };
