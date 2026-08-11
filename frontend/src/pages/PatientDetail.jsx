import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPatient, updatePatient, deletePatient, exportPatientData } from '../api/patients'
import { getAppointments } from '../api/appointments'
import { getMedicalRecords } from '../api/medicalRecords'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/common/Modal'
import ConsentPanel from '../components/ConsentPanel'
import { downloadJSON } from '../utils/download'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENDERS     = ['Male', 'Female', 'Other']

const APPT_COLORS = {
  Scheduled: 'bg-primary-100 text-primary-800',
  Completed: 'bg-lime-400/20 text-lime-700',
  Cancelled: 'bg-red-100 text-red-600',
  'No-Show': 'bg-yellow-100 text-yellow-700',
}

function age(dob) {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canDelete  = user?.role === 'admin'
  const staffRoles = ['admin', 'receptionist', 'doctor', 'nurse']
  const canViewAppointments = staffRoles.includes(user?.role)
  const canViewRecords      = staffRoles.includes(user?.role)
  const canCreateConsent    = ['admin', 'receptionist', 'doctor'].includes(user?.role)
  const canWithdrawConsent  = ['admin', 'receptionist'].includes(user?.role)
  const canExport           = user?.role === 'admin'

  const [patient, setPatient]         = useState(null)
  const [appointments, setAppts]      = useState([])
  const [records, setRecords]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [tab, setTab]                 = useState('overview')

  // Edit state
  const [showEdit, setShowEdit]       = useState(false)
  const [form, setForm]               = useState(null)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]                   = useState(false)
  const [deleteError, setDeleteError]             = useState('')

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const res = await exportPatientData(id)
      downloadJSON(res.data, `patient-${id}-data-export-${res.data.generated_at.slice(0, 10)}.json`)
    } catch (err) {
      setExportError(err.response?.data?.message ?? 'Failed to export patient data.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deletePatient(id)
      navigate('/patients')
    } catch (err) {
      setDeleteError(err.response?.data?.message ?? 'Failed to delete patient.')
      setDeleting(false)
    }
  }

  useEffect(() => {
    const empty = Promise.resolve({ data: { data: [] } })
    Promise.all([
      getPatient(id),
      canViewAppointments ? getAppointments() : empty,
      canViewRecords      ? getMedicalRecords() : empty,
    ])
      .then(([p, a, r]) => {
        setPatient(p.data)
        setAppts((a.data.data ?? []).filter((x) => String(x.patient_id) === String(id)))
        setRecords((r.data.data ?? []).filter((x) => String(x.patient_id) === String(id)))
      })
      .catch(() => setError('Failed to load patient.'))
      .finally(() => setLoading(false))
  }, [id, canViewAppointments, canViewRecords])

  function openEdit() {
    setForm({
      first_name:     patient.first_name     ?? '',
      last_name:      patient.last_name      ?? '',
      date_of_birth:  patient.date_of_birth?.slice(0, 10) ?? '',
      gender:         patient.gender         ?? '',
      blood_type:     patient.blood_type     ?? '',
      contact_number: patient.contact_number ?? '',
      email:          patient.email          ?? '',
      address:        patient.address        ?? '',
      national_id:    patient.national_id    ?? '',
      sha_number:     patient.sha_number     ?? '',
    })
    setFormError('')
    setShowEdit(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const res = await updatePatient(id, {
        ...form,
        gender:     form.gender     || null,
        blood_type: form.blood_type || null,
      })
      setPatient(res.data)
      setShowEdit(false)
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  if (loading) return <p className="text-gray-500">Loading…</p>
  if (error)   return <p className="text-red-600">{error}</p>
  if (!patient) return null

  const upcoming = appointments.filter((a) => a.status === 'Scheduled')
  const past     = appointments.filter((a) => a.status !== 'Scheduled')

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate('/patients')}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-5 flex items-center gap-1"
      >
        ← All patients
      </button>

      {/* Header */}
      <div className="card p-6 mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ backgroundColor: '#3b0764' }}
          >
            {patient.first_name?.[0]}{patient.last_name?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {patient.first_name} {patient.last_name}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {age(patient.date_of_birth)} yrs · {patient.gender ?? 'Gender not set'} · Blood type: {patient.blood_type ?? '—'}
            </p>
            <div className="flex gap-4 mt-1 text-sm text-gray-500">
              {patient.contact_number && <span>📞 {patient.contact_number}</span>}
              {patient.email          && <span>✉ {patient.email}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canExport && (
            <button onClick={handleExport} disabled={exporting} className="btn-secondary text-sm disabled:opacity-50">
              {exporting ? 'Exporting…' : 'Export data'}
            </button>
          )}
          <button onClick={openEdit} className="btn-secondary text-sm">
            Edit info
          </button>
          {canDelete && (
            <button
              onClick={() => { setDeleteError(''); setShowDeleteConfirm(true) }}
              className="text-sm px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              Deactivate patient
            </button>
          )}
        </div>
      </div>

      {exportError && <p className="text-sm text-red-600 mb-4">{exportError}</p>}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatPill label="Total appointments" value={appointments.length} />
        <StatPill label="Upcoming"           value={upcoming.length}     accent />
        <StatPill label="Medical records"    value={records.length}      />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'overview',     label: 'Overview' },
          { key: 'appointments', label: `Appointments (${appointments.length})` },
          { key: 'records',      label: `Medical Records (${records.length})` },
          { key: 'consent',      label: 'Consent' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="card divide-y divide-gray-100">
            <SectionRow label="Full name"     value={`${patient.first_name} ${patient.last_name}`} />
            <SectionRow label="Date of birth" value={`${patient.date_of_birth?.slice(0, 10) ?? '—'}  (${age(patient.date_of_birth)} years old)`} />
            <SectionRow label="Gender"        value={patient.gender      ?? '—'} />
            <SectionRow label="Blood type"    value={patient.blood_type  ?? '—'} />
            <SectionRow label="Phone"         value={patient.contact_number ?? '—'} />
            <SectionRow label="Email"         value={patient.email       ?? '—'} />
            <SectionRow label="Address"       value={patient.address     ?? '—'} />
            <SectionRow label="National ID"   value={patient.national_id ?? '—'} />
            <SectionRow label="SHA number"    value={patient.sha_number  ?? '—'} />
            <SectionRow label="Registered"    value={patient.created_at?.slice(0, 10) ?? '—'} />
          </div>

          {upcoming.length > 0 && (
            <div className="card">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Next appointments</h3>
                <button onClick={() => setTab('appointments')} className="text-xs text-primary-600 hover:text-primary-700">View all</button>
              </div>
              {upcoming.slice(0, 3).map((a) => <ApptRow key={a.appointment_id} appt={a} />)}
            </div>
          )}

          {records.length > 0 && (
            <div className="card">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Recent records</h3>
                <button onClick={() => setTab('records')} className="text-xs text-primary-600 hover:text-primary-700">View all</button>
              </div>
              {records.slice(0, 3).map((r) => <RecordRow key={r.record_id ?? r.id} record={r} />)}
            </div>
          )}
        </div>
      )}

      {/* Tab: Appointments */}
      {tab === 'appointments' && (
        <div className="card overflow-hidden">
          {appointments.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400 text-sm">No appointments on record.</p>
          ) : (
            <div>
              {upcoming.length > 0 && (
                <>
                  <p className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">Upcoming</p>
                  {upcoming.map((a) => <ApptRow key={a.appointment_id} appt={a} />)}
                </>
              )}
              {past.length > 0 && (
                <>
                  <p className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-y border-gray-100">Past</p>
                  {past.map((a) => <ApptRow key={a.appointment_id} appt={a} />)}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Medical Records */}
      {tab === 'records' && (
        <div className="card overflow-hidden">
          {records.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400 text-sm">No medical records on file.</p>
          ) : (
            records.map((r) => <RecordRow key={r.record_id ?? r.id} record={r} expanded />)
          )}
        </div>
      )}

      {/* Tab: Consent */}
      {tab === 'consent' && (
        <ConsentPanel patientId={id} canCreate={canCreateConsent} canWithdraw={canWithdrawConsent} />
      )}

      {/* Delete confirmation modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Patient">
        <p className="text-sm text-gray-700 mb-4">
          Are you sure you want to deactivate <span className="font-semibold">{patient.first_name} {patient.last_name}</span>?
          They will be removed from all active workflows. Their medical records will be retained as required by law.
        </p>
        {deleteError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">{deleteError}</p>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deactivating…' : 'Yes, deactivate'}
          </button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Patient Info" size="lg">
        {form && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">First name</label>
                <input required className="form-input" value={form.first_name} onChange={f('first_name')} />
              </div>
              <div>
                <label className="form-label">Last name</label>
                <input required className="form-input" value={form.last_name} onChange={f('last_name')} />
              </div>
              <div>
                <label className="form-label">Date of birth</label>
                <input required type="date" className="form-input" value={form.date_of_birth} onChange={f('date_of_birth')} />
              </div>
              <div>
                <label className="form-label">Gender</label>
                <select className="form-select" value={form.gender} onChange={f('gender')}>
                  <option value="">Select…</option>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Blood type</label>
                <select className="form-select" value={form.blood_type} onChange={f('blood_type')}>
                  <option value="">Unknown</option>
                  {BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input type="tel" className="form-input" value={form.contact_number} onChange={f('contact_number')} />
              </div>
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={form.email} onChange={f('email')} />
            </div>
            <div>
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address} onChange={f('address')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">National ID</label>
                <input className="form-input" value={form.national_id} onChange={f('national_id')} />
              </div>
              <div>
                <label className="form-label">SHA number</label>
                <input className="form-input" value={form.sha_number} onChange={f('sha_number')} />
              </div>
            </div>
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

function StatPill({ label, value, accent }) {
  return (
    <div className={`card p-4 border-l-4 ${accent ? 'border-l-primary-500' : 'border-l-gray-200'}`}>
      <p className="text-2xl font-bold" style={{ color: '#1c1c1e' }}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function SectionRow({ label, value }) {
  return (
    <div className="px-5 py-3 flex text-sm">
      <span className="w-36 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}

function ApptRow({ appt }) {
  return (
    <div className="px-5 py-3 flex items-center justify-between text-sm border-b border-gray-50 last:border-0">
      <div>
        <span className="font-medium text-gray-900">
          Dr. {appt.doctor_first_name} {appt.doctor_last_name}
        </span>
        {appt.reason && <span className="text-gray-400 ml-2">· {appt.reason}</span>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-gray-500">
          {appt.appointment_date?.slice(0, 10) ?? appt.appointment_datetime?.slice(0, 10)}
        </span>
        <span className={`badge ${APPT_COLORS[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {appt.status}
        </span>
      </div>
    </div>
  )
}

function RecordRow({ record, expanded }) {
  return (
    <div className="px-5 py-4 border-b border-gray-50 last:border-0 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-gray-900">
          {record.visit_date?.slice(0, 10) ?? record.created_at?.slice(0, 10)}
          {record.doctor_first_name && (
            <span className="text-gray-400 font-normal ml-2">
              · Dr. {record.doctor_first_name} {record.doctor_last_name}
            </span>
          )}
        </span>
      </div>
      {record.diagnosis && (
        <p className="text-gray-700"><span className="text-gray-400">Diagnosis: </span>{record.diagnosis}</p>
      )}
      {expanded && record.consultation_notes && (
        <p className="text-gray-500 mt-1 whitespace-pre-wrap">{record.consultation_notes}</p>
      )}
      {expanded && record.treatment_plan && (
        <p className="text-gray-700 mt-1"><span className="text-gray-400">Treatment: </span>{record.treatment_plan}</p>
      )}
    </div>
  )
}
