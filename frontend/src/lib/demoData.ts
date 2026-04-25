import type {
  Child,
  SymptomEntry,
  Medication,
  DoseLog,
  DetectedEvent,
  VitalReading,
  RiskTrend,
  Assessment,
  MoodEntry,
  JournalEntry,
  AnxietyAssessmentResult,
  SmartInsight,
} from '@/store/useStore'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString()
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString()
}

export const DEMO_CHILDREN: Child[] = [
  {
    id: 'demo-child-1',
    name: 'Emma',
    date_of_birth: '2022-06-15',
    gender: 'female',
    weight_lbs: 32,
    medical_conditions: ['mild asthma'],
    allergies: ['penicillin'],
    baselines: {
      temperature: { value: 98.4, unit: '°F', learned: true },
      heart_rate: { value: 95, unit: 'bpm', learned: true },
      oxygen: { value: 99, unit: '%', learned: true },
      respiratory_rate: { value: 22, unit: '/min', learned: true },
      updated_at: daysAgo(2),
    },
    created_at: daysAgo(30),
  },
  {
    id: 'demo-child-2',
    name: 'Liam',
    date_of_birth: '2020-01-22',
    gender: 'male',
    weight_lbs: 45,
    medical_conditions: [],
    allergies: ['peanuts'],
    baselines: {
      temperature: { value: 98.6, unit: '°F', learned: true },
      heart_rate: { value: 88, unit: 'bpm', learned: true },
      oxygen: { value: 99, unit: '%', learned: true },
      respiratory_rate: { value: 20, unit: '/min', learned: true },
      updated_at: daysAgo(5),
    },
    created_at: daysAgo(45),
  },
]

export const DEMO_VITAL_READINGS: VitalReading[] = [
  // Emma's vitals — recent illness
  { id: 'vr-1', child_id: 'demo-child-1', type: 'temperature', value: 101.3, unit: '°F', timestamp: hoursAgo(1), source: 'manual', status: 'elevated' },
  { id: 'vr-2', child_id: 'demo-child-1', type: 'heart_rate', value: 112, unit: 'bpm', timestamp: hoursAgo(1), source: 'device', status: 'elevated' },
  { id: 'vr-3', child_id: 'demo-child-1', type: 'oxygen', value: 97, unit: '%', timestamp: hoursAgo(1), source: 'device', status: 'normal' },
  { id: 'vr-4', child_id: 'demo-child-1', type: 'respiratory_rate', value: 28, unit: '/min', timestamp: hoursAgo(1), source: 'manual', status: 'elevated' },
  { id: 'vr-5', child_id: 'demo-child-1', type: 'temperature', value: 102.1, unit: '°F', timestamp: hoursAgo(4), source: 'manual', status: 'critical' },
  { id: 'vr-6', child_id: 'demo-child-1', type: 'heart_rate', value: 118, unit: 'bpm', timestamp: hoursAgo(4), source: 'device', status: 'elevated' },
  { id: 'vr-7', child_id: 'demo-child-1', type: 'temperature', value: 100.8, unit: '°F', timestamp: hoursAgo(8), source: 'manual', status: 'elevated' },
  { id: 'vr-8', child_id: 'demo-child-1', type: 'temperature', value: 99.2, unit: '°F', timestamp: hoursAgo(14), source: 'manual', status: 'normal' },
  { id: 'vr-9', child_id: 'demo-child-1', type: 'temperature', value: 98.6, unit: '°F', timestamp: daysAgo(1), source: 'manual', status: 'normal' },
  // Liam's vitals — healthy
  { id: 'vr-10', child_id: 'demo-child-2', type: 'temperature', value: 98.4, unit: '°F', timestamp: hoursAgo(3), source: 'manual', status: 'normal' },
  { id: 'vr-11', child_id: 'demo-child-2', type: 'heart_rate', value: 86, unit: 'bpm', timestamp: hoursAgo(3), source: 'device', status: 'normal' },
  { id: 'vr-12', child_id: 'demo-child-2', type: 'oxygen', value: 99, unit: '%', timestamp: hoursAgo(3), source: 'device', status: 'normal' },
]

export const DEMO_SYMPTOM_HISTORY: SymptomEntry[] = [
  {
    id: 'sym-1',
    child_id: 'demo-child-1',
    symptoms: [
      { name: 'Fever', severity: 3, duration_hours: 6, notes: 'Started after daycare' },
      { name: 'Cough', severity: 2, duration_hours: 12 },
      { name: 'Runny Nose', severity: 1, duration_hours: 24 },
    ],
    vitals: { temperature: 101.3, heart_rate: 112, respiratory_rate: 28, oxygen_saturation: 97 },
    timestamp: hoursAgo(1),
    created_at: hoursAgo(1),
  },
  {
    id: 'sym-2',
    child_id: 'demo-child-1',
    symptoms: [
      { name: 'Fever', severity: 3, duration_hours: 2 },
      { name: 'Fatigue', severity: 2 },
    ],
    vitals: { temperature: 102.1, heart_rate: 118 },
    timestamp: hoursAgo(4),
    created_at: hoursAgo(4),
  },
  {
    id: 'sym-3',
    child_id: 'demo-child-1',
    symptoms: [
      { name: 'Cough', severity: 1, duration_hours: 6 },
      { name: 'Congestion', severity: 1 },
    ],
    vitals: { temperature: 99.2 },
    timestamp: hoursAgo(14),
    created_at: hoursAgo(14),
  },
]

export const DEMO_MEDICATIONS: Medication[] = [
  {
    id: 'med-1',
    name: "Children's Tylenol",
    dosage: '160mg/5mL',
    unit: 'mL',
    frequency: 'Every 4-6 hours',
    intervalHours: 4,
    instructions: 'Give with food. Do not exceed 5 doses in 24 hours.',
    color: '#ef4444',
    type: 'acetaminophen',
  },
  {
    id: 'med-2',
    name: "Children's Motrin",
    dosage: '100mg/5mL',
    unit: 'mL',
    frequency: 'Every 6-8 hours',
    intervalHours: 6,
    instructions: 'Give with food. Do not give on empty stomach.',
    color: '#3b82f6',
    type: 'ibuprofen',
  },
  {
    id: 'med-3',
    name: 'Albuterol Inhaler',
    dosage: '90mcg/puff',
    unit: 'puffs',
    frequency: 'As needed',
    intervalHours: 4,
    instructions: '2 puffs via spacer as needed for wheezing',
    color: '#10b981',
  },
]

export const DEMO_DOSE_LOGS: DoseLog[] = [
  {
    id: 'dose-1',
    medicationId: 'med-1',
    medication: "Children's Tylenol",
    medication_name: "Children's Tylenol",
    child_id: 'demo-child-1',
    dosage: '7.5 mL',
    dosage_mg: 240,
    timestamp: hoursAgo(2),
    temperature_before: 102.1,
    notes: 'Given for fever after daycare',
  },
  {
    id: 'dose-2',
    medicationId: 'med-2',
    medication: "Children's Motrin",
    medication_name: "Children's Motrin",
    child_id: 'demo-child-1',
    dosage: '7.5 mL',
    dosage_mg: 150,
    timestamp: hoursAgo(8),
    temperature_before: 100.8,
    notes: 'Alternating with Tylenol',
  },
  {
    id: 'dose-3',
    medicationId: 'med-1',
    medication: "Children's Tylenol",
    medication_name: "Children's Tylenol",
    child_id: 'demo-child-1',
    dosage: '7.5 mL',
    dosage_mg: 240,
    timestamp: hoursAgo(14),
    temperature_before: 99.2,
  },
  {
    id: 'dose-4',
    medicationId: 'med-3',
    medication: 'Albuterol Inhaler',
    medication_name: 'Albuterol Inhaler',
    child_id: 'demo-child-1',
    dosage: '2 puffs',
    timestamp: daysAgo(3),
    notes: 'Mild wheeze after running',
  },
]

export const DEMO_DETECTED_EVENTS: DetectedEvent[] = [
  {
    id: 'evt-1',
    child_id: 'demo-child-1',
    type: 'temperature',
    value: 102.1,
    unit: '°F',
    timestamp: hoursAgo(4),
    source: 'manual',
    device_source: undefined,
    status: 'pending',
    threshold_exceeded: true,
    risk_impact: { current_score: 47, predicted_score_if_confirmed: 62, severity: 'high' },
    suggested_action: {
      title: 'Action',
      message: 'Give antipyretic medication and monitor',
    },
  },
  {
    id: 'evt-2',
    child_id: 'demo-child-1',
    type: 'heart_rate',
    value: 118,
    unit: 'bpm',
    timestamp: hoursAgo(4),
    source: 'device',
    status: 'pending',
    threshold_exceeded: true,
    risk_impact: { current_score: 57, predicted_score_if_confirmed: 62, severity: 'moderate' },
    suggested_action: {
      title: 'Action',
      message: 'Monitor — likely secondary to fever',
    },
  },
]

export const DEMO_RISK_TREND: RiskTrend[] = [
  { score: 25, timestamp: daysAgo(3) },
  { score: 22, timestamp: daysAgo(2) },
  { score: 30, timestamp: daysAgo(1) },
  { score: 47, timestamp: hoursAgo(14) },
  { score: 62, timestamp: hoursAgo(4) },
  { score: 55, timestamp: hoursAgo(2) },
  { score: 48, timestamp: hoursAgo(1) },
]

export const DEMO_ASSESSMENT: Assessment = {
  id: 'assess-1',
  child_id: 'demo-child-1',
  risk_level: 'moderate',
  risk_score: 48,
  factors: [
    { name: 'Fever', contribution: 30, explanation: '101.3°F — elevated but responding to antipyretics' },
    { name: 'Heart Rate', contribution: 15, explanation: '112 bpm — mildly elevated, consistent with fever' },
    { name: 'Respiratory Rate', contribution: 12, explanation: '28/min — slightly elevated for age' },
    { name: 'Cough', contribution: 10, explanation: 'Present ~24 hours, productive' },
    { name: 'Asthma History', contribution: 8, explanation: 'Mild asthma — monitor respiratory status closely' },
    { name: 'Oxygen Saturation', contribution: -5, explanation: '97% — within normal range (protective)' },
  ],
  recommendations: [
    'Continue alternating Tylenol/Motrin every 3-4 hours for fever control',
    'Push fluids — aim for 4-6 oz every hour while awake',
    'Monitor breathing rate and watch for retractions',
    'Contact pediatrician if fever persists >3 days or exceeds 104°F',
    'Watch for signs of respiratory distress given asthma history',
  ],
  created_at: hoursAgo(1),
}

export const DEMO_MOOD_HISTORY: MoodEntry[] = [
  {
    id: 'mood-1',
    child_id: 'demo-child-1',
    timestamp: hoursAgo(2),
    mood_level: 'sad',
    energy_level: 2,
    anxiety_level: 4,
    sleep_quality: 3,
    notes: 'Not feeling well, clingy',
    triggers: ['illness', 'missed school'],
    activities: ['watching TV', 'cuddling'],
  },
  {
    id: 'mood-2',
    child_id: 'demo-child-1',
    timestamp: daysAgo(1),
    mood_level: 'neutral',
    energy_level: 3,
    anxiety_level: 3,
    sleep_quality: 4,
    notes: 'Starting to feel under the weather',
    triggers: [],
    activities: ['coloring', 'reading'],
  },
  {
    id: 'mood-3',
    child_id: 'demo-child-1',
    timestamp: daysAgo(3),
    mood_level: 'happy',
    energy_level: 5,
    anxiety_level: 1,
    sleep_quality: 5,
    notes: 'Great day at daycare!',
    triggers: [],
    activities: ['playground', 'painting'],
  },
]

export const DEMO_JOURNAL: JournalEntry[] = [
  {
    id: 'journal-1',
    child_id: 'demo-child-1',
    timestamp: hoursAgo(3),
    title: 'Sick day observations',
    content: 'Emma woke up with a fever of 102.1°F this morning. Gave Tylenol at 8am, fever came down to 101.3 by 10am. She has a cough and runny nose. Appetite is reduced but drinking water. Staying home from daycare today.',
    mood_before: 'sad',
    mood_after: 'neutral',
    is_private: false,
    tags: ['illness', 'fever', 'observation'],
  },
]

export const DEMO_ANXIETY_ASSESSMENTS: AnxietyAssessmentResult[] = [
  {
    id: 'anx-1',
    child_id: 'demo-child-1',
    assessment_type: 'gad7_child',
    total_score: 6,
    severity: 'mild',
    interpretation: 'Mild anxiety — some worry about being sick and missing friends. Normal response to illness.',
    recommendations: [
      'Reassure that illness is temporary',
      'Maintain comforting routines',
      'Read stories together',
      'Practice simple breathing exercises',
    ],
    timestamp: daysAgo(1),
  },
]

export const DEMO_INSIGHTS: SmartInsight[] = [
  {
    id: 'ins-1',
    type: 'pattern_detected',
    title: 'Fever Responding to Treatment',
    description: "Emma's temperature dropped from 102.1°F to 101.3°F after Tylenol. The antipyretic is working — continue monitoring.",
    priority: 'medium',
    timestamp: hoursAgo(1),
  },
  {
    id: 'ins-2',
    type: 'medication_due',
    title: 'Next Dose Window',
    description: "Children's Motrin can be given in 2 hours if fever returns above 100.4°F. Do not give Tylenol for at least 2 more hours.",
    action_label: 'Open Dosage Calculator',
    action_href: '/dashboard/dosage',
    priority: 'high',
    timestamp: hoursAgo(1),
  },
  {
    id: 'ins-3',
    type: 'recommendation',
    title: 'Cold & Flu Season Alert',
    description: 'RSV and influenza activity is elevated in your area. Emma\'s symptoms are consistent with a viral upper respiratory infection.',
    action_label: 'View Care Guides',
    action_href: '/dashboard/care-advice',
    priority: 'low',
    timestamp: hoursAgo(6),
  },
]
