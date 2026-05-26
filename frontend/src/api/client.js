import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const extractPdf = (file, onProgress) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/extract-pdf', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
  })
}

export const saveExtraction = (payload) => api.post('/save-extraction', payload)

export const getCompanies = () => api.get('/companies')
export const getDirectors = () => api.get('/directors')
export const updateCompany = (id, payload) => api.patch(`/companies/${id}`, payload)

export const updateDirector = (id, payload) => api.patch(`/directors/${id}`, payload)

export const deleteCompany = (id) => api.delete(`/companies/${id}`)
export const deleteDirector = (id) => api.delete(`/directors/${id}`)
