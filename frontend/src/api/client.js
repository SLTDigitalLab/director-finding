import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('azureToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('azureUser')
      sessionStorage.removeItem('azureToken')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

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
export const getDirectors = (status) =>
  api.get('/directors', { params: status && status !== 'all' ? { status } : {} })
export const createCompany = (payload) => api.post('/companies', payload)
export const createDirector = (payload) => api.post('/directors', payload)
export const updateCompany = (id, payload) => api.patch(`/companies/${id}`, payload)

export const updateDirector = (id, payload) => api.patch(`/directors/${id}`, payload)

export const deleteCompany = (id) => api.delete(`/companies/${id}`)
export const deleteDirector = (id) => api.delete(`/directors/${id}`)

export const getBlacklistedCompanies = () => api.get('/blacklist/companies')
export const suggestCompaniesForNic = (nic) =>
  api.get('/blacklist/suggest-companies', { params: { nic } })

export const unlinkDirectorFromCompany = (companyId, directorId) =>
  api.delete(`/companies/${companyId}/directors/${directorId}`)

export const blacklistDirector = (id, payload) => api.patch(`/directors/${id}/blacklist`, payload)
export const unblacklistDirector = (id) => api.patch(`/directors/${id}/unblacklist`)
export const blacklistCompany = (id, payload) => api.patch(`/companies/${id}/blacklist`, payload)
export const unblacklistCompany = (id) => api.patch(`/companies/${id}/unblacklist`)
export const getBlacklistedDirectors = () => api.get('/blacklist/directors')

