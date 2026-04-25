'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Phone,
  Clock,
  Home,
  CheckCircle,
  X,
  MapPin,
  Thermometer,
  Activity,
  Brain,
  Eye,
  Ear,
  Wind,
  Heart,
  Droplets,
  Bone,
  Sparkles,
  Info,
  ArrowRight,
  RotateCcw,
  Shield,
  Mic,
  MicOff,
  Zap,
  AlertCircle,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from '@/components/ui'
import useStore from '@/store/useStore'
import { calculateAge, calculateAgeInMonths } from '@/lib/utils'
import { isDemoMode, symptomCheckerApi, type TriageResponse, type SymptomInput } from '@/lib/api'

// Body region icons and mapping
const bodyRegions = [
  { id: 'head', name: 'Head', icon: Brain, position: 'top-[5%] left-1/2 -translate-x-1/2' },
  { id: 'eyes', name: 'Eyes', icon: Eye, position: 'top-[12%] left-[35%]' },
  { id: 'ears', name: 'Ears', icon: Ear, position: 'top-[12%] left-[65%]' },
  { id: 'nose_throat', name: 'Nose & Throat', icon: Wind, position: 'top-[20%] left-1/2 -translate-x-1/2' },
  { id: 'chest', name: 'Chest', icon: Heart, position: 'top-[35%] left-1/2 -translate-x-1/2' },
  { id: 'stomach', name: 'Stomach', icon: Droplets, position: 'top-[50%] left-1/2 -translate-x-1/2' },
  { id: 'skin', name: 'Skin', icon: Shield, position: 'top-[65%] left-[30%]' },
  { id: 'limbs', name: 'Arms & Legs', icon: Bone, position: 'top-[65%] left-[70%]' },
  { id: 'general', name: 'General / Other', icon: Activity, position: 'top-[80%] left-1/2 -translate-x-1/2' },
]

// Enhanced symptom database with age/gender relevance
const symptomDatabase = [
  // Head
  { id: 'headache', name: 'Headache', region: 'head', severity: ['mild', 'moderate', 'severe'], redFlag: false, minAge: 24, aliases: ['head hurts', 'head pain', 'migraine'] },
  { id: 'dizziness', name: 'Dizziness', region: 'head', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['dizzy', 'light headed', 'spinning'] },
  { id: 'confusion', name: 'Confusion', region: 'head', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['confused', 'disoriented', 'acting strange'] },
  // Eyes
  { id: 'eye_pain', name: 'Eye Pain', region: 'eyes', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['eye hurts', 'eyes hurt'] },
  { id: 'eye_redness', name: 'Red Eyes', region: 'eyes', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['pink eye', 'bloodshot'] },
  { id: 'vision_changes', name: 'Vision Changes', region: 'eyes', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['blurry vision', 'cant see', 'seeing spots'] },
  // Ears
  { id: 'ear_pain', name: 'Ear Pain', region: 'ears', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['ear hurts', 'ear ache', 'earache'] },
  { id: 'hearing_loss', name: 'Hearing Loss', region: 'ears', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['cant hear', 'muffled hearing'] },
  // Nose & Throat
  { id: 'sore_throat', name: 'Sore Throat', region: 'nose_throat', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['throat hurts', 'strep', 'scratchy throat'] },
  { id: 'runny_nose', name: 'Runny Nose', region: 'nose_throat', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['runny', 'stuffy nose', 'congestion', 'sniffles'] },
  { id: 'difficulty_swallowing', name: 'Difficulty Swallowing', region: 'nose_throat', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['cant swallow', 'hard to swallow'] },
  { id: 'cough', name: 'Cough', region: 'nose_throat', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['coughing', 'barking cough', 'dry cough', 'wet cough'] },
  // Chest
  { id: 'chest_pain', name: 'Chest Pain', region: 'chest', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['chest hurts', 'heart pain'] },
  { id: 'breathing_difficulty', name: 'Difficulty Breathing', region: 'chest', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['cant breathe', 'hard to breathe', 'shortness of breath', 'labored breathing'] },
  { id: 'wheezing', name: 'Wheezing', region: 'chest', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['wheeze', 'whistling breath', 'asthma'] },
  { id: 'rapid_breathing', name: 'Rapid Breathing', region: 'chest', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['breathing fast', 'hyperventilating'] },
  // Stomach
  { id: 'nausea', name: 'Nausea', region: 'stomach', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['nauseous', 'feels sick', 'queasy'] },
  { id: 'vomiting', name: 'Vomiting', region: 'stomach', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['throwing up', 'puking', 'vomit'] },
  { id: 'diarrhea', name: 'Diarrhea', region: 'stomach', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['loose stool', 'watery stool', 'runs'] },
  { id: 'stomach_pain', name: 'Stomach Pain', region: 'stomach', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['tummy hurts', 'belly ache', 'stomach ache', 'abdominal pain', 'cramps'] },
  { id: 'bloody_stool', name: 'Blood in Stool', region: 'stomach', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['bloody poop', 'blood in poop'] },
  { id: 'constipation', name: 'Constipation', region: 'stomach', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['cant poop', 'hard stool', 'not pooping'] },
  // Age/Gender specific stomach symptoms
  { id: 'menstrual_cramps', name: 'Menstrual Cramps', region: 'stomach', severity: ['mild', 'moderate', 'severe'], redFlag: false, gender: 'Female', minAge: 108, aliases: ['period cramps', 'period pain'] },
  // Skin
  { id: 'rash', name: 'Rash', region: 'skin', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['skin rash', 'red spots', 'bumps'] },
  { id: 'hives', name: 'Hives', region: 'skin', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['welts', 'allergic reaction'] },
  { id: 'petechiae', name: 'Petechiae (tiny red spots)', region: 'skin', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['tiny red dots', 'pinpoint spots'] },
  { id: 'pale_skin', name: 'Pale/Mottled Skin', region: 'skin', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['pale', 'white skin', 'mottled'] },
  { id: 'bee_sting', name: 'Bee/Insect Sting', region: 'skin', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['bee sting', 'wasp sting', 'bug bite', 'insect bite'] },
  { id: 'sunburn', name: 'Sunburn', region: 'skin', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['sun burn', 'burned skin'] },
  // Limbs
  { id: 'limb_pain', name: 'Arm/Leg Pain', region: 'limbs', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['arm hurts', 'leg hurts', 'growing pains'] },
  { id: 'joint_pain', name: 'Joint Pain', region: 'limbs', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['knee hurts', 'ankle hurts', 'wrist hurts'] },
  { id: 'swelling', name: 'Swelling', region: 'limbs', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['swollen', 'puffed up'] },
  { id: 'cant_walk', name: "Can't Walk/Limping", region: 'limbs', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['limping', 'wont walk', 'refuses to walk'] },
  // General
  { id: 'fever', name: 'Fever', region: 'general', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['temperature', 'hot', 'feels warm', 'high temp'] },
  { id: 'fatigue', name: 'Fatigue/Lethargy', region: 'general', severity: ['mild', 'moderate', 'severe'], redFlag: false, aliases: ['tired', 'no energy', 'sleepy', 'lethargic'] },
  { id: 'poor_feeding', name: 'Poor Feeding', region: 'general', severity: ['mild', 'moderate', 'severe'], redFlag: true, maxAge: 24, aliases: ['not eating', 'wont eat', 'refusing bottle'] },
  { id: 'irritability', name: 'Extreme Irritability', region: 'general', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['very fussy', 'inconsolable', 'wont stop crying'] },
  { id: 'unresponsive', name: 'Difficulty Waking/Unresponsive', region: 'general', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['wont wake up', 'hard to wake', 'unresponsive'] },
  { id: 'seizure', name: 'Seizure/Convulsions', region: 'general', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['shaking', 'convulsing', 'fit'] },
  { id: 'dehydration', name: 'Signs of Dehydration', region: 'general', severity: ['mild', 'moderate', 'severe'], redFlag: true, aliases: ['dry mouth', 'no tears', 'not peeing'] },
]

// Context-aware hospital recommendations by region
const regionEmergencyWarnings: Record<string, { warning: string; conditions: string[] }> = {
  chest: {
    warning: 'If blue lips, gasping, or unable to speak, seek medical care immediately',
    conditions: ['breathing_difficulty', 'wheezing', 'rapid_breathing', 'chest_pain'],
  },
  head: {
    warning: 'If unresponsive, severe head injury, or seizure, seek medical care immediately',
    conditions: ['confusion', 'unresponsive'],
  },
  stomach: {
    warning: 'If rigid abdomen, blood in vomit, or severe pain with fever, seek medical care',
    conditions: ['bloody_stool', 'vomiting'],
  },
  skin: {
    warning: 'If throat swelling, difficulty breathing, or spreading rash with fever, seek medical care',
    conditions: ['hives', 'petechiae', 'pale_skin'],
  },
  general: {
    warning: 'If child is unresponsive, having seizures, or lips turning blue, seek medical care',
    conditions: ['unresponsive', 'seizure'],
  },
}

// Quick symptom shortcuts for express lane
const quickSymptomShortcuts = [
  { label: 'Fever', icon: Thermometer, symptomId: 'fever', region: 'general' },
  { label: 'Cough', icon: Wind, symptomId: 'cough', region: 'nose_throat' },
  { label: 'Stomach Pain', icon: Droplets, symptomId: 'stomach_pain', region: 'stomach' },
  { label: 'Ear Pain', icon: Ear, symptomId: 'ear_pain', region: 'ears' },
  { label: 'Sore Throat', icon: Activity, symptomId: 'sore_throat', region: 'nose_throat' },
  { label: 'Rash', icon: Shield, symptomId: 'rash', region: 'skin' },
]

// Triage levels
const triageLevels = {
  call_911: {
    level: 'call_911',
    title: 'Go to Hospital Now',
    subtitle: 'Seek immediate medical attention',
    icon: MapPin,
    color: 'danger',
    bgClass: 'bg-gradient-to-br from-danger-500 to-danger-600',
    textClass: 'text-white',
  },
  call_now: {
    level: 'call_now',
    title: 'Call Your Doctor Now',
    subtitle: 'Needs prompt medical attention',
    icon: Phone,
    color: 'warning',
    bgClass: 'bg-gradient-to-br from-orange-500 to-orange-600',
    textClass: 'text-white',
  },
  call_24hr: {
    level: 'call_24hr',
    title: 'Call Within 24 Hours',
    subtitle: 'Should be seen soon',
    icon: Clock,
    color: 'warning',
    bgClass: 'bg-gradient-to-br from-warning-500 to-warning-600',
    textClass: 'text-white',
  },
  home_care: {
    level: 'home_care',
    title: 'Home Care Appropriate',
    subtitle: 'Monitor and care at home',
    icon: Home,
    color: 'primary',
    bgClass: 'bg-gradient-to-br from-primary-500 to-primary-600',
    textClass: 'text-white',
  },
}

interface SelectedSymptom {
  id: string
  name: string
  severity: string
  duration: string
  notes: string
}

interface TriageResult {
  level: keyof typeof triageLevels
  reasons: string[]
  nextSteps: string[]
}

export default function SymptomCheckerPage() {
  const { selectedChild, vitalReadings, detectedEvents, addVitalReading, addSymptomEntry } = useStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [selectedSymptoms, setSelectedSymptoms] = useState<SelectedSymptom[]>([])
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null)
  const [temperature, setTemperature] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [showContextPrompt, setShowContextPrompt] = useState(false)
  const [contextDismissed, setContextDismissed] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Backend API integration state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [apiTriageResult, setApiTriageResult] = useState<TriageResponse | null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [redFlagsDetected, setRedFlagsDetected] = useState<string[]>([])
  const [immediateEscalation, setImmediateEscalation] = useState(false)

  const steps = [
    { id: 'region', title: 'Select Area', description: 'Where is the problem?' },
    { id: 'symptoms', title: 'Add Symptoms', description: 'What symptoms do you see?' },
    { id: 'details', title: 'Add Details', description: 'Tell us more' },
    { id: 'result', title: 'Results', description: 'What to do next' },
  ]

  // Calculate child's age in months for filtering
  const childAgeMonths = selectedChild
    ? calculateAgeInMonths(selectedChild.date_of_birth)
    : 24
  
  const childGender = selectedChild?.gender || null

  // Check for existing context (fever, alerts from dashboard)
  const existingContext = useMemo(() => {
    if (!selectedChild) return null
    
    // Check for recent temperature readings
    const recentTemp = vitalReadings.find(
      v => v.child_id === selectedChild.id && v.type === 'temperature' && v.value > 100.4
    )
    
    // Check for pending alerts
    const pendingAlerts = detectedEvents.filter(
      e => e.child_id === selectedChild.id && e.status === 'pending'
    )
    
    if (recentTemp) {
      return {
        type: 'fever',
        value: recentTemp.value,
        message: `We noticed ${selectedChild.name} has a fever of ${recentTemp.value}°F`,
        suggestedRegions: ['general', 'head'],
        suggestedSymptoms: ['fever'],
      }
    }
    
    if (pendingAlerts.length > 0) {
      const alert = pendingAlerts[0]
      return {
        type: alert.type,
        value: alert.value,
        message: `${selectedChild.name} has a ${alert.type} alert (${alert.value}${alert.unit})`,
        suggestedRegions: alert.type === 'temperature' ? ['general', 'head'] : ['chest'],
        suggestedSymptoms: alert.type === 'temperature' ? ['fever'] : [],
      }
    }
    
    return null
  }, [selectedChild, vitalReadings, detectedEvents])

  // Show context prompt on mount if context exists
  useEffect(() => {
    if (existingContext && !contextDismissed && currentStep === 0) {
      setShowContextPrompt(true)
      // Pre-fill temperature if fever detected
      if (existingContext.type === 'fever' || existingContext.type === 'temperature') {
        setTemperature(existingContext.value.toString())
      }
    }
  }, [existingContext, contextDismissed, currentStep])

  // Filter symptoms based on age, gender, region, and search
  const filteredSymptoms = useMemo(() => {
    let symptoms = symptomDatabase.filter(s => {
      // Filter by age
      if (s.minAge && childAgeMonths < s.minAge) return false
      if (s.maxAge && childAgeMonths > s.maxAge) return false
      // Filter by gender
      if (s.gender && childGender && s.gender !== childGender) return false
      return true
    })
    
    if (selectedRegion) {
      symptoms = symptoms.filter(s => s.region === selectedRegion)
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      symptoms = symptoms.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.aliases?.some(alias => alias.toLowerCase().includes(query))
      )
    }
    
    return symptoms
  }, [selectedRegion, searchQuery, childAgeMonths, childGender])

  // Voice recognition (simplified - uses Web Speech API if available)
  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in this browser. Try Chrome or Safari.')
      return
    }
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    
    recognition.onstart = () => setIsListening(true)
    
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('')
      setVoiceTranscript(transcript)
      setSearchQuery(transcript)
      
      // Auto-match symptoms from voice input
      const matchedSymptoms = symptomDatabase.filter(s => {
        const lowerTranscript = transcript.toLowerCase()
        return s.name.toLowerCase().includes(lowerTranscript) ||
               s.aliases?.some(alias => lowerTranscript.includes(alias.toLowerCase()))
      })
      
      if (matchedSymptoms.length > 0 && event.results[0].isFinal) {
        // Auto-select matched symptoms
        matchedSymptoms.forEach(symptom => {
          if (!selectedSymptoms.find(s => s.id === symptom.id)) {
            handleSymptomToggle(symptom.id, symptom.name)
          }
          setSelectedRegion(symptom.region)
        })
        // Jump to symptoms step if we found matches
        if (currentStep === 0) {
          setCurrentStep(1)
        }
      }
    }
    
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    
    recognition.start()
  }

  // Handle context prompt actions
  const handleContextYes = () => {
    if (existingContext) {
      // Auto-select suggested regions and symptoms
      if (existingContext.suggestedRegions.length > 0) {
        setSelectedRegion(existingContext.suggestedRegions[0])
      }
      existingContext.suggestedSymptoms.forEach(symptomId => {
        const symptom = symptomDatabase.find(s => s.id === symptomId)
        if (symptom && !selectedSymptoms.find(s => s.id === symptomId)) {
          handleSymptomToggle(symptomId, symptom.name)
        }
      })
      setShowContextPrompt(false)
      setCurrentStep(1) // Skip to symptoms
    }
  }

  const handleContextNo = () => {
    setShowContextPrompt(false)
    setContextDismissed(true)
  }

  // Quick symptom shortcut handler
  const handleQuickSymptom = (symptomId: string, region: string) => {
    const symptom = symptomDatabase.find(s => s.id === symptomId)
    if (symptom) {
      setSelectedRegion(region)
      if (!selectedSymptoms.find(s => s.id === symptomId)) {
        handleSymptomToggle(symptomId, symptom.name)
      }
      setCurrentStep(1)
    }
  }

  // Get dynamic emergency warning for selected region
  const getDynamicWarning = () => {
    if (!selectedRegion || !regionEmergencyWarnings[selectedRegion]) {
      return null
    }
    return regionEmergencyWarnings[selectedRegion]
  }

  const calculateTriage = (): TriageResult => {
    const reasons: string[] = []
    const nextSteps: string[] = []
    let level: keyof typeof triageLevels = 'home_care'

    // Check for critical symptoms
    const hasRedFlag = selectedSymptoms.some(s => {
      const symptom = symptomDatabase.find(db => db.id === s.id)
      return symptom?.redFlag && s.severity === 'severe'
    })

    const hasSevereSymptom = selectedSymptoms.some(s => s.severity === 'severe')
    const hasBreathingIssue = selectedSymptoms.some(s => 
      ['breathing_difficulty', 'rapid_breathing', 'wheezing'].includes(s.id) && s.severity !== 'mild'
    )
    const hasUnresponsive = selectedSymptoms.some(s => s.id === 'unresponsive')

    // Age-based fever rules
    const tempValue = parseFloat(temperature)
    const hasHighFever = tempValue >= 104
    const hasInfantFever = childAgeMonths < 3 && tempValue >= 100.4

    if (hasUnresponsive || hasBreathingIssue || (hasRedFlag && hasSevereSymptom)) {
      level = 'call_911'
      reasons.push('Symptoms indicate a potential emergency')
      if (hasUnresponsive) reasons.push('Child is unresponsive or difficult to wake')
      if (hasBreathingIssue) reasons.push('Significant breathing difficulty')
      nextSteps.push('Go to the nearest Emergency Room immediately')
      nextSteps.push('Do not give food or drink')
      nextSteps.push('Keep child calm and still')
    } else if (hasInfantFever) {
      level = 'call_911'
      reasons.push('Any fever in a baby under 3 months requires immediate evaluation')
      nextSteps.push('Call 911 or go to emergency room immediately')
      nextSteps.push('Do not give fever medication without doctor guidance')
    } else if (hasHighFever || hasRedFlag) {
      level = 'call_now'
      if (hasHighFever) reasons.push('Temperature is 104°F or higher')
      if (hasRedFlag) reasons.push('Symptom combination needs prompt evaluation')
      nextSteps.push('Call your pediatrician now')
      nextSteps.push('If unable to reach, go to urgent care')
    } else if (hasSevereSymptom || tempValue >= 102) {
      level = 'call_24hr'
      reasons.push('Symptoms should be evaluated within 24 hours')
      nextSteps.push('Schedule appointment with pediatrician')
      nextSteps.push('Monitor for worsening symptoms')
      nextSteps.push('Give age-appropriate fever medication if needed')
    } else {
      level = 'home_care'
      reasons.push('Symptoms can be safely managed at home')
      nextSteps.push('Rest and adequate fluids')
      nextSteps.push('Monitor symptoms for changes')
      nextSteps.push('Use the Care Guides for specific advice')
    }

    return { level, reasons, nextSteps }
  }

  const handleSymptomToggle = (symptomId: string, symptomName: string) => {
    if (selectedSymptoms.find(s => s.id === symptomId)) {
      setSelectedSymptoms(selectedSymptoms.filter(s => s.id !== symptomId))
    } else {
      setSelectedSymptoms([...selectedSymptoms, {
        id: symptomId,
        name: symptomName,
        severity: 'moderate',
        duration: '',
        notes: '',
      }])
    }
  }

  const handleSymptomUpdate = (symptomId: string, field: keyof SelectedSymptom, value: string) => {
    setSelectedSymptoms(selectedSymptoms.map(s =>
      s.id === symptomId ? { ...s, [field]: value } : s
    ))
  }

  // Start API session when beginning assessment
  const startApiSession = async () => {
    if (isDemoMode() || !selectedChild) return
    
    try {
      const response = await symptomCheckerApi.start(
        selectedChild.id,
        childAgeMonths,
        (selectedChild.gender?.toLowerCase() === 'female' ? 'female' : 'male')
      )
      setSessionId(response.session_id)
      
      // Show any age-specific warnings from API
      if (response.warnings && response.warnings.length > 0) {
        setRedFlagsDetected(response.warnings)
      }
    } catch (error) {
      console.error('Failed to start symptom checker session:', error)
      // Continue without API - will use local calculation
    }
  }
  
  // Add symptoms to API session
  const addSymptomsToSession = async () => {
    if (!sessionId || selectedSymptoms.length === 0) return
    
    try {
      const apiSymptoms: SymptomInput[] = selectedSymptoms.map(s => ({
        symptom_id: s.id,
        name: s.name,
        severity: s.severity as 'mild' | 'moderate' | 'severe',
        duration: s.duration || 'unknown',
        notes: s.notes || undefined,
      }))
      
      const response = await symptomCheckerApi.addSymptoms(sessionId, apiSymptoms)
      
      if (response.red_flags_detected.length > 0) {
        setRedFlagsDetected(prev => Array.from(new Set([...prev, ...response.red_flags_detected])))
      }
      
      if (response.immediate_escalation) {
        setImmediateEscalation(true)
      }
    } catch (error) {
      console.error('Failed to add symptoms to session:', error)
    }
  }
  
  // Get triage from API
  const getApiTriage = async () => {
    if (!sessionId) return null
    
    setApiLoading(true)
    setApiError(null)
    
    try {
      const response = await symptomCheckerApi.getTriage(sessionId, {
        temperature: temperature ? parseFloat(temperature) : undefined,
      })
      setApiTriageResult(response)
      return response
    } catch (error) {
      console.error('Failed to get triage:', error)
      setApiError('Could not get triage from server. Using local assessment.')
      return null
    } finally {
      setApiLoading(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === 0 && !sessionId) {
      // Start API session when moving past region selection
      startApiSession()
    }
    
    if (currentStep === 1) {
      // Add symptoms to API session
      await addSymptomsToSession()
    }
    
    if (currentStep === 2) {
      // Calculate local triage first
      setTriageResult(calculateTriage())
      
      // Try to get API triage if we have a session
      if (sessionId && !isDemoMode()) {
        await getApiTriage()
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const handleReset = () => {
    setCurrentStep(0)
    setSelectedRegion(null)
    setSelectedSymptoms([])
    setTriageResult(null)
    setSearchQuery('')
    setTemperature('')
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedRegion !== null
      case 1: return selectedSymptoms.length > 0
      case 2: return true
      default: return false
    }
  }

  const triage = triageResult ? triageLevels[triageResult.level] : null

  const dynamicWarning = getDynamicWarning()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Context-Aware Prompt */}
      <AnimatePresence>
        {showContextPrompt && existingContext && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-2 border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-cyan-100 dark:bg-cyan-900/50">
                    <Sparkles className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-cyan-800 dark:text-cyan-200 mb-1">
                      Smart Context Detected
                    </h3>
                    <p className="text-cyan-700 dark:text-cyan-300 mb-3">
                      {existingContext.message}. Are you checking symptoms related to this?
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleContextYes}>
                        Yes, Continue with This
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleContextNo}>
                        No, Start Fresh
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Warning */}
      {dynamicWarning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-2xl border bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/50">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {dynamicWarning.warning}
            </p>
          </div>
        </motion.div>
      )}

      {/* Progress Steps */}
      <Card padding="sm">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all
                  ${index < currentStep 
                    ? 'bg-primary-500 text-white' 
                    : index === currentStep
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                  }
                `}>
                  {index < currentStep ? <CheckCircle className="w-5 h-5" /> : index + 1}
                </div>
                <div className="mt-2 text-center hidden sm:block">
                  <div className={`text-xs font-medium ${index <= currentStep ? 'text-surface-900 dark:text-white' : 'text-surface-600 dark:text-surface-400'}`}>
                    {step.title}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 ${index < currentStep ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-700'}`} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 0: Select Body Region */}
          {currentStep === 0 && (
            <div className="space-y-4">
              {/* Express Lane - Voice & Search */}
              <Card className="border-2 border-dashed border-cyan-300 dark:border-cyan-700 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    <h3 className="font-semibold text-cyan-800 dark:text-cyan-200">Express Lane</h3>
                    <span className="text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/50 px-2 py-0.5 rounded-full">
                      Skip steps
                    </span>
                  </div>
                  
                  {/* Voice & Search Input */}
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 relative">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={isListening ? 'Listening...' : 'Type or say "fever" "ear pain" "bee sting"...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-surface-800 border-2 transition-all outline-none ${
                          isListening 
                            ? 'border-cyan-500 ring-2 ring-cyan-200 dark:ring-cyan-800' 
                            : 'border-surface-200 dark:border-surface-700 focus:border-cyan-500'
                        }`}
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </div>
                    <button
                      onClick={startVoiceInput}
                      disabled={isListening}
                      className={`p-3 rounded-xl transition-all ${
                        isListening 
                          ? 'bg-cyan-500 text-white animate-pulse' 
                          : 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300'
                      }`}
                    >
                      {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {/* Voice transcript display */}
                  {voiceTranscript && (
                    <p className="text-sm text-cyan-700 dark:text-cyan-300 mb-3 italic">
                      Heard: "{voiceTranscript}"
                    </p>
                  )}
                  
                  {/* Quick symptom shortcuts */}
                  <div className="flex flex-wrap gap-2">
                    {quickSymptomShortcuts.map((shortcut) => (
                      <button
                        key={shortcut.symptomId}
                        onClick={() => handleQuickSymptom(shortcut.symptomId, shortcut.region)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-cyan-400 dark:hover:border-cyan-600 transition-colors text-sm"
                      >
                        <shortcut.icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-surface-700 dark:text-surface-300">{shortcut.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Body Region Selector */}
              <Card>
                <CardHeader>
                  <CardTitle>Or select the affected area</CardTitle>
                  <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    Where is {selectedChild?.name || 'your child'} experiencing symptoms?
                    {selectedChild && (
                      <span className="ml-2 text-cyan-600 dark:text-cyan-400">
                        (Showing symptoms relevant for {calculateAge(selectedChild.date_of_birth)}yo {selectedChild.gender || 'child'})
                      </span>
                    )}
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Visual Body Map */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Simplified Body Silhouette */}
                    <div className="relative bg-surface-50 dark:bg-surface-800/50 rounded-2xl p-6 min-h-[400px] hidden md:block">
                      <div className="absolute inset-0 flex items-center justify-center">
                        {/* Simple body outline SVG */}
                        <svg viewBox="0 0 100 200" className="h-full max-h-[350px] opacity-20">
                          <ellipse cx="50" cy="25" rx="15" ry="20" fill="currentColor" className="text-surface-600 dark:text-surface-400" />
                          <rect x="35" y="45" width="30" height="50" rx="5" fill="currentColor" className="text-surface-600 dark:text-surface-400" />
                          <rect x="20" y="50" width="10" height="40" rx="3" fill="currentColor" className="text-surface-600 dark:text-surface-400" />
                          <rect x="70" y="50" width="10" height="40" rx="3" fill="currentColor" className="text-surface-600 dark:text-surface-400" />
                          <rect x="37" y="95" width="10" height="50" rx="3" fill="currentColor" className="text-surface-600 dark:text-surface-400" />
                          <rect x="53" y="95" width="10" height="50" rx="3" fill="currentColor" className="text-surface-600 dark:text-surface-400" />
                        </svg>
                      </div>
                      
                      {/* Clickable regions overlaid on body */}
                      {bodyRegions.map((region) => (
                        <button
                          key={region.id}
                          onClick={() => setSelectedRegion(region.id)}
                          className={`absolute ${region.position} transform transition-all ${
                            selectedRegion === region.id 
                              ? 'scale-110 z-10' 
                              : 'hover:scale-105'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
                            selectedRegion === region.id
                              ? 'bg-cyan-500 text-white ring-4 ring-cyan-200 dark:ring-cyan-800'
                              : 'bg-white dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50'
                          }`}>
                            <region.icon className="w-5 h-5" />
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    {/* Grid selector (always visible on mobile, sidebar on desktop) */}
                    <div className="grid grid-cols-3 gap-3 content-start">
                      {bodyRegions.map((region) => (
                        <motion.button
                          key={region.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedRegion(region.id)}
                          className={`
                            p-3 rounded-xl border-2 transition-all text-center
                            ${selectedRegion === region.id
                              ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30'
                              : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 bg-white dark:bg-surface-800'
                            }
                          `}
                        >
                          <div className={`
                            w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2
                            ${selectedRegion === region.id
                              ? 'bg-cyan-100 dark:bg-cyan-900/50'
                              : 'bg-surface-100 dark:bg-surface-700'
                            }
                          `}>
                            <region.icon className={`w-5 h-5 ${selectedRegion === region.id ? 'text-cyan-600 dark:text-cyan-400' : 'text-surface-500'}`} />
                          </div>
                          <div className={`text-sm font-medium ${selectedRegion === region.id ? 'text-cyan-700 dark:text-cyan-300' : 'text-surface-700 dark:text-surface-300'}`}>
                            {region.name}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 1: Select Symptoms */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Symptoms</CardTitle>
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                  Choose all symptoms that apply. Tap to select.
                </p>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <Input
                    icon={Search}
                    placeholder="Search symptoms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    variant="filled"
                  />
                </div>

                {/* Region filter chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setSelectedRegion(null)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      !selectedRegion 
                        ? 'bg-primary-500 text-white' 
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                    }`}
                  >
                    All
                  </button>
                  {bodyRegions.map((region) => (
                    <button
                      key={region.id}
                      onClick={() => setSelectedRegion(region.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedRegion === region.id
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                      }`}
                    >
                      {region.name}
                    </button>
                  ))}
                </div>

                {/* Symptoms grid */}
                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto p-1">
                  {filteredSymptoms.map((symptom) => {
                    const isSelected = selectedSymptoms.some(s => s.id === symptom.id)
                    return (
                      <motion.button
                        key={symptom.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleSymptomToggle(symptom.id, symptom.name)}
                        className={`
                          p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3
                          ${isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                            : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                          }
                        `}
                      >
                        <div className={`
                          w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
                          ${isSelected
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-surface-300 dark:border-surface-600'
                          }
                        `}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300'}`}>
                            {symptom.name}
                          </div>
                          {symptom.redFlag && (
                            <Badge variant="danger" size="sm" className="mt-1">Warning sign</Badge>
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>

                {/* Selected symptoms summary */}
                {selectedSymptoms.length > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                    <div className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      Selected ({selectedSymptoms.length}):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedSymptoms.map((s) => (
                        <Badge key={s.id} variant="primary" className="flex items-center gap-1">
                          {s.name}
                          <button onClick={() => handleSymptomToggle(s.id, s.name)}>
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Symptom Details */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Add Details</CardTitle>
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                  Help us understand the severity and duration
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Temperature */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/50 flex items-center justify-center">
                      <Thermometer className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                    </div>
                    <div>
                      <div className="font-medium text-surface-900 dark:text-white">Temperature (optional)</div>
                      <div className="text-xs text-surface-500">Enter if you have taken it</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g., 101.5"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-700 focus:border-primary-500 outline-none text-surface-900 dark:text-white"
                    />
                    <span className="text-surface-500 font-medium">°F</span>
                  </div>
                </div>

                {/* Symptom severity */}
                {selectedSymptoms.map((symptom) => (
                  <div key={symptom.id} className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                    <div className="font-medium text-surface-900 dark:text-white mb-3">{symptom.name}</div>
                    
                    <div className="mb-3">
                      <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block">Severity</label>
                      <div className="flex gap-2">
                        {['mild', 'moderate', 'severe'].map((sev) => (
                          <button
                            key={sev}
                            onClick={() => handleSymptomUpdate(symptom.id, 'severity', sev)}
                            className={`
                              flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors
                              ${symptom.severity === sev
                                ? sev === 'severe'
                                  ? 'bg-danger-500 text-white'
                                  : sev === 'moderate'
                                    ? 'bg-warning-500 text-white'
                                    : 'bg-primary-500 text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                              }
                            `}
                          >
                            {sev}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block">Duration</label>
                      <select
                        value={symptom.duration}
                        onChange={(e) => handleSymptomUpdate(symptom.id, 'duration', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-700 focus:border-primary-500 outline-none text-surface-900 dark:text-white"
                      >
                        <option value="">Select duration</option>
                        <option value="hours">Less than a day</option>
                        <option value="1day">1 day</option>
                        <option value="2-3days">2-3 days</option>
                        <option value="4-7days">4-7 days</option>
                        <option value="1week+">More than a week</option>
                      </select>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Results */}
          {currentStep === 3 && triageResult && triage && (
            <div className="space-y-4">
              {/* Triage Result Card */}
              <Card className={`${triage.bgClass} border-0`} padding="lg">
                <div className="text-center text-white">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                    <triage.icon className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{triage.title}</h2>
                  <p className="text-white/80">{triage.subtitle}</p>
                </div>
              </Card>

              {/* Emergency Actions */}
              {triageResult.level === 'call_911' && (
                <div className="flex gap-3">
                  <a href="tel:911" className="flex-1">
                    <Button variant="danger" size="lg" fullWidth icon={<Phone className="w-5 h-5" />}>
                      Call 911 Now
                    </Button>
                  </a>
                  <a
                    href="https://www.google.com/maps/search/emergency+room+near+me"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="secondary" size="lg" fullWidth icon={<MapPin className="w-5 h-5" />}>
                      Find ER
                    </Button>
                  </a>
                </div>
              )}

              {/* Red Flags Alert */}
              {redFlagsDetected.length > 0 && (
                <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <AlertTriangle className="w-5 h-5" />
                      Important Clinical Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {redFlagsDetected.map((flag, i) => (
                        <li key={i} className="flex items-start gap-3 text-red-700 dark:text-red-300">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-1" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              
              {/* API Enhanced Results */}
              {apiTriageResult && (
                <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-violet-900 dark:text-violet-100">
                        <Shield className="w-5 h-5" />
                        Clinical Assessment
                      </CardTitle>
                      <Badge className="bg-violet-500 text-white text-xs">
                        AI-Verified • {Math.round(apiTriageResult.confidence * 100)}% confidence
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-lg bg-white dark:bg-surface-900">
                      <p className="text-sm font-medium text-surface-900 dark:text-white mb-2">
                        {apiTriageResult.triage.description}
                      </p>
                      {apiTriageResult.triage.warning_signs_to_watch.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Warning Signs to Watch:</p>
                          <ul className="text-xs text-surface-600 dark:text-surface-400 space-y-1">
                            {apiTriageResult.triage.warning_signs_to_watch.slice(0, 3).map((sign, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                                {sign}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* API Error Notice */}
              {apiError && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">{apiError}</p>
                </div>
              )}

              {/* Reasons */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-accent-500" />
                    Why This Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(apiTriageResult?.triage.reasons || triageResult.reasons).map((reason, i) => (
                      <li key={i} className="flex items-start gap-3 text-surface-700 dark:text-surface-300">
                        <ChevronRight className="w-4 h-4 text-primary-500 mt-1 flex-shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Next Steps */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary-500" />
                    Next Steps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(apiTriageResult?.triage.recommendations || triageResult.nextSteps).map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{i + 1}</span>
                        </div>
                        <span className="text-surface-700 dark:text-surface-300">{step}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Start Over */}
              <Button variant="secondary" fullWidth onClick={handleReset} icon={<RotateCcw className="w-4 h-4" />}>
                Start New Check
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {currentStep < 3 && (
        <div className="flex justify-between gap-4">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={currentStep === 0 || apiLoading}
            icon={<ChevronLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || apiLoading}
            icon={apiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            iconPosition="right"
          >
            {apiLoading ? 'Analyzing...' : currentStep === 2 ? 'Get Results' : 'Continue'}
          </Button>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-center text-surface-500 dark:text-surface-400">
        This tool provides general guidance only and is not a substitute for professional medical advice. 
        Always consult a healthcare provider for medical concerns.
      </p>
    </div>
  )
}
