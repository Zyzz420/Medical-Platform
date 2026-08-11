import client from './client'

export const getPatientConsents = (patientId)        => client.get(`/consent/patient/${patientId}`)
export const createConsent      = (data)              => client.post('/consent', data)
export const withdrawConsent    = (id)                 => client.patch(`/consent/${id}/withdraw`)
