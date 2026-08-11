// Static — represents this facility itself. Sourced from env config since
// there's no facility table (this system serves a single facility).
function organizationToFhir() {
  const identifier = [
    process.env.FACILITY_MFL_CODE && { system: 'https://kmhfl.health.go.ke/identifiers/mfl-code', value: process.env.FACILITY_MFL_CODE },
    process.env.FACILITY_SHA_ID && { system: 'https://sha.go.ke/identifiers/facility-id', value: process.env.FACILITY_SHA_ID },
  ].filter(Boolean);

  return {
    resourceType: 'Organization',
    id: 'facility',
    active: true,
    name: process.env.FACILITY_NAME || 'Unnamed Facility',
    identifier,
    type: [{ text: 'Healthcare Provider' }],
  };
}

module.exports = { organizationToFhir };
