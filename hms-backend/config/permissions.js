// Role-permission matrix.
// Each key is a resource; values are allowed actions for that role.
// Used as documentation and by the hasPermission() helper in authorize.js.

const ROLES = ['admin', 'receptionist', 'doctor', 'nurse', 'pharmacist', 'lab_technician', 'patient'];

const PERMISSIONS = {
  admin: {
    staff_management:    ['create', 'read', 'update', 'delete'],
    patients:            ['create', 'read', 'update', 'delete'],
    doctors:             ['create', 'read', 'update', 'delete'],
    appointments:        ['create', 'read', 'update', 'delete'],
    medical_records:     ['create', 'read', 'update', 'delete'],
    lab_orders:          ['create', 'read', 'update', 'delete'],
    lab_results:         ['create', 'read', 'update', 'delete'],
    prescriptions:       ['create', 'read', 'update', 'delete'],
    pharmacy_dispensing: ['create', 'read', 'update', 'delete'],
    drug_inventory:      ['create', 'read', 'update', 'delete'],
    admissions:          ['create', 'read', 'update', 'delete'],
    discharges:          ['create', 'read', 'update', 'delete'],
    users:               ['create', 'read', 'update', 'delete'],
    consent_records:     ['create', 'read', 'update'],
  },
  doctor: {
    patients:        ['create', 'read', 'update'],
    appointments:    ['create', 'read', 'update'],
    medical_records: ['create', 'read', 'update'],
    lab_orders:      ['create', 'read'],
    lab_results:     ['read'],
    prescriptions:   ['create', 'read', 'update'],
    admissions:      ['create', 'read', 'update'],
    discharges:      ['create', 'read'],
    consent_records: ['create', 'read'],
  },
  nurse: {
    patients:        ['read'],
    appointments:    ['read'],
    medical_records: ['read'],
    lab_results:     ['read'],
    admissions:      ['read', 'update'],
    consent_records: ['read'],
  },
  receptionist: {
    patients:        ['create', 'read', 'update'],
    appointments:    ['create', 'read', 'update'],
    consent_records: ['create', 'read', 'update'],
  },
  pharmacist: {
    prescriptions:       ['read', 'update'],
    pharmacy_dispensing: ['create', 'read', 'update'],
    drug_inventory:      ['create', 'read', 'update'],
  },
  lab_technician: {
    lab_orders:  ['read', 'update'],
    lab_results: ['create', 'read', 'update'],
  },
  patient: {
    // 'own' suffix = controller must additionally verify ownership
    appointments:    ['read:own'],
    medical_records: ['read:own'],
    lab_results:     ['read:own'],
    prescriptions:   ['read:own'],
    consent_records: ['create:own', 'read:own', 'update:own'],
    patients:        ['read:own'], // Subject Access Request export
  },
};

/**
 * Check whether a role has permission to perform an action on a resource.
 * @param {string} role
 * @param {string} resource  e.g. 'patients'
 * @param {string} action    e.g. 'read'
 */
function hasPermission(role, resource, action) {
  const allowed = PERMISSIONS[role]?.[resource] ?? [];
  return allowed.includes(action) || allowed.includes(`${action}:own`);
}

module.exports = { ROLES, PERMISSIONS, hasPermission };
