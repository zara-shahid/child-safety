import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Helper function for formatting bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export interface User {
  id: string
  email: string
  full_name: string
}

// Personalized Baselines for each child
export interface ChildBaselines {
  temperature: { value: number; unit: string; learned: boolean }
  heart_rate: { value: number; unit: string; learned: boolean }
  oxygen: { value: number; unit: string; learned: boolean }
  respiratory_rate: { value: number; unit: string; learned: boolean }
  updated_at?: string
}

export interface Child {
  id: string
  name: string
  date_of_birth: string
  gender?: string
  weight_lbs?: number
  medical_conditions?: string[]
  allergies?: string[]
  baselines?: ChildBaselines
  created_at: string
}

export interface Symptom {
  name: string
  severity: number
  duration_hours?: number
  notes?: string
}

export interface SymptomEntry {
  id: string
  child_id: string
  symptoms: Symptom[]
  symptom?: string
  severity?: string | number
  body_region?: string
  vitals?: {
    temperature?: number
    heart_rate?: number
    respiratory_rate?: number
    blood_pressure?: string
    oxygen_saturation?: number
  }
  timestamp: string
  created_at: string
}

export interface StoreAssessment {
  id: string
  child_id: string
  risk_level: 'low' | 'moderate' | 'high' | 'critical'
  risk_score: number
  factors: Array<{
    name: string
    contribution: number
    explanation: string
  }>
  recommendations: string[]
  created_at: string
}

// Alias for backward compatibility
export type Assessment = StoreAssessment

export interface EnvironmentData {
  air_quality?: {
    aqi: number
    category: string
    pollutants: Record<string, number>
  }
  weather?: {
    temperature: number
    humidity: number
    conditions: string
  }
  pollen?: {
    level: string
    types: string[]
  }
}

export interface Medication {
  id: string
  name: string
  dosage: string
  unit: string
  frequency: string
  intervalHours: number
  instructions: string
  color: string
  type?: 'acetaminophen' | 'ibuprofen' | 'other'
}

export interface DoseLog {
  id: string
  medicationId: string
  medication?: string
  child_id?: string
  medication_name?: string
  timestamp: string | Date
  dosage: string
  dosage_mg?: number
  notes?: string
  temperature_before?: number
  type?: string
  efficacy_flag?: string
}

// Smart Vitals Integration Types
export type DataSource = 'manual' | 'device' | 'ai_inferred'
export type EventType = 'temperature' | 'heart_rate' | 'oxygen' | 'activity' | 'symptom'
export type EventStatus = 'pending' | 'confirmed' | 'ignored'

export interface DeviceSource {
  device_name: string
  device_id: string
  type: 'wearable_sensor' | 'smart_thermometer' | 'pulse_oximeter' | 'manual_entry'
  confidence_score: number
}

export interface RiskImpact {
  current_score: number
  predicted_score_if_confirmed: number
  severity: 'low' | 'moderate' | 'high' | 'critical'
}

export interface SuggestedAction {
  title: string
  message: string
  action_href?: string
  action_label?: string
  urgency?: 'low' | 'moderate' | 'high' | 'critical'
}

export interface DetectedEvent {
  id: string
  child_id: string
  type: EventType
  value: number | string
  unit: string
  timestamp: string
  source: DataSource
  device_name?: string
  device_source?: DeviceSource
  status: EventStatus
  threshold_exceeded?: boolean
  threshold_value?: number
  baseline_diff?: string
  ai_confidence?: number
  context?: string
  risk_impact?: RiskImpact
  suggested_action?: SuggestedAction
}

export interface VitalReading {
  id: string
  child_id: string
  type: 'temperature' | 'heart_rate' | 'oxygen' | 'respiratory_rate'
  value: number
  unit: string
  timestamp: string
  source: DataSource
  device_name?: string
  status?: 'normal' | 'elevated' | 'low' | 'critical'
}

export interface RiskTrend {
  score: number
  timestamp: string
}

export interface SmartInsight {
  id: string
  type: 'medication_due' | 'pattern_detected' | 'recommendation'
  title: string
  description: string
  action_label?: string
  action_href?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
}

// Enhanced Medication Types for Efficacy Tracking
export interface EnhancedDoseLog {
  id: string
  medicationId: string
  drug_name: string
  dosage_mg: number
  timestamp: string
  notes: string
  efficacy_flag?: 'normal' | 'low_response' | 'high_response' | 'adverse'
  temp_before?: number
  temp_after?: number
}

// Telehealth Handoff Types
export type HandoffPriority = 'ROUTINE' | 'URGENT' | 'CRITICAL'

export interface TelehealthHandoff {
  handoff_id: string
  generated_at: string
  priority_level: HandoffPriority
  patient_context: {
    patient_id: string
    name: string
    age_months: number
    weight_lbs?: number
    chronic_conditions: string[]
    allergies: string[]
  }
  triage_summary: {
    risk_score: number
    risk_level: string
    velocity: 'improving' | 'stable' | 'worsening'
    ai_generated_complaint: string
  }
  vitals_snapshot: {
    current_temp?: { value: number; unit: string; source: string; delta_baseline?: string }
    heart_rate?: { value: number; unit: string; status: string; source?: string }
    oxygen_saturation?: { value: number; unit: string; status: string }
  }
  medication_history_24h: Array<{
    drug_name: string
    dosage_mg: number
    administered_at: string
    efficacy_flag: string
  }>
  recent_event_timeline: Array<{
    time: string
    event: string
    detail: string
  }>
}

// Mental Health Types
export type MoodLevel = 'very_sad' | 'sad' | 'neutral' | 'happy' | 'very_happy'
export type CopingCategory = 'breathing' | 'grounding' | 'movement' | 'creative' | 'social' | 'mindfulness' | 'distraction'
export type AnxietyLevel = 'none' | 'mild' | 'moderate' | 'severe'

export interface MoodEntry {
  id: string
  child_id: string
  timestamp: string
  mood_level: MoodLevel
  energy_level: number  // 1-5
  anxiety_level: number // 0-10
  sleep_quality?: number // 1-5
  notes?: string
  triggers?: string[]
  activities?: string[]
}

export interface JournalEntry {
  id: string
  child_id: string
  timestamp: string
  title?: string
  content: string
  mood_before?: MoodLevel
  mood_after?: MoodLevel
  is_private: boolean
  tags?: string[]
}

export interface AnxietyAssessmentResult {
  id: string
  child_id: string
  assessment_type: string  // GAD-7, PHQ-A
  timestamp: string
  total_score: number
  severity: AnxietyLevel
  interpretation: string
  recommendations: string[]
}

export interface CopingStrategy {
  id: string
  name: string
  description: string
  category: CopingCategory
  age_appropriate_min: number
  age_appropriate_max: number
  duration_minutes: number
  steps: string[]
  benefits: string[]
  when_to_use: string[]
  icon: string
}

interface AppState {
  // Auth
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void

  // Children
  children: Child[]
  selectedChild: Child | null
  setChildren: (children: Child[]) => void
  addChild: (child: Child) => void
  updateChild: (id: string, data: Partial<Child>) => void
  removeChild: (id: string) => void
  selectChild: (child: Child | null) => void
  updateChildBaselines: (childId: string, baselines: Partial<ChildBaselines>) => void
  learnBaselinesFromHistory: (childId: string) => void
  getPersonalizedDeviation: (childId: string, type: 'temperature' | 'heart_rate' | 'oxygen', value: number) => { deviation: number; isSignificant: boolean; message: string }

  // Symptoms
  symptomHistory: SymptomEntry[]
  setSymptomHistory: (entries: SymptomEntry[]) => void
  addSymptomEntry: (entry: SymptomEntry) => void
  removeSymptomEntry: (id: string) => void

  // Assessments
  assessments: Assessment[]
  latestAssessment: Assessment | null
  setAssessments: (assessments: Assessment[]) => void
  addAssessment: (assessment: Assessment) => void
  removeAssessment: (id: string) => void
  setLatestAssessment: (assessment: Assessment | null) => void

  // Environment
  environment: EnvironmentData | null
  setEnvironment: (data: EnvironmentData | null) => void

  // Medications
  medications: Medication[]
  doseLogs: DoseLog[]
  setMedications: (medications: Medication[]) => void
  addMedication: (medication: Medication) => void
  updateMedication: (id: string, data: Partial<Medication>) => void
  removeMedication: (id: string) => void
  addDoseLog: (log: DoseLog) => void
  removeDoseLog: (id: string) => void

  // Smart Vitals & Detected Events
  detectedEvents: DetectedEvent[]
  vitalReadings: VitalReading[]
  riskTrend: RiskTrend[]
  smartInsights: SmartInsight[]
  telehealthHandoffs: TelehealthHandoff[]
  addDetectedEvent: (event: DetectedEvent) => void
  confirmEvent: (id: string) => void
  ignoreEvent: (id: string) => void
  addVitalReading: (reading: VitalReading) => void
  addRiskTrend: (trend: RiskTrend) => void
  generateHandoff: () => TelehealthHandoff | null
  addHandoff: (handoff: TelehealthHandoff) => void
  addSmartInsight: (insight: SmartInsight) => void
  dismissInsight: (id: string) => void
  simulateDeviceReading: () => void // For demo purposes

  // Mental Health
  moodHistory: MoodEntry[]
  journalEntries: JournalEntry[]
  anxietyAssessments: AnxietyAssessmentResult[]
  addMoodEntry: (entry: MoodEntry) => void
  addJournalEntry: (entry: JournalEntry) => void
  deleteJournalEntry: (id: string) => void
  addAnxietyAssessment: (result: AnxietyAssessmentResult) => void

  // UI
  isLoading: boolean
  setLoading: (loading: boolean) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  nightMode: boolean
  setNightMode: (enabled: boolean) => void

  // Data cleanup/retention
  cleanupOldData: () => void
  getStorageSize: () => { bytes: number; formatted: string }
  clearCache: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get): AppState => ({
      // Auth
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => {
        if (token) {
          localStorage.setItem('token', token)
        } else {
          localStorage.removeItem('token')
        }
        set({ token })
      },
      logout: () => {
        localStorage.removeItem('token')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          children: [],
          selectedChild: null,
          symptomHistory: [],
          assessments: [],
          latestAssessment: null,
        })
      },

      // Children
      children: [],
      selectedChild: null,
      setChildren: (children) => {
        // Dedupe children array
        const uniqueChildren = children.filter((child, index, self) =>
          index === self.findIndex(c => c.id === child.id)
        )
        set({ children: uniqueChildren })
      },
      addChild: (child) => set((state) => {
        // Prevent duplicates
        if (state.children.some(c => c.id === child.id)) {
          return state
        }
        return { children: [...state.children, child] }
      }),
      updateChild: (id, data) => set((state) => ({
        children: state.children.map((c) => c.id === id ? { ...c, ...data } : c),
        selectedChild: state.selectedChild?.id === id ? { ...state.selectedChild, ...data } : state.selectedChild,
      })),
      removeChild: (id) => set((state) => ({
        children: state.children.filter((c) => c.id !== id),
        selectedChild: state.selectedChild?.id === id ? null : state.selectedChild,
      })),
      selectChild: (child) => set({ selectedChild: child }),

      // Personalized Baselines
      updateChildBaselines: (childId, baselines) => set((state) => {
        const existingChild = state.children.find(c => c.id === childId)
        if (!existingChild) return state

        const updatedBaselines: ChildBaselines = {
          temperature: baselines.temperature || existingChild.baselines?.temperature || { value: 98.6, unit: '°F', learned: false },
          heart_rate: baselines.heart_rate || existingChild.baselines?.heart_rate || { value: 80, unit: 'bpm', learned: false },
          oxygen: baselines.oxygen || existingChild.baselines?.oxygen || { value: 98, unit: '%', learned: false },
          respiratory_rate: baselines.respiratory_rate || existingChild.baselines?.respiratory_rate || { value: 20, unit: '/min', learned: false },
          updated_at: new Date().toISOString(),
        }

        return {
          children: state.children.map(c =>
            c.id === childId ? { ...c, baselines: updatedBaselines } : c
          ),
          selectedChild: state.selectedChild?.id === childId
            ? { ...state.selectedChild, baselines: updatedBaselines }
            : state.selectedChild,
        }
      }),

      learnBaselinesFromHistory: (childId) => set((state) => {
        // Get all vital readings for this child
        const childReadings = state.vitalReadings.filter(r => r.child_id === childId)

        // Calculate averages for each vital type (excluding outliers)
        const tempReadings = childReadings.filter(r => r.type === 'temperature').map(r => r.value)
        const hrReadings = childReadings.filter(r => r.type === 'heart_rate').map(r => r.value)
        const o2Readings = childReadings.filter(r => r.type === 'oxygen').map(r => r.value)

        const calculateBaseline = (values: number[], defaultVal: number): number => {
          if (values.length < 3) return defaultVal
          // Remove top and bottom 10% as outliers
          const sorted = [...values].sort((a, b) => a - b)
          const trimCount = Math.floor(values.length * 0.1)
          const trimmed = sorted.slice(trimCount, sorted.length - trimCount)
          if (trimmed.length === 0) return defaultVal
          return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
        }

        const newBaselines: ChildBaselines = {
          temperature: {
            value: Math.round(calculateBaseline(tempReadings, 98.6) * 10) / 10,
            unit: '°F',
            learned: tempReadings.length >= 3
          },
          heart_rate: {
            value: Math.round(calculateBaseline(hrReadings, 80)),
            unit: 'bpm',
            learned: hrReadings.length >= 3
          },
          oxygen: {
            value: Math.round(calculateBaseline(o2Readings, 98)),
            unit: '%',
            learned: o2Readings.length >= 3
          },
          respiratory_rate: { value: 20, unit: '/min', learned: false },
          updated_at: new Date().toISOString(),
        }

        return {
          children: state.children.map(c =>
            c.id === childId ? { ...c, baselines: newBaselines } : c
          ),
          selectedChild: state.selectedChild?.id === childId
            ? { ...state.selectedChild, baselines: newBaselines }
            : state.selectedChild,
        }
      }),

      getPersonalizedDeviation: (childId, type, value) => {
        const state = useStore.getState()
        const child = state.children.find(c => c.id === childId)

        // Default baselines
        const defaults = {
          temperature: { value: 98.6, threshold: 1.8 }, // 1.8°F above baseline is significant
          heart_rate: { value: 80, threshold: 30 },     // 30 bpm above baseline
          oxygen: { value: 98, threshold: 3 },          // 3% below baseline
        }

        const baseline = child?.baselines?.[type]?.value || defaults[type].value
        const threshold = defaults[type].threshold

        const deviation = type === 'oxygen'
          ? baseline - value  // For O2, lower is concerning
          : value - baseline  // For temp/HR, higher is concerning

        const isSignificant = Math.abs(deviation) >= threshold

        let message = ''
        if (isSignificant) {
          if (type === 'temperature') {
            message = `${Math.abs(deviation).toFixed(1)}°F above ${child?.name || 'their'}'s personal baseline of ${baseline}°F`
          } else if (type === 'heart_rate') {
            message = `${Math.abs(deviation)} bpm ${deviation > 0 ? 'above' : 'below'} ${child?.name || 'their'}'s baseline`
          } else if (type === 'oxygen') {
            message = `${Math.abs(deviation)}% below ${child?.name || 'their'}'s normal oxygen level`
          }
        }

        return { deviation, isSignificant, message }
      },

      // Symptoms
      symptomHistory: [],
      setSymptomHistory: (entries) => set({ symptomHistory: entries }),
      addSymptomEntry: (entry) => set((state) => ({ symptomHistory: [entry, ...state.symptomHistory] })),
      removeSymptomEntry: (id) => set((state) => ({
        symptomHistory: state.symptomHistory.filter((e) => e.id !== id)
      })),

      // Assessments
      assessments: [],
      latestAssessment: null,
      setAssessments: (assessments) => set({ assessments }),
      addAssessment: (assessment) => set((state) => ({
        assessments: [assessment, ...state.assessments],
        latestAssessment: assessment,
      })),
      removeAssessment: (id) => set((state) => ({
        assessments: state.assessments.filter((a) => a.id !== id),
        latestAssessment: state.latestAssessment?.id === id ? null : state.latestAssessment,
      })),
      setLatestAssessment: (assessment) => set({ latestAssessment: assessment }),

      // Environment
      environment: null,
      setEnvironment: (environment) => set({ environment }),

      // Medications
      medications: [],
      doseLogs: [],
      setMedications: (medications) => set({ medications }),
      addMedication: (medication) => set((state) => {
        if (state.medications.some(m => m.id === medication.id)) return state
        return { medications: [...state.medications, medication] }
      }),
      updateMedication: (id, data) => set((state) => ({
        medications: state.medications.map((m) => m.id === id ? { ...m, ...data } : m),
      })),
      removeMedication: (id) => set((state) => ({
        medications: state.medications.filter((m) => m.id !== id),
        doseLogs: state.doseLogs.filter((d) => d.medicationId !== id),
      })),
      addDoseLog: (log) => set((state) => ({ doseLogs: [log, ...state.doseLogs] })),
      removeDoseLog: (id) => set((state) => ({
        doseLogs: state.doseLogs.filter((d) => d.id !== id),
      })),

      // Smart Vitals & Detected Events
      detectedEvents: [],
      vitalReadings: [],
      riskTrend: [],
      smartInsights: [],

      addDetectedEvent: (event) => set((state) => ({
        detectedEvents: [event, ...state.detectedEvents],
      })),

      confirmEvent: (id) => set((state) => {
        const event = state.detectedEvents.find(e => e.id === id)
        if (!event) return state

        // Move confirmed event to symptom history as a verified vital
        const updatedEvents = state.detectedEvents.map(e =>
          e.id === id ? { ...e, status: 'confirmed' as const } : e
        )

        // Add to vital readings for tracking
        const newReading: VitalReading = {
          id: `reading-${Date.now()}`,
          child_id: event.child_id,
          type: event.type as VitalReading['type'],
          value: typeof event.value === 'number' ? event.value : parseFloat(event.value as string) || 0,
          unit: event.unit,
          timestamp: event.timestamp,
          source: event.source,
          device_name: event.device_name,
        }

        return {
          detectedEvents: updatedEvents,
          vitalReadings: [newReading, ...state.vitalReadings],
        }
      }),

      ignoreEvent: (id) => set((state) => ({
        detectedEvents: state.detectedEvents.map(e =>
          e.id === id ? { ...e, status: 'ignored' as const } : e
        ),
      })),

      addVitalReading: (reading) => set((state) => ({
        vitalReadings: [reading, ...state.vitalReadings],
      })),

      addRiskTrend: (trend) => set((state) => ({
        riskTrend: [...state.riskTrend.slice(-23), trend], // Keep last 24 readings
      })),

      addSmartInsight: (insight) => set((state) => ({
        smartInsights: [insight, ...state.smartInsights.filter(i => i.id !== insight.id)],
      })),

      dismissInsight: (id) => set((state) => ({
        smartInsights: state.smartInsights.filter(i => i.id !== id),
      })),

      // Simulate device reading for demo with enhanced data contract
      simulateDeviceReading: () => set((state) => {
        if (!state.selectedChild) return state

        const currentRiskScore = state.latestAssessment?.risk_score || 35
        const types: Array<{
          type: DetectedEvent['type'],
          value: number,
          unit: string,
          threshold: number,
          baseline: number,
          riskIncrease: number
        }> = [
            { type: 'temperature', value: 100.4 + Math.random() * 2.5, unit: '°F', threshold: 100.4, baseline: 98.6, riskIncrease: 15 },
            { type: 'heart_rate', value: 90 + Math.random() * 40, unit: 'bpm', threshold: 120, baseline: 85, riskIncrease: 8 },
            { type: 'oxygen', value: 94 + Math.random() * 4, unit: '%', threshold: 95, baseline: 98, riskIncrease: 20 },
          ]

        const selected = types[Math.floor(Math.random() * types.length)]
        const devices = [
          { name: 'Kinsa Smart Ear', id: 'dev_kinsa_01' },
          { name: 'Owlet Sock 3', id: 'dev_owlet_03' },
          { name: 'Apple Watch SE', id: 'dev_apple_02' },
          { name: 'Withings Thermo', id: 'dev_withings_01' },
        ]
        const device = devices[Math.floor(Math.random() * devices.length)]
        const value = Math.round(selected.value * 10) / 10
        const thresholdExceeded = selected.type === 'oxygen'
          ? value < selected.threshold
          : value > selected.threshold
        const baselineDiff = selected.type === 'oxygen'
          ? (selected.baseline - value).toFixed(1)
          : (value - selected.baseline).toFixed(1)

        const newEvent: DetectedEvent = {
          id: `evt_${Date.now()}_${selected.type}`,
          child_id: state.selectedChild.id,
          type: selected.type,
          value: value,
          unit: selected.unit,
          timestamp: new Date().toISOString(),
          source: 'device',
          device_name: device.name,
          device_source: {
            device_name: device.name,
            device_id: device.id,
            type: 'wearable_sensor',
            confidence_score: 0.95 + Math.random() * 0.04,
          },
          status: 'pending',
          threshold_exceeded: thresholdExceeded,
          threshold_value: selected.threshold,
          baseline_diff: `${thresholdExceeded ? '+' : ''}${baselineDiff}`,
          risk_impact: thresholdExceeded ? {
            current_score: currentRiskScore,
            predicted_score_if_confirmed: Math.min(100, currentRiskScore + selected.riskIncrease),
            severity: currentRiskScore + selected.riskIncrease > 80 ? 'high' :
              currentRiskScore + selected.riskIncrease > 50 ? 'moderate' : 'low',
          } : undefined,
          suggested_action: thresholdExceeded ? {
            title: selected.type === 'temperature' ? 'Verify Fever' :
              selected.type === 'oxygen' ? 'Check Oxygen' : 'Verify Heart Rate',
            message: selected.type === 'temperature'
              ? 'Abnormal temperature detected. Confirm to update medical log and risk assessment.'
              : selected.type === 'oxygen'
                ? 'Low oxygen saturation detected. Verify reading and consider repositioning child.'
                : 'Elevated heart rate detected. Confirm to log and monitor.',
          } : undefined,
          context: thresholdExceeded
            ? selected.type === 'temperature'
              ? 'Elevated temperature may indicate infection. Monitor for other symptoms.'
              : selected.type === 'oxygen'
                ? 'Low O2 saturation may indicate respiratory distress. Check breathing.'
                : 'Elevated HR can accompany fever or stress. Correlate with other vitals.'
            : undefined,
        }

        return { detectedEvents: [newEvent, ...state.detectedEvents] }
      }),

      // Telehealth Handoff Generation
      telehealthHandoffs: [],

      generateHandoff: () => {
        const state = useStore.getState()
        if (!state.selectedChild || !state.latestAssessment) return null

        // Calculate age in months
        const birthDate = new Date(state.selectedChild.date_of_birth)
        const ageMonths = Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))

        // Get latest vitals
        const childVitals = state.vitalReadings.filter(v => v.child_id === state.selectedChild?.id)
        const latestTemp = childVitals.find(v => v.type === 'temperature')
        const latestHR = childVitals.find(v => v.type === 'heart_rate')
        const latestO2 = childVitals.find(v => v.type === 'oxygen')

        // Get recent dose logs
        const recentDoses = state.doseLogs.slice(0, 5).map(log => {
          const med = state.medications.find(m => m.id === log.medicationId)
          return {
            drug_name: med?.name || 'Unknown',
            dosage_mg: parseInt(log.dosage) || 0,
            administered_at: new Date(log.timestamp).toISOString(),
            efficacy_flag: 'normal',
          }
        })

        // Build timeline from events and symptoms
        const timeline: Array<{ time: string; event: string; detail: string }> = []

        state.detectedEvents
          .filter(e => e.child_id === state.selectedChild?.id && e.status === 'confirmed')
          .slice(0, 5)
          .forEach(e => {
            timeline.push({
              time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              event: 'Vital Alert',
              detail: `${e.type} ${e.value}${e.unit} detected via ${e.device_name || 'device'}.`,
            })
          })

        state.doseLogs.slice(0, 3).forEach(log => {
          const med = state.medications.find(m => m.id === log.medicationId)
          timeline.push({
            time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            event: 'Medication',
            detail: `${med?.name || 'Medication'} ${log.dosage} administered.`,
          })
        })

        // Determine risk velocity
        const recentTrends = state.riskTrend.slice(-5)
        const velocity: 'improving' | 'stable' | 'worsening' =
          recentTrends.length >= 2
            ? recentTrends[recentTrends.length - 1].score > recentTrends[0].score + 5 ? 'worsening'
              : recentTrends[recentTrends.length - 1].score < recentTrends[0].score - 5 ? 'improving'
                : 'stable'
            : 'stable'

        // Generate AI complaint
        const conditions = state.selectedChild.medical_conditions?.join(', ') || 'none'
        const ageYears = Math.floor(ageMonths / 12)
        const tempStr = latestTemp ? `${latestTemp.value}°F` : 'not recorded'

        const handoff: TelehealthHandoff = {
          handoff_id: `ho_${Date.now()}_${state.selectedChild.id.slice(-4)}`,
          generated_at: new Date().toISOString(),
          priority_level: state.latestAssessment.risk_score >= 80 ? 'CRITICAL' :
            state.latestAssessment.risk_score >= 60 ? 'URGENT' : 'ROUTINE',
          patient_context: {
            patient_id: `pt_${state.selectedChild.id}_encrypted`,
            name: state.selectedChild.name,
            age_months: ageMonths,
            weight_lbs: undefined, // Would come from growth data
            chronic_conditions: state.selectedChild.medical_conditions || [],
            allergies: state.selectedChild.allergies || [],
          },
          triage_summary: {
            risk_score: state.latestAssessment.risk_score,
            risk_level: state.latestAssessment.risk_level,
            velocity,
            ai_generated_complaint: `${ageYears}yo ${state.selectedChild.gender || 'child'} presenting with current temperature ${tempStr}. Risk score ${state.latestAssessment.risk_score} (${state.latestAssessment.risk_level}). ${conditions !== 'none' ? `History of ${conditions}.` : 'No significant medical history.'}`,
          },
          vitals_snapshot: {
            current_temp: latestTemp ? {
              value: latestTemp.value,
              unit: 'F',
              source: `${latestTemp.device_name || 'Manual'} (Verified)`,
              delta_baseline: latestTemp.value > 98.6 ? `+${(latestTemp.value - 98.6).toFixed(1)}` : undefined,
            } : undefined,
            heart_rate: latestHR ? {
              value: latestHR.value,
              unit: 'bpm',
              status: latestHR.value > 100 ? 'elevated' : 'normal',
              source: latestHR.device_name,
            } : undefined,
            oxygen_saturation: latestO2 ? {
              value: latestO2.value,
              unit: '%',
              status: latestO2.value < 95 ? 'low' : 'normal',
            } : undefined,
          },
          medication_history_24h: recentDoses,
          recent_event_timeline: timeline.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8),
        }

        return handoff
      },

      addHandoff: (handoff) => set((state) => ({
        telehealthHandoffs: [handoff, ...state.telehealthHandoffs],
      })),

      // Mental Health
      moodHistory: [],
      journalEntries: [],
      anxietyAssessments: [],

      addMoodEntry: (entry) => set((state) => ({
        moodHistory: [entry, ...state.moodHistory].slice(0, 100), // Keep max 100 entries
      })),

      addJournalEntry: (entry) => set((state) => ({
        journalEntries: [entry, ...state.journalEntries].slice(0, 50), // Keep max 50 entries
      })),

      deleteJournalEntry: (id) => set((state) => ({
        journalEntries: state.journalEntries.filter(e => e.id !== id),
      })),

      addAnxietyAssessment: (result) => set((state) => ({
        anxietyAssessments: [result, ...state.anxietyAssessments].slice(0, 20), // Keep max 20 assessments
      })),

      // UI
      isLoading: false,
      setLoading: (isLoading) => set({ isLoading }),
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      nightMode: false,
      setNightMode: (nightMode) => set({ nightMode }),

      // Data cleanup/retention functions
      cleanupOldData: () => set((state) => {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        return {
          // Keep only last 30 days of symptom history
          symptomHistory: state.symptomHistory.filter(
            entry => new Date(entry.timestamp) > thirtyDaysAgo
          ).slice(0, 500), // Max 500 entries

          // Keep only last 7 days of detected events
          detectedEvents: state.detectedEvents.filter(
            event => new Date(event.timestamp) > sevenDaysAgo
          ).slice(0, 200), // Max 200 entries

          // Keep only last 200 vital readings
          vitalReadings: state.vitalReadings.slice(0, 200),

          // Keep only last 100 assessments
          assessments: state.assessments.slice(0, 100),

          // Keep only last 50 dose logs
          doseLogs: state.doseLogs.slice(0, 50),

          // Keep only last 24 risk trend points
          riskTrend: state.riskTrend.slice(-24),

          // Keep only last 10 telehealth handoffs
          telehealthHandoffs: state.telehealthHandoffs.slice(0, 10),

          // Keep only insights from last 7 days
          smartInsights: state.smartInsights.filter(
            insight => new Date(insight.timestamp) > sevenDaysAgo
          ).slice(0, 50),

          // Mental health: keep only mood entries from last 30 days
          moodHistory: state.moodHistory.filter(
            entry => new Date(entry.timestamp) > thirtyDaysAgo
          ).slice(0, 100),

          // Keep only last 50 journal entries
          journalEntries: state.journalEntries.slice(0, 50),

          // Keep only last 20 anxiety assessments
          anxietyAssessments: state.anxietyAssessments.slice(0, 20),
        }
      }),

      // Get storage size estimate
      getStorageSize: () => {
        try {
          const state = useStore.getState()
          const serialized = JSON.stringify({
            symptomHistory: state.symptomHistory,
            detectedEvents: state.detectedEvents,
            vitalReadings: state.vitalReadings,
            assessments: state.assessments,
            doseLogs: state.doseLogs,
            riskTrend: state.riskTrend,
          })
          return {
            bytes: new Blob([serialized]).size,
            formatted: formatBytes(new Blob([serialized]).size),
          }
        } catch {
          return { bytes: 0, formatted: '0 B' }
        }
      },

      // Clear all non-essential data (keep auth and children)
      clearCache: () => set({
        symptomHistory: [],
        detectedEvents: [],
        vitalReadings: [],
        assessments: [],
        latestAssessment: null,
        doseLogs: [],
        riskTrend: [],
        telehealthHandoffs: [],
        smartInsights: [],
        environment: null,
        moodHistory: [],
        journalEntries: [],
        anxietyAssessments: [],
      }),
    }),
    {
      name: 'epcid-storage',

      partialize: (state: any) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        children: state.children,
        selectedChild: state.selectedChild,
        symptomHistory: state.symptomHistory,
        assessments: state.assessments,
        latestAssessment: state.latestAssessment,
        medications: state.medications,
        doseLogs: state.doseLogs,
        detectedEvents: state.detectedEvents,
        vitalReadings: state.vitalReadings,
        riskTrend: state.riskTrend,
        moodHistory: state.moodHistory,
        journalEntries: state.journalEntries,
        anxietyAssessments: state.anxietyAssessments,
      }),
      // Clean up duplicates and old data when rehydrating from localStorage
      onRehydrateStorage: () => (state: AppState | undefined) => {
        if (state) {
          // Dedupe children array
          if (state.children && state.children.length > 0) {
            const uniqueChildren = state.children.filter((child: Child, index: number, self: Child[]) =>
              index === self.findIndex((c: Child) => c.id === child.id)
            )
            if (uniqueChildren.length !== state.children.length) {
              state.children = uniqueChildren
            }
          }

          // Run cleanup after a short delay to not block hydration
          setTimeout(() => {
            useStore.getState().cleanupOldData()
          }, 1000)
        }
      },
      // Store version for migrations
      version: 2,
      // Handle migrations between store versions
      migrate: (persistedState: unknown, version: number): any => {
        const state = persistedState as any

        if (version < 2) {
          // Migration from v1 to v2: Add any necessary transformations
          // For now, just ensure arrays exist
          return {
            ...state,
            smartInsights: state.smartInsights || [],
            telehealthHandoffs: state.telehealthHandoffs || [],
          }
        }

        return state
      },
    }
  )
)

export default useStore
