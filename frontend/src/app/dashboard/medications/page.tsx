'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pill,
  Plus,
  Clock,
  Check,
  AlertTriangle,
  ChevronRight,
  Bell,
  Calendar,
  Droplets,
  Thermometer,
  X,
  Edit,
  Trash2,
  History,
  Timer,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Scale,
  Beaker,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore from '@/store/useStore'
import { calculateAge } from '@/lib/utils'

// Medication form factors with concentration info
type MedFormFactor = 'liquid_infant' | 'liquid_child' | 'chewable' | 'junior_tablet' | 'adult_tablet'

interface MedFormInfo {
  label: string
  concentration_mg: number  // mg per unit
  unit: string  // mL, tablet, etc.
  description: string
}

const ACETAMINOPHEN_FORMS: Record<MedFormFactor, MedFormInfo> = {
  liquid_infant: { label: 'Infant Drops', concentration_mg: 80, unit: 'mL', description: '80mg per 0.8mL dropper' },
  liquid_child: { label: "Children's Liquid", concentration_mg: 160, unit: '5mL', description: '160mg per 5mL' },
  chewable: { label: 'Chewable Tablets', concentration_mg: 160, unit: 'tablet', description: '160mg per tablet' },
  junior_tablet: { label: 'Junior Strength', concentration_mg: 325, unit: 'tablet', description: '325mg per tablet' },
  adult_tablet: { label: 'Regular Strength', concentration_mg: 325, unit: 'tablet', description: '325mg per tablet' },
}

const IBUPROFEN_FORMS: Record<MedFormFactor, MedFormInfo> = {
  liquid_infant: { label: 'Infant Drops', concentration_mg: 50, unit: 'mL', description: '50mg per 1.25mL' },
  liquid_child: { label: "Children's Liquid", concentration_mg: 100, unit: '5mL', description: '100mg per 5mL' },
  chewable: { label: 'Chewable Tablets', concentration_mg: 100, unit: 'tablet', description: '100mg per tablet' },
  junior_tablet: { label: 'Junior Strength', concentration_mg: 100, unit: 'tablet', description: '100mg per tablet' },
  adult_tablet: { label: 'Adult (200mg)', concentration_mg: 200, unit: 'tablet', description: '200mg per tablet' },
}

// Max daily limits for safety
const DAILY_LIMITS = {
  acetaminophen: { max_mg_per_kg: 75, absolute_max_mg: 4000 },  // 75mg/kg/day or 4000mg, whichever is less
  ibuprofen: { max_mg_per_kg: 40, absolute_max_mg: 1200 },  // 40mg/kg/day or 1200mg
}

// Dosing ranges (mg per kg per dose)
const DOSING_RANGES = {
  acetaminophen: { min: 10, max: 15, typical: 12.5 },  // 10-15 mg/kg
  ibuprofen: { min: 5, max: 10, typical: 7.5 },  // 5-10 mg/kg
}

interface Medication {
  id: string
  name: string
  dosage: string  // Will now be calculated
  unit: string
  frequency: string
  intervalHours: number
  instructions: string
  color: string
  type?: 'acetaminophen' | 'ibuprofen' | 'other'
  formFactor?: MedFormFactor
}

interface DoseLog {
  id: string
  medicationId: string
  timestamp: Date
  dosage: string
  dosage_mg?: number
  notes: string
  temperature_before?: number
}

// Calculate weight-based dosage
function calculateWeightBasedDosage(
  weightLbs: number,
  medType: 'acetaminophen' | 'ibuprofen',
  formFactor: MedFormFactor
): { dose_mg: number; dose_display: string; dose_units: number; unit_label: string; range: string } {
  const weightKg = weightLbs * 0.453592
  const range = DOSING_RANGES[medType]
  const forms = medType === 'acetaminophen' ? ACETAMINOPHEN_FORMS : IBUPROFEN_FORMS
  const form = forms[formFactor]
  
  // Calculate dose in mg using typical dose (middle of range)
  const dose_mg = Math.round(weightKg * range.typical)
  const min_mg = Math.round(weightKg * range.min)
  const max_mg = Math.round(weightKg * range.max)
  
  // Calculate units to give
  let dose_units: number
  let unit_label: string
  let dose_display: string
  
  if (form.unit === '5mL') {
    // Liquid - calculate mL
    const mL_needed = (dose_mg / form.concentration_mg) * 5
    dose_units = Math.round(mL_needed * 2) / 2  // Round to nearest 0.5mL
    unit_label = 'mL'
    dose_display = `${dose_units} mL (${Math.round(dose_units / 5 * form.concentration_mg)}mg)`
  } else if (form.unit === 'mL') {
    // Infant drops
    const mL_needed = dose_mg / form.concentration_mg
    dose_units = Math.round(mL_needed * 10) / 10
    unit_label = 'mL'
    dose_display = `${dose_units} mL (${Math.round(dose_units * form.concentration_mg)}mg)`
  } else {
    // Tablets - round to whole tablets
    dose_units = Math.round(dose_mg / form.concentration_mg)
    // Ensure at least 1 tablet
    dose_units = Math.max(1, dose_units)
    unit_label = dose_units === 1 ? 'tablet' : 'tablets'
    dose_display = `${dose_units} ${unit_label} (${dose_units * form.concentration_mg}mg)`
  }
  
  return {
    dose_mg,
    dose_display,
    dose_units,
    unit_label,
    range: `${min_mg}-${max_mg}mg`
  }
}

const defaultMedications: Medication[] = [
  {
    id: '1',
    name: 'Acetaminophen (Tylenol)',
    dosage: 'auto',  // Will be calculated
    unit: 'mg',
    frequency: 'Every 4-6 hours as needed',
    intervalHours: 4,
    instructions: 'Give with food or milk. Max 5 doses/day.',
    color: 'bg-red-500',
    type: 'acetaminophen',
    formFactor: 'liquid_child',
  },
  {
    id: '2',
    name: 'Ibuprofen (Advil/Motrin)',
    dosage: 'auto',  // Will be calculated
    unit: 'mg',
    frequency: 'Every 6-8 hours as needed',
    intervalHours: 6,
    instructions: 'Give with food. Max 4 doses/day.',
    color: 'bg-blue-500',
    type: 'ibuprofen',
    formFactor: 'liquid_child',
  },
]

const medicationColors = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
  'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500'
]

export default function MedicationsPage() {
  const { 
    selectedChild, 
    medications: storedMedications, 
    doseLogs: storedDoseLogs,
    addMedication,
    removeMedication,
    addDoseLog,
    vitalReadings,
  } = useStore()
  
  // Use stored medications if available, otherwise use defaults
  const medications = storedMedications.length > 0 ? storedMedications : defaultMedications
  const doseLogs = storedDoseLogs.map(log => ({
    ...log,
    timestamp: new Date(log.timestamp),
  }))
  const [showAddMedication, setShowAddMedication] = useState(false)
  const [showLogDose, setShowLogDose] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [alternatingMode, setAlternatingMode] = useState(false)
  const [logTemperature, setLogTemperature] = useState('')
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    unit: 'mg',
    frequency: '',
    intervalHours: 4,
    instructions: '',
    color: medicationColors[0],
    type: 'other' as 'acetaminophen' | 'ibuprofen' | 'other',
    formFactor: 'liquid_child' as MedFormFactor,
  })
  const [doseNotes, setDoseNotes] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Get child's weight for dosage calculation
  const childWeight = selectedChild?.weight_lbs || 0
  const hasWeight = childWeight > 0
  
  // Get recent temperature for context
  const recentTemp = useMemo(() => {
    if (!selectedChild) return null
    const temp = vitalReadings.find(
      v => v.child_id === selectedChild.id && v.type === 'temperature'
    )
    return temp ? temp.value : null
  }, [selectedChild, vitalReadings])
  
  // Calculate temperature change since last dose
  const getTempChangeSinceLastDose = (medId: string) => {
    const lastDose = doseLogs
      .filter(log => log.medicationId === medId && log.temperature_before)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    
    if (!lastDose?.temperature_before || !recentTemp) return null
    
    const change = recentTemp - lastDose.temperature_before
    return {
      change,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
      tempBefore: lastDose.temperature_before,
      tempNow: recentTemp,
    }
  }
  
  // Calculate 24-hour totals for safety limits
  const get24HourTotal = (medType: 'acetaminophen' | 'ibuprofen') => {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const relevantMeds = medications.filter(m => m.type === medType)
    let total_mg = 0
    
    relevantMeds.forEach(med => {
      const recentDoses = doseLogs.filter(
        log => log.medicationId === med.id && 
               new Date(log.timestamp) > twentyFourHoursAgo
      )
      
      recentDoses.forEach(dose => {
        // Parse mg from dosage string or use calculated
        if (dose.dosage_mg) {
          total_mg += dose.dosage_mg
        } else {
          const match = dose.dosage.match(/(\d+)\s*mg/i)
          if (match) total_mg += parseInt(match[1])
        }
      })
    })
    
    const limits = DAILY_LIMITS[medType]
    const weightKg = childWeight * 0.453592
    const maxByWeight = Math.round(weightKg * limits.max_mg_per_kg)
    const effectiveMax = Math.min(maxByWeight, limits.absolute_max_mg)
    
    return {
      total_mg,
      max_mg: effectiveMax,
      percentage: Math.min(100, Math.round((total_mg / effectiveMax) * 100)),
      isNearLimit: total_mg > effectiveMax * 0.75,
      isAtLimit: total_mg >= effectiveMax,
    }
  }
  
  // Get calculated dosage for a medication
  const getCalculatedDosage = (med: Medication) => {
    if (!hasWeight || !med.type || med.type === 'other') {
      return { hasCalculation: false, dose_display: `${med.dosage} ${med.unit}` }
    }
    
    const calculation = calculateWeightBasedDosage(
      childWeight,
      med.type,
      med.formFactor || 'liquid_child'
    )
    
    return {
      hasCalculation: true,
      ...calculation,
    }
  }
  
  // Alternating schedule logic
  const getAlternatingInfo = (med: Medication) => {
    if (!alternatingMode) return null
    
    // Find the "other" antipyretic
    const otherType = med.type === 'acetaminophen' ? 'ibuprofen' : 'acetaminophen'
    const otherMed = medications.find(m => m.type === otherType)
    
    if (!otherMed) return null
    
    // Get last dose of the other med
    const otherLastDose = doseLogs
      .filter(log => log.medicationId === otherMed.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    
    if (!otherLastDose) return null
    
    const timeSinceOther = currentTime.getTime() - new Date(otherLastDose.timestamp).getTime()
    const hoursAgo = Math.floor(timeSinceOther / (1000 * 60 * 60))
    
    // In alternating mode, suggest 3 hours after the other med
    const suggestAlternate = hoursAgo >= 3
    
    return {
      otherMedName: otherMed.name.split('(')[0].trim(),
      hoursAgo,
      suggestAlternate,
      message: suggestAlternate 
        ? `${otherMed.name.split('(')[0].trim()} was given ${hoursAgo}h ago. Good time to alternate!`
        : `Wait ${3 - hoursAgo}h before alternating (${otherMed.name.split('(')[0].trim()} given ${hoursAgo}h ago)`
    }
  }

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Calculate next dose time for each medication
  const getNextDoseInfo = (med: Medication) => {
    const lastDose = doseLogs
      .filter(log => log.medicationId === med.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

    if (!lastDose) {
      return { canGive: true, timeUntilNext: null, lastDoseTime: null }
    }

    const lastDoseTime = new Date(lastDose.timestamp)
    const nextDoseTime = new Date(lastDoseTime.getTime() + med.intervalHours * 60 * 60 * 1000)
    const now = currentTime
    const timeUntilNext = nextDoseTime.getTime() - now.getTime()

    return {
      canGive: timeUntilNext <= 0,
      timeUntilNext: timeUntilNext > 0 ? timeUntilNext : null,
      lastDoseTime,
      nextDoseTime,
    }
  }

  const formatTimeUntil = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${formatTime(date)}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${formatTime(date)}`
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const handleLogDose = (medicationId: string) => {
    const med = medications.find(m => m.id === medicationId)
    if (!med) return

    const newLog = {
      id: Date.now().toString(),
      medicationId,
      timestamp: new Date().toISOString(),
      dosage: `${med.dosage} ${med.unit}`,
      notes: doseNotes,
    }

    addDoseLog(newLog)
    setShowLogDose(null)
    setDoseNotes('')
  }

  const handleAddMedication = () => {
    const med: Medication = {
      id: Date.now().toString(),
      ...newMedication,
    }
    addMedication(med)
    setShowAddMedication(false)
    setNewMedication({
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: '',
      intervalHours: 4,
      instructions: '',
      color: medicationColors[medications.length % medicationColors.length],
      type: 'other' as 'acetaminophen' | 'ibuprofen' | 'other',
      formFactor: 'liquid_child' as MedFormFactor,
    })
  }

  const handleDeleteMedication = (id: string) => {
    removeMedication(id)
  }

  // Sort medications: ones that can be given now first
  const sortedMedications = useMemo(() => {
    return [...medications].sort((a, b) => {
      const aInfo = getNextDoseInfo(a)
      const bInfo = getNextDoseInfo(b)
      if (aInfo.canGive && !bInfo.canGive) return -1
      if (!aInfo.canGive && bInfo.canGive) return 1
      return 0
    })
  }, [medications, doseLogs, currentTime])

  const recentLogs = useMemo(() => {
    return doseLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
  }, [doseLogs])

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Pill className="w-16 h-16 text-surface-600 dark:text-surface-300 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Child Selected</h2>
        <p className="text-surface-600 dark:text-surface-400">Select a child to track medications</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Medication Tracker</h1>
          <p className="text-surface-600 dark:text-surface-400">Track doses and get reminders for {selectedChild.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowHistory(!showHistory)} icon={<History className="w-4 h-4" />}>
            History
          </Button>
          <Button onClick={() => setShowAddMedication(true)} icon={<Plus className="w-4 h-4" />} className="bg-gradient-to-r from-cyan-500 to-teal-600">
            Add Medication
          </Button>
        </div>
      </div>

      {/* Weight Warning Banner */}
      {!hasWeight && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <Scale className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">Weight Required for Safe Dosing</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Add {selectedChild?.name}'s weight to get accurate, weight-based medication dosages.
                  Without weight, we cannot calculate safe doses.
                </p>
                <a href={`/dashboard/children?edit=${selectedChild?.id}`} className="inline-block mt-2">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                    Add Weight Now
                  </Button>
                </a>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
              <Pill className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">{medications.length}</div>
              <div className="text-xs text-surface-500">Medications</div>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">
                {doseLogs.filter(l => {
                  const d = new Date(l.timestamp)
                  const today = new Date()
                  return d.toDateString() === today.toDateString()
                }).length}
              </div>
              <div className="text-xs text-surface-500">Doses Today</div>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">
                {medications.filter(m => getNextDoseInfo(m).canGive).length}
              </div>
              <div className="text-xs text-surface-500">Ready to Give</div>
            </div>
          </div>
        </Card>
        
        {/* Current Temperature Context */}
        <Card padding="sm" className={recentTemp && recentTemp > 100.4 ? 'border-red-300 dark:border-red-700' : ''}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              recentTemp && recentTemp > 100.4 
                ? 'bg-red-100 dark:bg-red-900/50' 
                : 'bg-violet-100 dark:bg-violet-900/50'
            }`}>
              <Thermometer className={`w-5 h-5 ${
                recentTemp && recentTemp > 100.4 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-violet-600 dark:text-violet-400'
              }`} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${
                recentTemp && recentTemp > 100.4 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-surface-900 dark:text-white'
              }`}>
                {recentTemp ? `${recentTemp}°` : '—'}
              </div>
              <div className="text-xs text-surface-500">Current Temp</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 24-Hour Safety Gauges */}
      {hasWeight && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['acetaminophen', 'ibuprofen'] as const).map(medType => {
            const hasMed = medications.some(m => m.type === medType)
            if (!hasMed) return null
            
            const usage = get24HourTotal(medType)
            const medName = medType === 'acetaminophen' ? 'Tylenol' : 'Advil/Motrin'
            
            return (
              <Card key={medType} padding="sm" className={usage.isAtLimit ? 'border-red-300 dark:border-red-700' : ''}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    {medName} - 24hr Total
                  </span>
                  <span className={`text-sm font-bold ${
                    usage.isAtLimit ? 'text-red-600' : usage.isNearLimit ? 'text-amber-600' : 'text-surface-600'
                  }`}>
                    {usage.total_mg}mg / {usage.max_mg}mg
                  </span>
                </div>
                <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usage.percentage}%` }}
                    className={`h-full rounded-full ${
                      usage.isAtLimit 
                        ? 'bg-red-500' 
                        : usage.isNearLimit 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    }`}
                  />
                </div>
                {usage.isAtLimit && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Daily limit reached. Do not give more until 24h has passed.
                  </p>
                )}
                {usage.isNearLimit && !usage.isAtLimit && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Approaching daily limit. Only 1-2 doses remaining.
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Alternating Schedule Toggle */}
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <RefreshCw className={`w-5 h-5 text-violet-600 dark:text-violet-400 ${alternatingMode ? 'animate-spin-slow' : ''}`} />
            </div>
            <div>
              <div className="font-medium text-surface-900 dark:text-white">Alternating Schedule Mode</div>
              <div className="text-xs text-surface-500">
                Alternate Tylenol & Advil every 3 hours for better fever control
              </div>
            </div>
          </div>
          <button
            onClick={() => setAlternatingMode(!alternatingMode)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              alternatingMode ? 'bg-violet-500' : 'bg-surface-300 dark:bg-surface-600'
            }`}
          >
            <motion.div
              animate={{ x: alternatingMode ? 24 : 2 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
            />
          </button>
        </div>
      </Card>

      {/* Medications List */}
      <div className="space-y-4">
        {sortedMedications.map((med) => {
          const doseInfo = getNextDoseInfo(med)
          const calculatedDose = getCalculatedDosage(med)
          const tempChange = getTempChangeSinceLastDose(med.id)
          const alternatingInfo = (med.type === 'acetaminophen' || med.type === 'ibuprofen') 
            ? getAlternatingInfo(med) 
            : null
          const usage24h = med.type && med.type !== 'other' ? get24HourTotal(med.type) : null
          
          return (
            <motion.div
              key={med.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={`border-l-4 ${med.color.replace('bg-', 'border-')} ${
                usage24h?.isAtLimit ? 'opacity-60' : ''
              }`}>
                <div className="flex flex-col gap-4">
                  {/* Main Row */}
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Medication Info */}
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-xl ${med.color} flex items-center justify-center flex-shrink-0`}>
                          <Pill className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-surface-900 dark:text-white">{med.name}</h3>
                          
                          {/* Weight-Based Calculated Dosage */}
                          {calculatedDose.hasCalculation ? (
                            <div className="mt-1">
                              <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                                Give: {calculatedDose.dose_display}
                              </p>
                              <p className="text-xs text-surface-500">
                                Safe range: {'range' in calculatedDose ? calculatedDose.range : 'N/A'} (based on {childWeight}lbs)
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-surface-600 dark:text-surface-400">
                              {med.dosage} {med.unit}
                              {!hasWeight && med.type && med.type !== 'other' && (
                                <span className="text-amber-500 ml-2">⚠️ Add weight for safe dosing</span>
                              )}
                            </p>
                          )}
                          
                          <p className="text-xs text-surface-500 mt-1">
                            {med.frequency} • {med.instructions}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dose Status */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-4">
                      {/* Timer Display with Context */}
                      <div className={`px-4 py-2 rounded-xl ${
                        usage24h?.isAtLimit
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : doseInfo.canGive 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                            : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        {usage24h?.isAtLimit ? (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <div>
                              <div className="text-sm font-semibold text-red-700 dark:text-red-300">Daily Limit Reached</div>
                              <div className="text-xs text-red-600 dark:text-red-400">
                                Wait 24h from first dose
                              </div>
                            </div>
                          </div>
                        ) : doseInfo.canGive ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <div>
                              <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Ready to give</div>
                              {doseInfo.lastDoseTime && (
                                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                                  Last: {formatTime(doseInfo.lastDoseTime)}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            <div>
                              <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                                Wait {formatTimeUntil(doseInfo.timeUntilNext!)}
                              </div>
                              <div className="text-xs text-amber-600 dark:text-amber-400">
                                Next: {formatTime(doseInfo.nextDoseTime!)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setShowLogDose(med.id)}
                          disabled={!doseInfo.canGive || usage24h?.isAtLimit}
                          className={doseInfo.canGive && !usage24h?.isAtLimit ? 'bg-gradient-to-r from-cyan-500 to-teal-600' : ''}
                          icon={<Check className="w-4 h-4" />}
                        >
                          Log Dose
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMedication(med.id)}
                          className="text-surface-600 dark:text-surface-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Context Row - Temperature change and alternating info */}
                  {(tempChange || alternatingInfo) && (
                    <div className="flex flex-wrap gap-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                      {/* Temperature Change Since Last Dose */}
                      {tempChange && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                          tempChange.direction === 'down' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : tempChange.direction === 'up'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                        }`}>
                          {tempChange.direction === 'down' ? (
                            <TrendingDown className="w-4 h-4" />
                          ) : tempChange.direction === 'up' ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : null}
                          <span>
                            Temp: {tempChange.tempBefore}°F → {tempChange.tempNow}°F 
                            ({tempChange.change > 0 ? '+' : ''}{tempChange.change.toFixed(1)}°)
                          </span>
                        </div>
                      )}
                      
                      {/* Alternating Schedule Info */}
                      {alternatingInfo && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                          alternatingInfo.suggestAlternate
                            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                        }`}>
                          <RefreshCw className="w-4 h-4" />
                          <span>{alternatingInfo.message}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )
        })}

        {medications.length === 0 && (
          <Card className="text-center py-12">
            <Pill className="w-16 h-16 text-surface-600 dark:text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">No Medications Added</h3>
            <p className="text-surface-600 dark:text-surface-400 mb-4">Add medications to track doses and get reminders</p>
            <Button onClick={() => setShowAddMedication(true)} icon={<Plus className="w-4 h-4" />}>
              Add First Medication
            </Button>
          </Card>
        )}
      </div>

      {/* Dose History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-500" />
                  Recent Dose History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentLogs.length > 0 ? (
                  <div className="space-y-3">
                    {recentLogs.map((log) => {
                      const med = medications.find(m => m.id === log.medicationId)
                      if (!med) return null
                      return (
                        <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800">
                          <div className={`w-10 h-10 rounded-lg ${med.color} flex items-center justify-center`}>
                            <Pill className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-surface-900 dark:text-white">{med.name}</div>
                            <div className="text-sm text-surface-500">{log.dosage}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-surface-700 dark:text-surface-300">
                              {formatDate(new Date(log.timestamp))}
                            </div>
                            {log.notes && (
                              <div className="text-xs text-surface-500">{log.notes}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-surface-500 py-8">No doses logged yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Medication Modal */}
      <AnimatePresence>
        {showAddMedication && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddMedication(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Add Medication</CardTitle>
                    <button onClick={() => setShowAddMedication(false)} className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      Medication Name
                    </label>
                    <input
                      type="text"
                      value={newMedication.name}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Acetaminophen (Tylenol)"
                      className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        Dosage
                      </label>
                      <input
                        type="text"
                        value={newMedication.dosage}
                        onChange={(e) => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                        placeholder="e.g., 160"
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        Unit
                      </label>
                      <select
                        value={newMedication.unit}
                        onChange={(e) => setNewMedication(prev => ({ ...prev, unit: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                      >
                        <option value="mg">mg</option>
                        <option value="mL">mL</option>
                        <option value="tsp">tsp</option>
                        <option value="tablet">tablet</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      Minimum Hours Between Doses
                    </label>
                    <select
                      value={newMedication.intervalHours}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, intervalHours: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                    >
                      <option value={4}>Every 4 hours</option>
                      <option value={6}>Every 6 hours</option>
                      <option value={8}>Every 8 hours</option>
                      <option value={12}>Every 12 hours</option>
                      <option value={24}>Once daily</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      Instructions (optional)
                    </label>
                    <input
                      type="text"
                      value={newMedication.instructions}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, instructions: e.target.value }))}
                      placeholder="e.g., Give with food"
                      className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      Color
                    </label>
                    <div className="flex gap-2">
                      {medicationColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewMedication(prev => ({ ...prev, color }))}
                          className={`w-8 h-8 rounded-full ${color} ${newMedication.color === color ? 'ring-2 ring-offset-2 ring-cyan-500' : ''}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button variant="secondary" onClick={() => setShowAddMedication(false)} fullWidth>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddMedication} 
                      disabled={!newMedication.name || !newMedication.dosage}
                      fullWidth
                      className="bg-gradient-to-r from-cyan-500 to-teal-600"
                    >
                      Add Medication
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Dose Modal */}
      <AnimatePresence>
        {showLogDose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowLogDose(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Log Dose</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const med = medications.find(m => m.id === showLogDose)
                    if (!med) return null
                    return (
                      <>
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 dark:bg-surface-800">
                          <div className={`w-12 h-12 rounded-xl ${med.color} flex items-center justify-center`}>
                            <Pill className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="font-bold text-surface-900 dark:text-white">{med.name}</div>
                            <div className="text-sm text-surface-500">{med.dosage} {med.unit}</div>
                          </div>
                        </div>

                        {/* Current Temperature for Efficacy Tracking */}
                        {(med.name.toLowerCase().includes('tylenol') || 
                          med.name.toLowerCase().includes('acetaminophen') ||
                          med.name.toLowerCase().includes('ibuprofen') ||
                          med.name.toLowerCase().includes('advil')) && (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center gap-2">
                              <Thermometer className="w-4 h-4 text-amber-600" />
                              Current Temperature (for efficacy tracking)
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                min="95"
                                max="108"
                                placeholder="101.2"
                                className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                              />
                              <span className="text-surface-500">°F</span>
                            </div>
                            <p className="text-xs text-surface-500 mt-2">
                              We'll check temp again in ~1hr to measure medication effectiveness
                            </p>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Notes (optional)
                          </label>
                          <input
                            type="text"
                            value={doseNotes}
                            onChange={(e) => setDoseNotes(e.target.value)}
                            placeholder="e.g., Given with dinner"
                            className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                          />
                        </div>

                        <div className="flex gap-3 pt-4">
                          <Button variant="secondary" onClick={() => setShowLogDose(null)} fullWidth>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => handleLogDose(showLogDose)} 
                            fullWidth
                            icon={<Check className="w-4 h-4" />}
                            className="bg-gradient-to-r from-cyan-500 to-teal-600"
                          >
                            Confirm Dose
                          </Button>
                        </div>
                      </>
                    )
                  })()}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Note */}
      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-800 dark:text-amber-200">Important Safety Note</h4>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Always follow your doctor's or pharmacist's instructions. Do not exceed recommended doses. 
              This tracker is for reference only and does not replace medical advice.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
