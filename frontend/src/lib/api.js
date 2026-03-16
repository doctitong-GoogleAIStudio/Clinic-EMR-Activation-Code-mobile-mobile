import axios from 'axios';

// Always use current window origin for API calls - works on any deployed domain
// This ensures the frontend always calls the same domain it's served from
const API = typeof window !== 'undefined' 
  ? `${window.location.origin}/api`
  : '/api';

// Auth APIs
export const authAPI = {
  login: (data) => axios.post(`${API}/auth/login`, data),
  register: (data) => axios.post(`${API}/auth/register`, data),
  getMe: () => axios.get(`${API}/auth/me`),
  changePassword: (data) => axios.post(`${API}/account/change-password`, data),
};

// User APIs
export const userAPI = {
  getAll: () => axios.get(`${API}/users`),
  update: (id, data) => axios.put(`${API}/users/${id}`, data),
  create: (data) => axios.post(`${API}/auth/register`, data),
  createReceptionist: (data) => axios.post(`${API}/users/create-receptionist`, data),
  delete: (id) => axios.delete(`${API}/users/${id}`),
  getMyReceptionists: () => axios.get(`${API}/users/my-receptionists`),
};

// Patient APIs
export const patientAPI = {
  getAll: (search) => axios.get(`${API}/patients`, { params: { search, limit: 10000 } }),
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
  delete: (id) => axios.delete(`${API}/visits/${id}`),
};

// Appointment APIs
export const appointmentAPI = {
  getAll: (params) => axios.get(`${API}/appointments`, { params }),
  getOne: (id) => axios.get(`${API}/appointments/${id}`),
  getToday: (localDate) => axios.get(`${API}/appointments/today`, { params: { local_date: localDate } }),
  getQueue: (localDate) => axios.get(`${API}/queue/today`, { params: { local_date: localDate } }),
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
  update: (id, data) => axios.put(`${API}/attachments/${id}`, data),
  delete: (id) => axios.delete(`${API}/attachments/${id}`),
  getFileUrl: (id) => `${API}/attachments/${id}/file`,
  getFile: (id, token) => axios.get(`${API}/attachments/${id}/file`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob'
  }),
};

// Prescription APIs
export const prescriptionAPI = {
  getAll: (params) => axios.get(`${API}/prescriptions`, { params }),
  create: (data) => axios.post(`${API}/prescriptions`, data),
  delete: (id) => axios.delete(`${API}/prescriptions/${id}`),
};

// Certificate APIs
export const certificateAPI = {
  getAll: (params) => axios.get(`${API}/certificates`, { params }),
  create: (data) => axios.post(`${API}/certificates`, data),
  delete: (id) => axios.delete(`${API}/certificates/${id}`),
};

// Lab Request APIs
export const labRequestAPI = {
  getAll: (params) => axios.get(`${API}/lab-requests`, { params }),
  create: (data) => axios.post(`${API}/lab-requests`, data),
  delete: (id) => axios.delete(`${API}/lab-requests/${id}`),
};

// Settings APIs
export const settingsAPI = {
  get: () => axios.get(`${API}/settings`),
  update: (data) => axios.put(`${API}/settings`, data),
};

// AI APIs
export const aiAPI = {
  assist: (data) => axios.post(`${API}/ai/assist`, data),
  fullConsultation: (text, patientContext, vitals) => axios.post(`${API}/ai/assist`, {
    request_type: 'full_consultation',
    text,
    patient_context: patientContext,
    vitals
  }),
  getICD10: (diagnosis) => axios.post(`${API}/ai/assist`, {
    request_type: 'icd10_code',
    text: diagnosis
  }),
  calculateDose: (medication, patientContext) => axios.post(`${API}/ai/assist`, {
    request_type: 'drug_calculator',
    text: medication,
    patient_context: patientContext
  }),
  checkRedFlags: (vitals, medications, patientContext) => axios.post(`${API}/ai/assist`, {
    request_type: 'red_flag_check',
    text: 'Check for clinical red flags',
    vitals,
    medications,
    patient_context: patientContext
  }),
  // AI Draft endpoints
  saveDraft: (draft) => axios.post(`${API}/ai/drafts`, draft),
  getDrafts: (patientId) => axios.get(`${API}/ai/drafts/${patientId}`),
  deleteDraft: (draftId) => axios.delete(`${API}/ai/drafts/${draftId}`),
  deleteAllDrafts: (patientId) => axios.delete(`${API}/ai/drafts/patient/${patientId}`),
  // OCR endpoint
  extractText: (attachmentId) => axios.post(`${API}/ai/ocr`, { attachment_id: attachmentId }),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: (localDate) => axios.get(`${API}/dashboard/stats`, { params: { local_date: localDate } }),
};

// Export APIs
export const exportAPI = {
  patients: () => axios.get(`${API}/export/patients`),
  visits: (params) => axios.get(`${API}/export/visits`, { params }),
};

// Import APIs
export const importAPI = {
  patients: (data) => axios.post(`${API}/import/patients`, data),
  visits: (data) => axios.post(`${API}/import/visits`, data),
};

// Restore Backup API
export const restoreAPI = {
  restore: (data) => axios.post(`${API}/restore`, data),
};

// Audit Log APIs
export const auditAPI = {
  getAll: (limit) => axios.get(`${API}/audit-logs`, { params: { limit } }),
};

// Dictation APIs
export const dictationAPI = {
  createSession: (data) => axios.post(`${API}/dictation/sessions`, data),
  getSessions: (patientId) => axios.get(`${API}/dictation/sessions`, { params: { patient_id: patientId } }),
  getSession: (id) => axios.get(`${API}/dictation/sessions/${id}`),
  updateSession: (id, data) => axios.put(`${API}/dictation/sessions/${id}`, data),
  transcribe: (formData) => axios.post(`${API}/dictation/transcribe`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }),
  structure: (data) => axios.post(`${API}/dictation/structure`, data),
  logAudit: (data) => axios.post(`${API}/dictation/audit`, data),
  getAudit: (sessionId) => axios.get(`${API}/dictation/audit/${sessionId}`),
};
