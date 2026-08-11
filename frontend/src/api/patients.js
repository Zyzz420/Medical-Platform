import client from './client'

export const getPatients   = (page = 1, limit = 50) => client.get('/patients', { params: { page, limit } })
export const getPatient    = (id)                   => client.get(`/patients/${id}`)
export const createPatient = (data)                 => client.post('/patients', data)
export const updatePatient = (id, data)             => client.put(`/patients/${id}`, data)
export const deletePatient = (id)                   => client.delete(`/patients/${id}`)
export const exportPatientData = (id)               => client.get(`/patients/${id}/export`)
