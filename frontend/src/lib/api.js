import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Auth APIs
export const authAPI = {
  login: (data) => axios.post(`${API}/auth/login`, data),
  register: (data) => axios.post(`${API}/auth/register`, data),
  getMe: () => axios.get(`${API}/auth/me`),
};

// User APIs
export const userAPI = {
  getAll: () => axios.get(`${API}/users`),
  update: (id, data) => axios.put(`${API}/users/${id}`, data),
  create: (data) => axios.post(`${API}/auth/register`, data),
};

// Patient APIs
export const patientAPI = {
  getAll: (search) => axios.get(`${API}/patients`, { params: { search } }),
  getOne: (id) => axios.get(`${API}/patients/${id}`),
  create: (data) => axios.post(`${API}/patients`, data),
  update: (id, data) => axios.put(`${API}/patients/${id}`, data),
  delete: (id) => axios.delete(`${API}/patients/${id}`),
};

// Visit APIs
export const visitAPI = {
  getAll: (params) => axios.get(`${API}/visits`, { params }),
  getOne: (id) => axios.get(`${API}/visits/${id}`),
  create: (data) => axios.post(`${API}/visits`, data),
  update: (id, data) => axios.put(`${API}/visits/${id}`, data),
};

// Appointment APIs
export const appointmentAPI = {
  getAll: (params) => axios.get(`${API}/appointments`, { params }),
  getToday: () => axios.get(`${API}/appointments/today`),
  getQueue: () => axios.get(`${API}/queue/today`),
  create: (data) => axios.post(`${API}/appointments`, data),
  update: (id, data) => axios.put(`${API}/appointments/${id}`, data),
  delete: (id) => axios.delete(`${API}/appointments/${id}`),
};

// Attachment APIs
export const attachmentAPI = {
  getAll: (params) => axios.get(`${API}/attachments`, { params }),
  getOne: (id) => axios.get(`${API}/attachments/${id}`),
  upload: (formData) => axios.post(`${API}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => axios.delete(`${API}/attachments/${id}`),
};

// Prescription APIs
export const prescriptionAPI = {
  getAll: (params) => axios.get(`${API}/prescriptions`, { params }),
  create: (data) => axios.post(`${API}/prescriptions`, data),
};

// Certificate APIs
export const certificateAPI = {
  getAll: (params) => axios.get(`${API}/certificates`, { params }),
  create: (data) => axios.post(`${API}/certificates`, data),
};

// Settings APIs
export const settingsAPI = {
  get: () => axios.get(`${API}/settings`),
  update: (data) => axios.put(`${API}/settings`, data),
};

// AI APIs
export const aiAPI = {
  assist: (data) => axios.post(`${API}/ai/assist`, data),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => axios.get(`${API}/dashboard/stats`),
};

// Export APIs
export const exportAPI = {
  patients: () => axios.get(`${API}/export/patients`),
  visits: (params) => axios.get(`${API}/export/visits`, { params }),
};

// Audit Log APIs
export const auditAPI = {
  getAll: (limit) => axios.get(`${API}/audit-logs`, { params: { limit } }),
};
