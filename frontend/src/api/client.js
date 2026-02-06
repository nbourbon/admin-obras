import axios from 'axios'

// In production, use the full backend URL. In development, use the Vite proxy.
const API_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token and project ID to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  const projectId = localStorage.getItem('currentProjectId')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (projectId) {
    config.headers['X-Project-ID'] = projectId
  }
  return config
})

// Handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (email, password) =>
    client.post('/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  me: () => client.get('/auth/me'),
  registerFirstAdmin: (data) => client.post('/auth/register-first-admin', data),
  register: (data) => client.post('/auth/register', data),
  selfRegister: (data) => client.post('/auth/self-register', data),
}

// Users API
export const usersAPI = {
  list: (includeInactive = false) => client.get(`/users?include_inactive=${includeInactive}`),
  get: (id) => client.get(`/users/${id}`),
  update: (id, data) => client.put(`/users/${id}`, data),
  delete: (id) => client.delete(`/users/${id}`),
  validateParticipation: () => client.get('/users/participation-validation'),
  changePassword: (id, newPassword) => client.put(`/users/${id}/change-password`, { new_password: newPassword }),
}

// Providers API
export const providersAPI = {
  list: () => client.get('/providers'),
  create: (data) => client.post('/providers', data),
  update: (id, data) => client.put(`/providers/${id}`, data),
  delete: (id) => client.delete(`/providers/${id}`),
}

// Categories API
export const categoriesAPI = {
  list: () => client.get('/categories'),
  create: (data) => client.post('/categories', data),
  update: (id, data) => client.put(`/categories/${id}`, data),
  delete: (id) => client.delete(`/categories/${id}`),
}

// Expenses API
export const expensesAPI = {
  list: (filters = {}) => client.get('/expenses', { params: filters }),
  get: (id) => client.get(`/expenses/${id}`),
  create: (data) => client.post('/expenses', data),
  update: (id, data) => client.put(`/expenses/${id}`, data),
  uploadInvoice: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post(`/expenses/${id}/invoice`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadInvoice: (id) => client.get(`/expenses/${id}/invoice`, { responseType: 'blob' }),
}

// Payments API
export const paymentsAPI = {
  myPayments: (pendingOnly = false) => client.get(`/payments/my?pending_only=${pendingOnly}`),
  get: (id) => client.get(`/payments/${id}`),
  markPaid: (id, data) => client.put(`/payments/${id}/mark-paid`, data),
  submitPayment: (id, data) => client.put(`/payments/${id}/submit-payment`, data),
  unmarkPaid: (id) => client.put(`/payments/${id}/unmark-paid`),
  pendingApproval: () => client.get('/payments/pending-approval'),
  approve: (id, data) => client.put(`/payments/${id}/approve`, data),
  uploadReceipt: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post(`/payments/${id}/receipt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadReceipt: (id) => client.get(`/payments/${id}/receipt`, { responseType: 'blob' }),
}

// Dashboard API
export const dashboardAPI = {
  summary: () => client.get('/dashboard/summary'),
  evolution: () => client.get('/dashboard/evolution'),
  myStatus: () => client.get('/dashboard/my-status'),
  allUsersStatus: () => client.get('/dashboard/all-users-status'),
  expenseStatus: (id) => client.get(`/dashboard/expense-status/${id}`),
}

// Exchange Rate API
export const exchangeRateAPI = {
  current: () => client.get('/exchange-rate/current'),
  history: (limit = 100) => client.get(`/exchange-rate/history?limit=${limit}`),
}

// Projects API
export const projectsAPI = {
  list: () => client.get('/projects'),
  get: (id) => client.get(`/projects/${id}`),
  create: (data) => client.post('/projects', data),
  update: (id, data) => client.put(`/projects/${id}`, data),
  delete: (id) => client.delete(`/projects/${id}`),
  members: (id) => client.get(`/projects/${id}/members`),
  addMember: (id, data) => client.post(`/projects/${id}/members`, data),
  addMemberByEmail: (id, email, participationPercentage, isAdmin, fullName) =>
    client.post(`/projects/${id}/members/by-email`, null, {
      params: { email, participation_percentage: participationPercentage, is_admin: isAdmin, full_name: fullName },
    }),
  updateMember: (id, userId, data) => client.put(`/projects/${id}/members/${userId}`, data),
  removeMember: (id, userId) => client.delete(`/projects/${id}/members/${userId}`),
  validateParticipation: (id) => client.get(`/projects/${id}/participation-validation`),
}

// Notes API
export const notesAPI = {
  list: () => client.get('/notes'),
  get: (id) => client.get(`/notes/${id}`),
  create: (data) => client.post('/notes', data),
  update: (id, data) => client.put(`/notes/${id}`, data),
  delete: (id) => client.delete(`/notes/${id}`),
  addComment: (id, data) => client.post(`/notes/${id}/comments`, data),
  deleteComment: (noteId, commentId) => client.delete(`/notes/${noteId}/comments/${commentId}`),
  vote: (id, data) => client.post(`/notes/${id}/vote`, data),
  resetVote: (noteId, userId) => client.delete(`/notes/${noteId}/vote/${userId}`),
}

export default client
