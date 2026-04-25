import axios, { AxiosError } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090'

// Check if we're in demo mode (using a mock token)
export const isDemoMode = (): boolean => {
  if (typeof window === 'undefined') return true
  const token = localStorage.getItem('token')
  if (!token) return true
  // Demo tokens start with these prefixes
  return token.startsWith('demo-') || 
         token.startsWith('google-') || 
         token.startsWith('facebook-') || 
         token.startsWith('x-') || 
         token.startsWith('apple-')
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth token
api.interceptors.request.use((config) => {
  // Always allow auth endpoints (login, register, etc.)
  const isAuthEndpoint = config.url?.includes('/auth/')
  const isMeEndpoint = config.url?.includes('/auth/me')
  
  // Skip non-auth API calls in demo mode (except for /me which returns 401 if not handled)
  if (!isAuthEndpoint && isDemoMode()) {
    const controller = new AbortController()
    controller.abort()
    config.signal = controller.signal
    return config
  }
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  // Add token if it exists AND (it's not an auth endpoint OR it's specifically the /me endpoint)
  if (token && (!isAuthEndpoint || isMeEndpoint)) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // In demo mode, reject silently
    if (isDemoMode() || error.code === 'ERR_CANCELED') {
      return Promise.reject(new Error('Demo mode - API calls disabled'))
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)
    const response = await api.post('/auth/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return response.data
  },
  
  register: async (email: string, password: string, fullName: string) => {
    const response = await api.post('/auth/register', { email, password, full_name: fullName })
    return response.data
  },
  
  getProfile: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },
}

// Children API
export const childrenApi = {
  list: async () => {
    const response = await api.get('/children/')
    return response.data
  },
  
  create: async (data: {
    name: string
    date_of_birth: string
    gender?: string
    medical_conditions?: string[]
    allergies?: string[]
  }) => {
    const response = await api.post('/children/', data)
    return response.data
  },
  
  get: async (id: string) => {
    const response = await api.get(`/children/${id}`)
    return response.data
  },
  
  update: async (id: string, data: Partial<{
    name: string
    date_of_birth: string
    gender: string
    medical_conditions: string[]
    allergies: string[]
  }>) => {
    const response = await api.patch(`/children/${id}`, data)
    return response.data
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/children/${id}`)
    return response.data
  },
}

// Symptoms API
export const symptomsApi = {
  list: async (childId: string) => {
    const response = await api.get(`/symptoms/child/${childId}`)
    return response.data
  },
  
  create: async (childId: string, data: {
    symptoms: Array<{
      name: string
      severity: number
      duration_hours?: number
      notes?: string
    }>
    vitals?: {
      temperature?: number
      heart_rate?: number
      respiratory_rate?: number
      blood_pressure?: string
      oxygen_saturation?: number
    }
  }) => {
    const response = await api.post(`/symptoms/${childId}`, data)
    return response.data
  },
  
  delete: async (symptomId: string) => {
    const response = await api.delete(`/symptoms/${symptomId}`)
    return response.data
  },
}

// Assessment API
export const assessmentApi = {
  run: async (childId: string) => {
    const response = await api.post(`/assessment/${childId}/assess`)
    return response.data
  },
  
  getHistory: async (childId: string) => {
    const response = await api.get(`/assessment/child/${childId}/history`)
    return response.data
  },
  
  delete: async (assessmentId: string) => {
    const response = await api.delete(`/assessment/${assessmentId}`)
    return response.data
  },
}

// Guidelines API
export const guidelinesApi = {
  search: async (symptoms: string[], childAge?: number) => {
    const response = await api.post('/guidelines/search', { symptoms, child_age: childAge })
    return response.data
  },
  
  get: async (topic: string) => {
    const response = await api.get(`/guidelines/${topic}`)
    return response.data
  },
}

// Environment API
export const environmentApi = {
  getAirQuality: async (zipCode: string) => {
    const response = await api.get(`/environment/air-quality/${zipCode}`)
    return response.data
  },
  
  getWeather: async (zipCode: string) => {
    const response = await api.get(`/environment/weather/${zipCode}`)
    return response.data
  },
  
  getCorrelations: async (childId: string, zipCode: string) => {
    const response = await api.post('/environment/correlations', { child_id: childId, zip_code: zipCode })
    return response.data
  },
}

// ============== Clinical Scoring Types ==============

export interface PEWSRequest {
  age_months: number
  // Cardiovascular
  heart_rate?: number
  systolic_bp?: number
  capillary_refill_seconds?: number
  skin_color?: 'normal' | 'pale' | 'mottled' | 'grey'
  // Respiratory
  respiratory_rate?: number
  oxygen_saturation?: number
  oxygen_requirement?: number // FiO2, default 0.21 (room air)
  work_of_breathing?: 'normal' | 'mild' | 'moderate' | 'severe'
  grunting?: boolean
  stridor?: boolean
  retractions?: boolean
  // Behavior
  avpu?: 'A' | 'V' | 'P' | 'U'
  behavior?: 'appropriate' | 'irritable' | 'lethargic'
  parent_concern?: boolean
}

export interface PEWSComponent {
  score: number
  max_score: number
  factors: string[]
}

export interface PEWSResponse {
  total_score: number
  max_score: number
  cardiovascular: PEWSComponent
  respiratory: PEWSComponent
  behavior: PEWSComponent
  risk_level: string
  escalation_recommended: boolean
  rapid_response_threshold: boolean
  interpretation: string
  recommended_actions: string[]
  confidence: number
}

export interface PhoenixScoreRequest {
  age_months: number
  // Respiratory
  spo2?: number
  pao2?: number
  fio2?: number
  on_invasive_ventilation?: boolean
  // Cardiovascular
  systolic_bp?: number
  diastolic_bp?: number
  lactate?: number
  vasoactive_medications?: string[]
  // Coagulation
  platelet_count?: number
  inr?: number
  // Neurological
  gcs_total?: number
  avpu?: string
  bilateral_fixed_pupils?: boolean
  // Context
  suspected_infection?: boolean
}

export interface PhoenixScoreComponent {
  score: number
  max_score: number
  factors: string[]
}

export interface PhoenixScoreResponse {
  total_score: number
  respiratory: PhoenixScoreComponent
  cardiovascular: PhoenixScoreComponent
  coagulation: PhoenixScoreComponent
  neurological: PhoenixScoreComponent
  meets_sepsis_criteria: boolean
  meets_septic_shock_criteria: boolean
  risk_level: string
  summary: string
  recommendations: string[]
  missing_data: string[]
  confidence: number
}

export interface PhysicalExamRequest {
  mental_status?: 'normal' | 'mildly_altered' | 'moderately_altered' | 'severely_altered' | 'unresponsive'
  gcs_total?: number
  avpu?: string
  pulse_quality?: 'normal' | 'slightly_weak' | 'weak' | 'thready' | 'absent'
  capillary_refill_seconds?: number
  skin_perfusion?: 'normal' | 'pale' | 'mottled' | 'cool' | 'cold' | 'cyanotic'
  has_fever?: boolean
  has_tachycardia?: boolean
}

export interface ExamFindingResult {
  name: string
  present: boolean
  severity: string
  description?: string
}

export interface PhysicalExamResponse {
  signs_present_count: number
  composite_relative_risk: number
  findings: {
    altered_mental_status: ExamFindingResult
    abnormal_pulse_quality: ExamFindingResult
    prolonged_capillary_refill: ExamFindingResult
    cold_mottled_extremities: ExamFindingResult
  }
  risk_level: string
  organ_dysfunction_risk: string
  summary: string[]
  recommendations: string[]
  confidence: number
}

// ============== Clinical Scoring API ==============

export const clinicalScoringApi = {
  /**
   * Calculate Pediatric Early Warning Score (PEWS)
   * Assesses three domains: Cardiovascular, Respiratory, Behavior
   * Score interpretation: 0-2 Low, 3-4 Moderate, 5-6 High, 7+ Critical
   */
  calculatePEWS: async (data: PEWSRequest): Promise<PEWSResponse> => {
    const response = await api.post('/clinical-scoring/pews', data)
    return response.data
  },
  
  /**
   * Calculate Phoenix Sepsis Score (2024 JAMA criteria)
   * Assesses four organ systems: Respiratory, Cardiovascular, Coagulation, Neurological
   * Sepsis: Score >= 2 with suspected infection
   */
  calculatePhoenixScore: async (data: PhoenixScoreRequest): Promise<PhoenixScoreResponse> => {
    const response = await api.post('/clinical-scoring/phoenix-score', data)
    return response.data
  },
  
  /**
   * Assess Physical Exam findings for critical illness risk
   * Evaluates 4 validated signs: mental status, pulse quality, cap refill, skin perfusion
   * Key finding: >=2 signs present = RR 4.98 for organ dysfunction
   */
  assessPhysicalExam: async (data: PhysicalExamRequest): Promise<PhysicalExamResponse> => {
    const response = await api.post('/clinical-scoring/physical-exam', data)
    return response.data
  },
}

// ============== Symptom Checker API ==============

export interface SymptomInput {
  symptom_id: string
  name: string
  severity: 'mild' | 'moderate' | 'severe'
  duration: string
  notes?: string
}

export interface SymptomCheckerStartResponse {
  session_id: string
  age_months: number
  sex: string
  created_at: string
  warnings: string[]
}

export interface AddSymptomsResponse {
  session_id: string
  symptoms_count: number
  red_flags_detected: string[]
  immediate_escalation: boolean
}

export interface TriageRecommendation {
  level: 'emergency_care' | 'call_now' | 'call_24_hours' | 'home_care'
  title: string
  description: string
  reasons: string[]
  recommendations: string[]
  warning_signs_to_watch: string[]
  disclaimer: string
}

export interface TriageResponse {
  session_id: string
  triage: TriageRecommendation
  symptoms_assessed: SymptomInput[]
  assessment_time: string
  confidence: number
}

export const symptomCheckerApi = {
  /**
   * Start a new symptom checker session
   */
  start: async (childId: string | undefined, ageMonths: number, sex: 'male' | 'female'): Promise<SymptomCheckerStartResponse> => {
    const response = await api.post('/symptom-checker/start', {
      child_id: childId,
      age_months: ageMonths,
      sex,
    })
    return response.data
  },
  
  /**
   * Add symptoms to an existing session
   */
  addSymptoms: async (sessionId: string, symptoms: SymptomInput[]): Promise<AddSymptomsResponse> => {
    const response = await api.post('/symptom-checker/symptoms', {
      session_id: sessionId,
      symptoms,
    })
    return response.data
  },
  
  /**
   * Get triage recommendation based on collected symptoms
   */
  getTriage: async (sessionId: string, additionalContext?: Record<string, unknown>): Promise<TriageResponse> => {
    const response = await api.post('/symptom-checker/triage', {
      session_id: sessionId,
      additional_context: additionalContext,
    })
    return response.data
  },
  
  /**
   * Delete a symptom checker session
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/symptom-checker/session/${sessionId}`)
  },
}

export default api
