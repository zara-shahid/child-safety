'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Thermometer,
  Wind,
  Droplets,
  AlertTriangle,
  Phone,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Shield,
  Home,
  Stethoscope,
  Ear,
  Search,
  Zap,
  Calculator,
  Plus,
  Clock,
  Scale,
  Baby,
  User,
  AlertCircle,
  Pill,
  Activity,
  X,
  Star,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore, { type VitalReading, type SymptomEntry } from '@/store/useStore'
import { calculateAge, calculateAgeInMonths } from '@/lib/utils'
import Link from 'next/link'

// Emergency "Red Flag" keywords that should trigger safety intercept
const EMERGENCY_KEYWORDS = [
  'not breathing', 'can\'t breathe', 'choking', 'blue lips', 'blue face',
  'seizure', 'convulsion', 'unconscious', 'unresponsive', 'won\'t wake',
  'stiff neck', 'purple spots', 'red spots', 'meningitis', 'anaphylaxis',
  'severe allergic', 'swelling throat', 'head injury', 'not moving',
  'limp', 'floppy', 'lethargic', 'drowning', 'poisoning', 'overdose',
  'severe pain', 'screaming in pain', 'bloody stool', 'bloody vomit',
  'fontanelle bulging', 'sunken fontanelle',
]

// Age-specific content adaptations
interface AgeAdaptation {
  minMonths: number
  maxMonths: number
  content: string
  dosing?: string
}

// Care guides data with age-specific adaptations
const careGuides = [
  {
    id: 'fever',
    title: 'Fever',
    icon: Thermometer,
    color: 'red',
    keywords: ['fever', 'temperature', 'hot', 'warm', 'burning up'],
    summary: "Fever is the body's natural response to infection. Most fevers resolve on their own.",
    // Age-specific summaries
    ageAdaptations: [
      { minMonths: 0, maxMonths: 3, content: "ANY fever in a baby under 3 months is a medical emergency. Call your doctor immediately or go to the ER.", dosing: "Do NOT give fever medication without doctor approval" },
      { minMonths: 3, maxMonths: 6, content: "Fever in infants 3-6 months needs close monitoring. Call your doctor if fever reaches 101°F (38.3°C).", dosing: "Acetaminophen only if approved by doctor" },
      { minMonths: 6, maxMonths: 24, content: "Toddlers can tolerate most fevers well. Focus on comfort and hydration. Treat if uncomfortable or >102°F.", dosing: "Acetaminophen: ~10-15mg/kg every 4-6h. Ibuprofen: ~5-10mg/kg every 6-8h" },
      { minMonths: 24, maxMonths: 72, content: "Preschoolers often run higher fevers than adults. The number matters less than how the child looks and acts.", dosing: "Acetaminophen or Ibuprofen per weight. Can alternate if needed." },
      { minMonths: 72, maxMonths: 144, content: "School-age children can describe their symptoms. Treat fever if uncomfortable or >102°F.", dosing: "Weight-based dosing applies. Check medication label." },
      { minMonths: 144, maxMonths: 216, content: "Pre-teens and teens can follow adult fever guidelines. Treat if uncomfortable or >102°F.", dosing: "Adult dosing may apply for larger teens. Maximum adult dose limits apply." },
    ],
    emergencyCare: [
      'Fever in infant under 3 months old (any fever)',
      'Child is unresponsive or very hard to wake',
      'Child has difficulty breathing',
      'Child has a seizure',
      'Purple or red spots that don\'t fade with pressure',
    ],
    callNow: [
      'Fever above 104°F (40°C)',
      'Fever in infant 3-6 months above 101°F',
      'Child looks very sick or unusually drowsy',
      'Stiff neck or severe headache',
      'No wet diapers for 8+ hours',
    ],
    call24Hours: [
      'Fever lasting more than 3 days',
      'Child has ear pain or sore throat',
      'Child is not drinking well',
      'Fever went away then came back',
    ],
    homeCare: [
      'Keep child comfortable with light clothing',
      'Encourage plenty of fluids',
      'Let them rest',
      'Use acetaminophen or ibuprofen if over 6 months',
      'Monitor temperature every 4-6 hours',
    ],
    doNot: [
      'Give aspirin to children',
      'Use rubbing alcohol baths',
      'Bundle up a child with fever',
      'Wake a sleeping child just for medicine',
    ],
    actionWidgets: ['logTemp', 'calculateDose', 'setReminder'],
  },
  {
    id: 'cough_cold',
    title: 'Cough & Cold',
    icon: Wind,
    color: 'blue',
    keywords: ['cough', 'cold', 'runny nose', 'congestion', 'stuffy', 'sneezing', 'sore throat'],
    summary: 'Most coughs and colds are viral and get better in 7-10 days. Antibiotics don\'t help viruses.',
    ageAdaptations: [
      { minMonths: 0, maxMonths: 3, content: "Cold symptoms in newborns can be serious. Any breathing difficulty or fever needs immediate attention.", dosing: "No medications - use saline drops and bulb suction only" },
      { minMonths: 3, maxMonths: 12, content: "Infants are obligate nose breathers. Congestion can interfere with feeding and sleep.", dosing: "Saline drops + suction. NO cough/cold medicine." },
      { minMonths: 12, maxMonths: 24, content: "Toddlers get 8-10 colds per year. Focus on comfort measures.", dosing: "Honey (1/2 tsp for cough - over 1 year ONLY). No OTC cough meds." },
      { minMonths: 24, maxMonths: 72, content: "Preschoolers can gargle salt water and use a humidifier.", dosing: "Honey for cough. OTC meds only if over 4-6 years per product label." },
      { minMonths: 72, maxMonths: 216, content: "Older children can use OTC cold medicines per label directions. Focus on rest and hydration.", dosing: "Follow package directions by weight/age. Stay under max daily dose." },
    ],
    emergencyCare: [
      'Severe difficulty breathing',
      'Lips or face turning blue',
      'Grunting with each breath',
      'Child is unresponsive',
    ],
    callNow: [
      'Breathing very fast or working hard to breathe',
      'Nostrils flaring or ribs showing with each breath',
      'Cannot speak or cry normally',
      'Barking cough with stridor not improving with steam',
      'Drooling and unable to swallow',
    ],
    call24Hours: [
      'Cough lasting more than 2 weeks',
      'Cough with fever over 3 days',
      'Wheezing',
      'Ear pain',
      'Yellow/green discharge for more than 10 days',
    ],
    homeCare: [
      'Rest and plenty of fluids',
      'Use a cool-mist humidifier',
      'Saline nose drops for congestion',
      'Honey for cough (over 1 year only)',
      'Elevate head slightly for sleep',
    ],
    doNot: [
      'Give cough medicine to children under 6',
      'Give honey to infants under 1 year',
      'Use menthol rubs on infants under 2',
    ],
    actionWidgets: ['logSymptom'],
  },
  {
    id: 'vomiting_diarrhea',
    title: 'Vomiting & Diarrhea',
    icon: Droplets,
    color: 'green',
    keywords: ['vomiting', 'diarrhea', 'stomach', 'throwing up', 'nausea', 'dehydration', 'stomach flu'],
    summary: 'Usually caused by stomach virus. Key is preventing dehydration by replacing fluids.',
    ageAdaptations: [
      { minMonths: 0, maxMonths: 3, content: "Newborns dehydrate quickly. Any vomiting or diarrhea needs immediate medical evaluation.", dosing: "Continue breastfeeding/formula. Seek care promptly." },
      { minMonths: 3, maxMonths: 12, content: "Infants are at high risk for dehydration. Watch for wet diapers and tears.", dosing: "Pedialyte or oral rehydration solution. Small amounts frequently." },
      { minMonths: 12, maxMonths: 72, content: "Toddlers/preschoolers often recover within 24-48 hours. Push clear fluids.", dosing: "Pedialyte, diluted juice, popsicles. Avoid dairy initially." },
      { minMonths: 72, maxMonths: 216, content: "Older children can often manage at home with fluids and rest. Watch for dehydration signs.", dosing: "Clear fluids, BRAT diet (bananas, rice, applesauce, toast) as tolerated." },
    ],
    emergencyCare: [
      'Blood in vomit (red or coffee grounds)',
      'Bright green (bile) vomit',
      'Child is unresponsive',
      'Severe abdominal pain',
      'Signs of severe dehydration',
    ],
    callNow: [
      'Blood in stool',
      'Vomiting 24+ hours (under 2 years) or 48+ hours (older)',
      'No wet diaper for 8 hours',
      'Refuses all fluids',
      'Projectile vomiting in infant under 3 months',
    ],
    call24Hours: [
      'Diarrhea lasting more than 1 week',
      'Vomiting lasting more than 2-3 days',
      'Fever with symptoms over 3 days',
      'Signs of mild dehydration',
    ],
    homeCare: [
      'Give small amounts of fluids frequently',
      'Use oral rehydration solution (Pedialyte)',
      'Continue breastfeeding if applicable',
      'Restart regular diet as tolerated',
      'Avoid sugary drinks and full-strength juice',
    ],
    doNot: [
      'Give anti-diarrhea medication to children',
      'Force large amounts of fluid at once',
      'Use sports drinks for young children',
    ],
    actionWidgets: ['calculateFluids', 'logSymptom'],
  },
  {
    id: 'ear_pain',
    title: 'Ear Pain',
    icon: Ear,
    color: 'purple',
    keywords: ['ear pain', 'ear infection', 'ear ache', 'pulling ear', 'ear discharge'],
    summary: 'Common in children, often caused by ear infections or fluid buildup.',
    ageAdaptations: [
      { minMonths: 0, maxMonths: 24, content: "Ear infections are very common in infants/toddlers due to anatomy. Watch for fever, irritability, and ear pulling.", dosing: "Acetaminophen or Ibuprofen for pain per weight." },
      { minMonths: 24, maxMonths: 72, content: "Preschoolers can start to verbalize ear pain. Most ear infections resolve without antibiotics.", dosing: "Pain relief per weight. Antibiotics only if doctor prescribes." },
      { minMonths: 72, maxMonths: 216, content: "Older children get fewer ear infections. Consider swimmer's ear if recent swimming.", dosing: "OTC pain relief. Warm compress for comfort." },
    ],
    emergencyCare: [
      'Ear pain with stiff neck and high fever',
      'Child is unresponsive',
    ],
    callNow: [
      'Severe ear pain',
      'Facial weakness or drooping',
      'Bloody or pus discharge from ear',
      'Swelling behind the ear',
    ],
    call24Hours: [
      'Ear pain lasting more than 2 days',
      'Ear pain with fever',
      'Pain not relieved by medicine',
      'Clear fluid draining from ear',
    ],
    homeCare: [
      'Acetaminophen or ibuprofen for pain',
      'Warm compress on the ear',
      'Elevate head while sleeping',
      'Distraction and comfort',
    ],
    doNot: [
      'Put anything in the ear unless directed by doctor',
      'Fly if possible during acute infection',
    ],
    actionWidgets: ['calculateDose', 'logSymptom'],
  },
]

const emergencySigns = [
  'Child is not breathing or struggling to breathe',
  'Child is unresponsive or very hard to wake',
  'Child is having a seizure',
  'Purple or red spots that don\'t fade with pressure',
  'Severe allergic reaction with difficulty breathing',
  'Severe bleeding that won\'t stop',
  'Serious injury (head injury with loss of consciousness)',
]

export default function CareAdvicePage() {
  const { selectedChild, vitalReadings, symptomHistory, addVitalReading, addSymptomEntry } = useStore()
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showEmergencyIntercept, setShowEmergencyIntercept] = useState(false)
  const [interceptedQuery, setInterceptedQuery] = useState('')
  const [showLogTemp, setShowLogTemp] = useState(false)
  const [newTemp, setNewTemp] = useState('')
  const [showDoseCalculator, setShowDoseCalculator] = useState(false)
  
  // Get child's age in months for content adaptation
  const childAgeMonths = useMemo(() => {
    if (!selectedChild?.date_of_birth) return 72 // Default to 6 years
    return calculateAgeInMonths(selectedChild.date_of_birth)
  }, [selectedChild])
  
  const childAgeYears = useMemo(() => {
    if (!selectedChild?.date_of_birth) return 6
    return calculateAge(selectedChild.date_of_birth)
  }, [selectedChild])
  
  // Get current symptoms/vitals for contextual highlighting
  const currentConditions = useMemo(() => {
    const conditions: string[] = []
    
    // Check for recent fever
    const recentTemp = vitalReadings
      .filter((v: VitalReading) => v.child_id === selectedChild?.id && v.type === 'temperature')
      .filter((v: VitalReading) => Date.now() - new Date(v.timestamp).getTime() < 24 * 60 * 60 * 1000)
      .sort((a: VitalReading, b: VitalReading) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    
    if (recentTemp && (recentTemp.value as number) >= 100.4) {
      conditions.push('fever')
    }
    
    // Check recent symptoms
    const recentSymptoms = symptomHistory
      .filter((s: SymptomEntry) => s.child_id === selectedChild?.id)
      .filter((s: SymptomEntry) => Date.now() - new Date(s.timestamp || s.created_at).getTime() < 48 * 60 * 60 * 1000)
    
    recentSymptoms.forEach((s: SymptomEntry) => {
      // Handle both single symptom string and symptoms array
      const symptomNames = s.symptoms?.map(sym => sym.name.toLowerCase()).join(' ') || ''
      const symptomLower = symptomNames
      if (symptomLower.includes('cough') || symptomLower.includes('cold') || symptomLower.includes('congestion')) {
        conditions.push('cough_cold')
      }
      if (symptomLower.includes('vomit') || symptomLower.includes('diarrhea') || symptomLower.includes('nausea')) {
        conditions.push('vomiting_diarrhea')
      }
      if (symptomLower.includes('ear')) {
        conditions.push('ear_pain')
      }
    })
    
    return Array.from(new Set(conditions))
  }, [vitalReadings, symptomHistory, selectedChild])
  
  // Check for emergency keywords in search
  const checkForEmergency = (query: string) => {
    const lowerQuery = query.toLowerCase()
    return EMERGENCY_KEYWORDS.some(keyword => lowerQuery.includes(keyword))
  }
  
  // Handle search with emergency intercept
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    
    if (query.length > 2 && checkForEmergency(query)) {
      setInterceptedQuery(query)
      setShowEmergencyIntercept(true)
    }
  }
  
  // Get age-appropriate content for current guide
  const getAgeAppropriateContent = (guide: typeof careGuides[0]) => {
    const adaptation = guide.ageAdaptations?.find(
      a => childAgeMonths >= a.minMonths && childAgeMonths < a.maxMonths
    )
    return adaptation || guide.ageAdaptations?.[guide.ageAdaptations.length - 1]
  }
  
  // Calculate weight-based dosing
  const calculateDosage = (medication: 'acetaminophen' | 'ibuprofen') => {
    if (!selectedChild?.weight_lbs) return null
    
    const weightKg = selectedChild.weight_lbs / 2.205
    
    if (medication === 'acetaminophen') {
      const minDose = Math.round(weightKg * 10)
      const maxDose = Math.round(weightKg * 15)
      return { min: minDose, max: maxDose, unit: 'mg', frequency: 'every 4-6 hours', maxDaily: Math.min(4000, maxDose * 5) }
    } else {
      const minDose = Math.round(weightKg * 5)
      const maxDose = Math.round(weightKg * 10)
      return { min: minDose, max: maxDose, unit: 'mg', frequency: 'every 6-8 hours', maxDaily: Math.min(2400, maxDose * 4) }
    }
  }
  
  // Log temperature from within guide
  const handleLogTemp = () => {
    if (!newTemp || !selectedChild) return
    
    addVitalReading({
      id: `temp_${Date.now()}`,
      child_id: selectedChild.id,
      type: 'temperature',
      value: parseFloat(newTemp),
      unit: 'fahrenheit',
      timestamp: new Date().toISOString(),
      source: 'manual',
    })
    
    setNewTemp('')
    setShowLogTemp(false)
  }
  
  // Filter and sort guides - prioritize current conditions
  const filteredGuides = useMemo(() => {
    let guides = careGuides.filter(
      guide =>
        guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.keywords?.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    
    // Sort: recommended first, then alphabetically
    guides.sort((a, b) => {
      const aRecommended = currentConditions.includes(a.id)
      const bRecommended = currentConditions.includes(b.id)
      if (aRecommended && !bRecommended) return -1
      if (!aRecommended && bRecommended) return 1
      return a.title.localeCompare(b.title)
    })
    
    return guides
  }, [searchQuery, currentConditions])

  const currentGuide = careGuides.find(g => g.id === selectedGuide)
  const currentAgeContent = currentGuide ? getAgeAppropriateContent(currentGuide) : null
  const acetaminophenDose = calculateDosage('acetaminophen')
  const ibuprofenDose = calculateDosage('ibuprofen')

  return (
    <div className="space-y-6">
      {/* Emergency Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">
              Seek Emergency Care immediately if your child:
            </p>
            <ul className="text-xs text-red-700 dark:text-red-300 mt-2 space-y-1">
              {emergencySigns.slice(0, 3).map((sign, i) => (
                <li key={i}>• {sign}</li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
      
      {/* Contextual Recommendation Banner */}
      {currentConditions.length > 0 && !selectedGuide && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-cyan-800 dark:text-cyan-200">
                Recommended for {selectedChild?.name || 'your child'}
              </h4>
              <p className="text-sm text-cyan-700 dark:text-cyan-300">
                Based on recent symptoms, we've highlighted relevant guides below
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Search with Safety Intercept */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={`Search care guides${selectedChild ? ` for ${selectedChild.name} (${childAgeYears}yo)` : ''}...`}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {selectedChild && (
            <div className="flex items-center gap-4 mt-3 text-xs text-surface-500">
              <span className="flex items-center gap-1">
                {childAgeYears < 2 ? <Baby className="w-3 h-3" /> : <User className="w-3 h-3" />}
                Age: {childAgeYears} years
              </span>
              {selectedChild.weight_lbs && (
                <span className="flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  Weight: {selectedChild.weight_lbs} lbs
                </span>
              )}
              <span className="text-cyan-500 ml-auto">Content adapted for age</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guide Selection or Content */}
      <AnimatePresence mode="wait">
        {!selectedGuide ? (
          <motion.div
            key="selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid sm:grid-cols-2 gap-4"
          >
            {filteredGuides.map((guide) => {
              const isRecommended = currentConditions.includes(guide.id)
              const ageContent = getAgeAppropriateContent(guide)
              
              return (
                <motion.button
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide.id)}
                  className={`p-6 rounded-xl text-left transition-all relative ${
                    isRecommended 
                      ? 'bg-cyan-50 dark:bg-cyan-900/30 border-2 border-cyan-300 dark:border-cyan-700 ring-2 ring-cyan-200 dark:ring-cyan-800' 
                      : 'bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 hover:border-cyan-300 dark:hover:border-cyan-700'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isRecommended && (
                    <div className="absolute -top-2 left-4 px-2 py-1 rounded-full bg-cyan-500 text-white text-xs font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      FOR {selectedChild?.name?.toUpperCase()}
                    </div>
                  )}
                  <div className={`flex items-start gap-4 ${isRecommended ? 'pt-2' : ''}`}>
                    <div className={`p-3 rounded-xl ${
                      guide.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                      guide.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      guide.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                      'bg-purple-100 dark:bg-purple-900/30'
                    }`}>
                      <guide.icon className={`w-6 h-6 ${
                        guide.color === 'red' ? 'text-red-600 dark:text-red-400' :
                        guide.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                        guide.color === 'green' ? 'text-green-600 dark:text-green-400' :
                        'text-purple-600 dark:text-purple-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-surface-900 dark:text-white text-lg">{guide.title}</h3>
                      <p className="text-sm text-surface-600 dark:text-surface-400 mt-1 line-clamp-2">
                        {ageContent?.content || guide.summary}
                      </p>
                      {isRecommended && (
                        <Badge variant="primary" size="sm" className="mt-2">
                          <Activity className="w-3 h-3 mr-1" />
                          Based on recent activity
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-surface-400" />
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
        ) : currentGuide && (
          <motion.div
            key="content"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Back Button */}
            <Button variant="ghost" onClick={() => setSelectedGuide(null)}>
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to All Guides
            </Button>

            {/* Guide Header with Age-Specific Content */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-4 rounded-xl ${
                    currentGuide.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                    currentGuide.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    currentGuide.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                    'bg-purple-100 dark:bg-purple-900/30'
                  }`}>
                    <currentGuide.icon className={`w-8 h-8 ${
                      currentGuide.color === 'red' ? 'text-red-600 dark:text-red-400' :
                      currentGuide.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                      currentGuide.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      'text-purple-600 dark:text-purple-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl font-bold text-surface-900 dark:text-white">{currentGuide.title}</h2>
                      {selectedChild && (
                        <Badge variant="info" size="sm">
                          For {childAgeYears}yo
                        </Badge>
                      )}
                    </div>
                    {/* Age-Specific Summary */}
                    {currentAgeContent ? (
                      <div className="mt-3 p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          <span className="font-semibold text-cyan-800 dark:text-cyan-200">
                            For {selectedChild?.name || 'your child'} ({childAgeYears} years old):
                          </span>
                        </div>
                        <p className="text-cyan-700 dark:text-cyan-300">{currentAgeContent.content}</p>
                      </div>
                    ) : (
                      <p className="text-surface-600 dark:text-surface-400 mt-2">{currentGuide.summary}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* ACTIONABLE WIDGETS */}
            {currentGuide.actionWidgets && (
              <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-violet-800 dark:text-violet-200">
                    <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {currentGuide.actionWidgets.includes('logTemp') && (
                      <Button 
                        variant="secondary" 
                        onClick={() => setShowLogTemp(true)}
                        icon={<Thermometer className="w-4 h-4" />}
                        className="justify-start"
                      >
                        Log Temperature
                      </Button>
                    )}
                    {currentGuide.actionWidgets.includes('calculateDose') && (
                      <Button 
                        variant="secondary" 
                        onClick={() => setShowDoseCalculator(true)}
                        icon={<Calculator className="w-4 h-4" />}
                        className="justify-start"
                      >
                        Calculate Dose
                      </Button>
                    )}
                    {currentGuide.actionWidgets.includes('logSymptom') && (
                      <Link href="/dashboard/symptom-checker">
                        <Button 
                          variant="secondary" 
                          icon={<Plus className="w-4 h-4" />}
                          className="justify-start w-full"
                        >
                          Log Symptom
                        </Button>
                      </Link>
                    )}
                    {currentGuide.actionWidgets.includes('setReminder') && (
                      <Button 
                        variant="secondary" 
                        icon={<Clock className="w-4 h-4" />}
                        className="justify-start"
                        onClick={() => alert('Reminder set for 4 hours! (Demo)')}
                      >
                        Set Reminder
                      </Button>
                    )}
                  </div>
                  
                  {/* Inline Log Temperature */}
                  {showLogTemp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 p-4 bg-white dark:bg-surface-800 rounded-xl border border-violet-200 dark:border-violet-700"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="101.2"
                          value={newTemp}
                          onChange={(e) => setNewTemp(e.target.value)}
                          className="w-24 px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 text-lg font-bold"
                        />
                        <span className="text-surface-500">°F</span>
                        <Button 
                          size="sm" 
                          onClick={handleLogTemp}
                          disabled={!newTemp}
                          className="bg-gradient-to-r from-cyan-500 to-teal-600"
                        >
                          Log Now
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowLogTemp(false)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Personalized Dosing Card */}
            {(currentGuide.id === 'fever' || currentGuide.id === 'ear_pain') && selectedChild?.weight_lbs && (
              <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <Pill className="w-5 h-5 text-emerald-600" />
                    Personalized Dosing for {selectedChild.name} ({selectedChild.weight_lbs} lbs)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {acetaminophenDose && (
                      <div className="p-4 rounded-xl bg-white dark:bg-surface-800">
                        <div className="font-bold text-surface-900 dark:text-white mb-2">
                          Acetaminophen (Tylenol)
                        </div>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {acetaminophenDose.min}-{acetaminophenDose.max} mg
                        </div>
                        <div className="text-sm text-surface-500 mt-1">
                          {acetaminophenDose.frequency}
                        </div>
                        <div className="text-xs text-surface-400 mt-2">
                          Max daily: {acetaminophenDose.maxDaily} mg
                        </div>
                      </div>
                    )}
                    {ibuprofenDose && childAgeMonths >= 6 && (
                      <div className="p-4 rounded-xl bg-white dark:bg-surface-800">
                        <div className="font-bold text-surface-900 dark:text-white mb-2">
                          Ibuprofen (Advil/Motrin)
                        </div>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {ibuprofenDose.min}-{ibuprofenDose.max} mg
                        </div>
                        <div className="text-sm text-surface-500 mt-1">
                          {ibuprofenDose.frequency}
                        </div>
                        <div className="text-xs text-surface-400 mt-2">
                          Max daily: {ibuprofenDose.maxDaily} mg
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-3">
                    * Calculated based on {selectedChild.weight_lbs} lbs. Always verify with medication label.
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Missing Weight Warning */}
            {(currentGuide.id === 'fever' || currentGuide.id === 'ear_pain') && !selectedChild?.weight_lbs && (
              <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Scale className="w-6 h-6 text-amber-600" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-800 dark:text-amber-200">Weight needed for accurate dosing</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Add {selectedChild?.name}'s weight to see personalized medication doses
                      </p>
                    </div>
                    <Link href="/dashboard/children">
                      <Button size="sm" variant="secondary">Add Weight</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Seek Emergency Care Section */}
            <Card className="border-2 border-red-300 dark:border-red-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  Seek Emergency Care If:
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {currentGuide.emergencyCare.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-red-700 dark:text-red-300">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Call Doctor Now Section */}
            <Card className="border border-orange-300 dark:border-orange-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <Phone className="w-5 h-5" />
                  Call Your Doctor Now If:
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {currentGuide.callNow.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-orange-700 dark:text-orange-300">
                      <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Call Within 24 Hours Section */}
            <Card className="border border-amber-300 dark:border-amber-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Stethoscope className="w-5 h-5" />
                  Call Within 24 Hours If:
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {currentGuide.call24Hours.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                      <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Home Care Section */}
            <Card className="border border-emerald-300 dark:border-emerald-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Home className="w-5 h-5" />
                  Home Care Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {currentGuide.homeCare.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-emerald-800 dark:text-emerald-300">{item}</span>
                    </li>
                  ))}
                </ul>
                {/* Age-specific dosing note */}
                {currentAgeContent?.dosing && (
                  <div className="mt-4 p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Pill className="w-4 h-4 text-cyan-600" />
                      <span className="font-semibold text-cyan-800 dark:text-cyan-200 text-sm">
                        Medication Note for {childAgeYears}yo:
                      </span>
                    </div>
                    <p className="text-sm text-cyan-700 dark:text-cyan-300">{currentAgeContent.dosing}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* What NOT to Do Section */}
            <Card className="border border-surface-200 dark:border-surface-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-surface-700 dark:text-surface-300">
                  <XCircle className="w-5 h-5" />
                  What NOT to Do
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {currentGuide.doNot.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-surface-600 dark:text-surface-400">
                      <XCircle className="w-4 h-4 flex-shrink-0 mt-1 text-red-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* EMERGENCY INTERCEPT MODAL */}
      <AnimatePresence>
        {showEmergencyIntercept && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-md"
            >
              <Card className="border-4 border-red-500 bg-red-50 dark:bg-red-900/50">
                <CardContent className="pt-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <AlertTriangle className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-3">
                    <Button 
                      variant="secondary" 
                      fullWidth 
                      onClick={() => setShowEmergencyIntercept(false)}
                    >
                      My child is stable - Continue searching
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disclaimer */}
      <div className="p-4 rounded-xl bg-surface-800/50 border border-surface-700">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-surface-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-surface-500">
            <strong>Disclaimer:</strong> This information is for educational purposes only and is not 
            a substitute for professional medical advice, diagnosis, or treatment. Always consult your 
            healthcare provider with any questions about your child's health. If you think your child 
            may have a medical emergency, seek medical care immediately.
          </p>
        </div>
      </div>
    </div>
  )
}
