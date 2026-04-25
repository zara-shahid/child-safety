'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Ruler,
  Scale,
  Plus,
  Calendar,
  ChevronRight,
  Info,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Activity,
  Heart,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore from '@/store/useStore'
import { calculateAge, calculateAgeInMonths } from '@/lib/utils'

interface GrowthEntry {
  id: string
  date: Date
  weight: number // in lbs
  height: number // in inches
  headCircumference?: number // in inches
}

// CDC Growth Chart Reference Data (50th percentile by age in years)
// Source: CDC Growth Charts, simplified for key age points
// Weight in lbs, Height in inches
const cdcGrowthData = {
  female: {
    // Age (years): { weight_50th, height_50th, weight_5th, weight_95th, height_5th, height_95th }
    2: { weight_50: 26.5, height_50: 34, weight_5: 22, weight_95: 32, height_5: 31.5, height_95: 36.5 },
    3: { weight_50: 31, height_50: 37.5, weight_5: 26, weight_95: 38, height_5: 35, height_95: 40 },
    4: { weight_50: 35, height_50: 40.5, weight_5: 29, weight_95: 44, height_5: 38, height_95: 43.5 },
    5: { weight_50: 40, height_50: 43, weight_5: 33, weight_95: 51, height_5: 40.5, height_95: 46.5 },
    6: { weight_50: 45, height_50: 46, weight_5: 36, weight_95: 58, height_5: 43, height_95: 49 },
    7: { weight_50: 50, height_50: 48.5, weight_5: 40, weight_95: 66, height_5: 45.5, height_95: 51.5 },
    8: { weight_50: 56, height_50: 51, weight_5: 44, weight_95: 76, height_5: 48, height_95: 54 },
    9: { weight_50: 63, height_50: 53, weight_5: 49, weight_95: 87, height_5: 50, height_95: 56 },
    10: { weight_50: 72, height_50: 55.5, weight_5: 54, weight_95: 100, height_5: 52, height_95: 58.5 },
    11: { weight_50: 82, height_50: 58, weight_5: 60, weight_95: 115, height_5: 54, height_95: 61 },
    12: { weight_50: 92, height_50: 60, weight_5: 68, weight_95: 130, height_5: 56.5, height_95: 63 },
    13: { weight_50: 101, height_50: 62, weight_5: 76, weight_95: 142, height_5: 58.5, height_95: 65 },
    14: { weight_50: 108, height_50: 63.5, weight_5: 82, weight_95: 150, height_5: 59.5, height_95: 66 },
    15: { weight_50: 114, height_50: 64, weight_5: 88, weight_95: 156, height_5: 60, height_95: 67 },
    16: { weight_50: 118, height_50: 64, weight_5: 92, weight_95: 160, height_5: 60.5, height_95: 67.5 },
    17: { weight_50: 120, height_50: 64, weight_5: 95, weight_95: 165, height_5: 61, height_95: 68 },
  },
  male: {
    2: { weight_50: 28, height_50: 34.5, weight_5: 23, weight_95: 34, height_5: 32, height_95: 37 },
    3: { weight_50: 32, height_50: 38, weight_5: 27, weight_95: 40, height_5: 35.5, height_95: 40.5 },
    4: { weight_50: 36, height_50: 41, weight_5: 30, weight_95: 46, height_5: 38.5, height_95: 44 },
    5: { weight_50: 41, height_50: 43.5, weight_5: 34, weight_95: 52, height_5: 41, height_95: 46.5 },
    6: { weight_50: 46, height_50: 46, weight_5: 37, weight_95: 60, height_5: 43.5, height_95: 49 },
    7: { weight_50: 51, height_50: 48.5, weight_5: 41, weight_95: 68, height_5: 46, height_95: 51.5 },
    8: { weight_50: 57, height_50: 51, weight_5: 46, weight_95: 78, height_5: 48, height_95: 54 },
    9: { weight_50: 63, height_50: 53, weight_5: 50, weight_95: 88, height_5: 50, height_95: 56 },
    10: { weight_50: 71, height_50: 55, weight_5: 55, weight_95: 100, height_5: 52, height_95: 58 },
    11: { weight_50: 79, height_50: 57, weight_5: 60, weight_95: 113, height_5: 53.5, height_95: 60 },
    12: { weight_50: 89, height_50: 59, weight_5: 67, weight_95: 128, height_5: 55.5, height_95: 62.5 },
    13: { weight_50: 101, height_50: 62, weight_5: 76, weight_95: 143, height_5: 57.5, height_95: 66 },
    14: { weight_50: 113, height_50: 65, weight_5: 85, weight_95: 158, height_5: 60, height_95: 69 },
    15: { weight_50: 124, height_50: 67, weight_5: 95, weight_95: 170, height_5: 62, height_95: 71 },
    16: { weight_50: 134, height_50: 69, weight_5: 104, weight_95: 180, height_5: 64, height_95: 72.5 },
    17: { weight_50: 142, height_50: 70, weight_5: 112, weight_95: 188, height_5: 65, height_95: 73 },
  },
}

// Get expected ranges for a specific age and gender
function getExpectedRanges(ageYears: number, gender: 'male' | 'female') {
  const data = cdcGrowthData[gender]
  
  // Clamp age to available range (2-17)
  const clampedAge = Math.max(2, Math.min(17, Math.round(ageYears)))
  
  // Get closest age data
  const ageData = data[clampedAge as keyof typeof data]
  
  if (!ageData) {
    // Fallback for ages < 2 (use 2-year-old data scaled down)
    const twoYearData = data[2]
    const scaleFactor = ageYears / 2
    return {
      weight_50: twoYearData.weight_50 * scaleFactor,
      height_50: twoYearData.height_50 * Math.sqrt(scaleFactor),
      weight_5: twoYearData.weight_5 * scaleFactor,
      weight_95: twoYearData.weight_95 * scaleFactor,
      height_5: twoYearData.height_5 * Math.sqrt(scaleFactor),
      height_95: twoYearData.height_95 * Math.sqrt(scaleFactor),
    }
  }
  
  return ageData
}

// Calculate percentile based on actual age and gender
function calculateAgeBasedPercentile(
  value: number, 
  type: 'weight' | 'height', 
  ageYears: number, 
  gender: 'male' | 'female'
): { percentile: number; status: 'critical_low' | 'low' | 'normal' | 'high' | 'critical_high'; message: string } {
  const ranges = getExpectedRanges(ageYears, gender)
  
  const p5 = type === 'weight' ? ranges.weight_5 : ranges.height_5
  const p50 = type === 'weight' ? ranges.weight_50 : ranges.height_50
  const p95 = type === 'weight' ? ranges.weight_95 : ranges.height_95
  
  // Calculate approximate percentile using linear interpolation
  let percentile: number
  
  if (value < p5 * 0.7) {
    // Critically below normal - less than 70% of 5th percentile
    percentile = Math.max(0, Math.round((value / p5) * 3))
    return { 
      percentile, 
      status: 'critical_low',
      message: `Severely below expected range for a ${ageYears}-year-old. Immediate medical attention recommended.`
    }
  } else if (value < p5) {
    // Below 5th percentile
    percentile = Math.round(((value - p5 * 0.7) / (p5 - p5 * 0.7)) * 5)
    return { 
      percentile, 
      status: 'low',
      message: `Below 5th percentile for a ${ageYears}-year-old ${gender}. Discuss with pediatrician.`
    }
  } else if (value < p50) {
    // Between 5th and 50th percentile
    percentile = 5 + Math.round(((value - p5) / (p50 - p5)) * 45)
    return { 
      percentile, 
      status: 'normal',
      message: `Within normal range for a ${ageYears}-year-old ${gender}.`
    }
  } else if (value <= p95) {
    // Between 50th and 95th percentile
    percentile = 50 + Math.round(((value - p50) / (p95 - p50)) * 45)
    return { 
      percentile, 
      status: 'normal',
      message: `Within normal range for a ${ageYears}-year-old ${gender}.`
    }
  } else if (value <= p95 * 1.3) {
    // Above 95th percentile but not critically
    percentile = 95 + Math.round(((value - p95) / (p95 * 0.3)) * 4)
    return { 
      percentile: Math.min(99, percentile), 
      status: 'high',
      message: `Above 95th percentile for a ${ageYears}-year-old ${gender}. Monitor with pediatrician.`
    }
  } else {
    // Critically above normal
    return { 
      percentile: 99, 
      status: 'critical_high',
      message: `Significantly above expected range for a ${ageYears}-year-old. Medical review recommended.`
    }
  }
}

// Validate measurement against expected ranges
function validateMeasurement(
  weight: number, 
  height: number, 
  ageYears: number, 
  gender: 'male' | 'female'
): { valid: boolean; warnings: string[] } {
  const ranges = getExpectedRanges(ageYears, gender)
  const warnings: string[] = []
  
  // Check weight - flag if outside 50% of expected range
  if (weight < ranges.weight_5 * 0.5) {
    warnings.push(`Weight of ${weight} lbs is extremely low for a ${ageYears}-year-old. Expected range: ${ranges.weight_5}-${ranges.weight_95} lbs. Did you mean ${weight * 3} lbs?`)
  } else if (weight > ranges.weight_95 * 1.5) {
    warnings.push(`Weight of ${weight} lbs is unusually high for a ${ageYears}-year-old. Expected range: ${ranges.weight_5}-${ranges.weight_95} lbs.`)
  }
  
  // Check height - flag if outside reasonable range
  if (height < ranges.height_5 * 0.7) {
    warnings.push(`Height of ${height}" is extremely low for a ${ageYears}-year-old. Expected range: ${ranges.height_5}-${ranges.height_95}". Did you mean ${height + 24}"?`)
  } else if (height > ranges.height_95 * 1.3) {
    warnings.push(`Height of ${height}" is unusually high for a ${ageYears}-year-old. Expected range: ${ranges.height_5}-${ranges.height_95}".`)
  }
  
  return { valid: warnings.length === 0, warnings }
}

// Calculate BMI and BMI percentile
function calculateBMIWithPercentile(
  weightLbs: number, 
  heightInches: number, 
  ageYears: number, 
  gender: 'male' | 'female'
): { bmi: number; percentile: number; status: 'underweight' | 'healthy' | 'overweight' | 'obese'; message: string } {
  // BMI = (weight in lbs / (height in inches)^2) * 703
  const bmi = (weightLbs / (heightInches * heightInches)) * 703
  
  // BMI percentile ranges by age (simplified CDC reference)
  // For children/teens, BMI percentile varies by age
  // These are approximate 5th, 50th, 85th, 95th percentile BMI values
  const bmiRanges: Record<number, { p5: number; p50: number; p85: number; p95: number }> = {
    5: { p5: 13.5, p50: 15.5, p85: 17, p95: 18 },
    6: { p5: 13.5, p50: 15.5, p85: 17.5, p95: 18.5 },
    7: { p5: 13.5, p50: 15.5, p85: 18, p95: 19 },
    8: { p5: 14, p50: 16, p85: 18.5, p95: 20 },
    9: { p5: 14, p50: 16.5, p85: 19, p95: 21 },
    10: { p5: 14.5, p50: 17, p85: 20, p95: 22 },
    11: { p5: 15, p50: 17.5, p85: 21, p95: 23.5 },
    12: { p5: 15.5, p50: 18.5, p85: 22, p95: 25 },
    13: { p5: 16, p50: 19, p85: 23, p95: 26 },
    14: { p5: 16.5, p50: 20, p85: 24, p95: 27 },
    15: { p5: 17, p50: 20.5, p85: 24.5, p95: 28 },
    16: { p5: 17.5, p50: 21, p85: 25, p95: 29 },
    17: { p5: 18, p50: 21.5, p85: 25.5, p95: 30 },
  }
  
  const clampedAge = Math.max(5, Math.min(17, Math.round(ageYears)))
  const ranges = bmiRanges[clampedAge] || bmiRanges[12]
  
  let percentile: number
  let status: 'underweight' | 'healthy' | 'overweight' | 'obese'
  let message: string
  
  if (bmi < ranges.p5) {
    percentile = Math.max(1, Math.round((bmi / ranges.p5) * 5))
    status = 'underweight'
    message = `BMI ${bmi.toFixed(1)} is below 5th percentile (underweight)`
  } else if (bmi < ranges.p85) {
    percentile = 5 + Math.round(((bmi - ranges.p5) / (ranges.p85 - ranges.p5)) * 80)
    status = 'healthy'
    message = `BMI ${bmi.toFixed(1)} is in healthy range`
  } else if (bmi < ranges.p95) {
    percentile = 85 + Math.round(((bmi - ranges.p85) / (ranges.p95 - ranges.p85)) * 10)
    status = 'overweight'
    message = `BMI ${bmi.toFixed(1)} is between 85th-95th percentile (overweight)`
  } else {
    percentile = Math.min(99, 95 + Math.round(((bmi - ranges.p95) / 5) * 4))
    status = 'obese'
    message = `BMI ${bmi.toFixed(1)} is above 95th percentile (obese)`
  }
  
  return { bmi, percentile, status, message }
}

export default function GrowthPage() {
  const { selectedChild } = useStore()
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [newEntry, setNewEntry] = useState({
    weight: '',
    height: '',
    headCircumference: '',
  })
  const [activeTab, setActiveTab] = useState<'weight' | 'height'>('weight')
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [pendingEntry, setPendingEntry] = useState<GrowthEntry | null>(null)
  
  // Get child's age and gender
  const childAge = selectedChild?.date_of_birth 
    ? calculateAge(selectedChild.date_of_birth) 
    : 12
  const childGender = (selectedChild?.gender?.toLowerCase() === 'male' ? 'male' : 'female') as 'male' | 'female'
  
  // Generate realistic mock data based on actual child age
  const generateRealisticMockData = useMemo(() => {
    if (!selectedChild) return []
    
    const ranges = getExpectedRanges(childAge, childGender)
    const currentWeight = selectedChild.weight_lbs || ranges.weight_50
    const currentHeight = Math.round(ranges.height_50) // Assume median height
    
    // Generate historical data going back 1 year
    const entries: GrowthEntry[] = []
    for (let i = 4; i >= 0; i--) {
      const monthsAgo = i * 3
      const pastDate = new Date()
      pastDate.setMonth(pastDate.getMonth() - monthsAgo)
      
      // Growth rates: ~2-3 lbs and 1-2 inches per quarter for children
      const weightAtTime = currentWeight - (i * 2.5)
      const heightAtTime = currentHeight - (i * 0.5)
      
      entries.push({
        id: `${i}`,
        date: pastDate,
        weight: Math.round(weightAtTime * 10) / 10,
        height: Math.round(heightAtTime * 4) / 4,
      })
    }
    
    return entries
  }, [selectedChild, childAge, childGender])
  
  const [growthData, setGrowthData] = useState<GrowthEntry[]>([])
  
  // Initialize growth data based on child
  useEffect(() => {
    if (selectedChild) {
      setGrowthData(generateRealisticMockData)
    }
  }, [selectedChild, generateRealisticMockData])
  
  const latestEntry = growthData[growthData.length - 1]
  
  // Get expected ranges for display
  const expectedRanges = useMemo(() => {
    return getExpectedRanges(childAge, childGender)
  }, [childAge, childGender])

  // Calculate percentiles using actual age-based calculation
  const weightPercentile = useMemo(() => {
    if (!latestEntry) return null
    return calculateAgeBasedPercentile(latestEntry.weight, 'weight', childAge, childGender)
  }, [latestEntry, childAge, childGender])
  
  const heightPercentile = useMemo(() => {
    if (!latestEntry) return null
    return calculateAgeBasedPercentile(latestEntry.height, 'height', childAge, childGender)
  }, [latestEntry, childAge, childGender])
  
  // Calculate BMI with percentile
  const bmiData = useMemo(() => {
    if (!latestEntry) return null
    return calculateBMIWithPercentile(latestEntry.weight, latestEntry.height, childAge, childGender)
  }, [latestEntry, childAge, childGender])

  const handleAddEntry = () => {
    if (!newEntry.weight || !newEntry.height || !selectedChild) return
    
    const weight = parseFloat(newEntry.weight)
    const height = parseFloat(newEntry.height)
    
    // Validate measurement
    const validation = validateMeasurement(weight, height, childAge, childGender)
    
    const entry: GrowthEntry = {
      id: Date.now().toString(),
      date: new Date(),
      weight,
      height,
      headCircumference: newEntry.headCircumference ? parseFloat(newEntry.headCircumference) : undefined,
    }
    
    if (!validation.valid) {
      // Show warning modal
      setValidationWarnings(validation.warnings)
      setPendingEntry(entry)
      setShowValidationModal(true)
      return
    }
    
    // Valid entry, save directly
    saveEntry(entry)
  }
  
  const saveEntry = (entry: GrowthEntry) => {
    setGrowthData(prev => [...prev, entry])
    setNewEntry({ weight: '', height: '', headCircumference: '' })
    setShowAddEntry(false)
    setShowValidationModal(false)
    setPendingEntry(null)
    setValidationWarnings([])
  }

  // Chart dimensions
  const chartWidth = 100
  const chartHeight = 60
  const padding = 8

  const getChartPoints = (data: GrowthEntry[], field: 'weight' | 'height') => {
    if (data.length < 2) return ''
    
    // Use expected range for y-axis scale, not just data range
    const p5 = field === 'weight' ? expectedRanges.weight_5 : expectedRanges.height_5
    const p95 = field === 'weight' ? expectedRanges.weight_95 : expectedRanges.height_95
    const minVal = p5 * 0.8
    const maxVal = p95 * 1.1
    const range = maxVal - minVal || 1
    
    return data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding)
      const val = field === 'weight' ? d.weight : d.height
      const y = chartHeight - padding - ((val - minVal) / range) * (chartHeight - 2 * padding)
      return `${x},${y}`
    }).join(' ')
  }
  
  // Get normal range band coordinates for chart
  const getNormalRangeBand = (field: 'weight' | 'height') => {
    const p5 = field === 'weight' ? expectedRanges.weight_5 : expectedRanges.height_5
    const p95 = field === 'weight' ? expectedRanges.weight_95 : expectedRanges.height_95
    const minVal = p5 * 0.8
    const maxVal = p95 * 1.1
    const range = maxVal - minVal || 1
    
    const y5 = chartHeight - padding - ((p5 - minVal) / range) * (chartHeight - 2 * padding)
    const y95 = chartHeight - padding - ((p95 - minVal) / range) * (chartHeight - 2 * padding)
    
    return { y5, y95 }
  }
  
  // Check if current values are critically off
  const hasCriticalWarning = weightPercentile?.status === 'critical_low' || 
    weightPercentile?.status === 'critical_high' ||
    heightPercentile?.status === 'critical_low' || 
    heightPercentile?.status === 'critical_high'

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Ruler className="w-16 h-16 text-surface-600 dark:text-surface-300 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Child Selected</h2>
        <p className="text-surface-600 dark:text-surface-400">Select a child to track growth</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Growth Charts</h1>
          <p className="text-surface-600 dark:text-surface-400">
            Track {selectedChild.name}'s height and weight • Age: {childAge} years • {childGender === 'female' ? 'Female' : 'Male'}
          </p>
        </div>
        <Button onClick={() => setShowAddEntry(true)} icon={<Plus className="w-4 h-4" />} className="bg-gradient-to-r from-cyan-500 to-teal-600">
          Add Measurement
        </Button>
      </div>
      
      {/* Critical Warning Banner */}
      {hasCriticalWarning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-red-800 dark:text-red-200">Growth Data Warning</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                The recorded measurements appear significantly outside the normal range for a {childAge}-year-old {childGender}.
                Please verify the data is correct or consult with your pediatrician.
              </p>
              {weightPercentile?.status === 'critical_low' && (
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  • Weight ({latestEntry?.weight} lbs) is critically low. Expected range: {expectedRanges.weight_5}-{expectedRanges.weight_95} lbs
                </p>
              )}
              {heightPercentile?.status === 'critical_low' && (
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  • Height ({latestEntry?.height}") is critically low. Expected range: {expectedRanges.height_5}-{expectedRanges.height_95}"
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Expected Ranges Info */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-blue-800 dark:text-blue-200">
              Expected ranges for {childAge}-year-old {childGender}:
            </span>
            <span className="text-blue-700 dark:text-blue-300 ml-2">
              Weight: {expectedRanges.weight_5}-{expectedRanges.weight_95} lbs • 
              Height: {expectedRanges.height_5}-{expectedRanges.height_95}"
            </span>
          </div>
        </div>
      </Card>

      {/* Current Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
              <Scale className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-sm text-surface-500">Weight</div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">
                {latestEntry?.weight || '--'} lbs
              </div>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <Ruler className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-sm text-surface-500">Height</div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">
                {latestEntry?.height || '--'}"
              </div>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              weightPercentile?.status === 'normal' 
                ? 'bg-emerald-100 dark:bg-emerald-900/50' 
                : weightPercentile?.status === 'critical_low' || weightPercentile?.status === 'critical_high'
                ? 'bg-red-100 dark:bg-red-900/50'
                : 'bg-amber-100 dark:bg-amber-900/50'
            }`}>
              <TrendingUp className={`w-6 h-6 ${
                weightPercentile?.status === 'normal' 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : weightPercentile?.status === 'critical_low' || weightPercentile?.status === 'critical_high'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`} />
            </div>
            <div>
              <div className="text-sm text-surface-500">Weight %ile</div>
              <div className={`text-2xl font-bold ${
                weightPercentile?.status === 'critical_low' || weightPercentile?.status === 'critical_high'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-surface-900 dark:text-white'
              }`}>
                {weightPercentile?.percentile || '--'}th
              </div>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              heightPercentile?.status === 'normal' 
                ? 'bg-emerald-100 dark:bg-emerald-900/50' 
                : heightPercentile?.status === 'critical_low' || heightPercentile?.status === 'critical_high'
                ? 'bg-red-100 dark:bg-red-900/50'
                : 'bg-amber-100 dark:bg-amber-900/50'
            }`}>
              <TrendingUp className={`w-6 h-6 ${
                heightPercentile?.status === 'normal' 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : heightPercentile?.status === 'critical_low' || heightPercentile?.status === 'critical_high'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`} />
            </div>
            <div>
              <div className="text-sm text-surface-500">Height %ile</div>
              <div className={`text-2xl font-bold ${
                heightPercentile?.status === 'critical_low' || heightPercentile?.status === 'critical_high'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-surface-900 dark:text-white'
              }`}>
                {heightPercentile?.percentile || '--'}th
              </div>
            </div>
          </div>
        </Card>
        
        {/* BMI Card - NEW */}
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              bmiData?.status === 'healthy' 
                ? 'bg-emerald-100 dark:bg-emerald-900/50' 
                : bmiData?.status === 'underweight' || bmiData?.status === 'obese'
                ? 'bg-red-100 dark:bg-red-900/50'
                : 'bg-amber-100 dark:bg-amber-900/50'
            }`}>
              <Activity className={`w-6 h-6 ${
                bmiData?.status === 'healthy' 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : bmiData?.status === 'underweight' || bmiData?.status === 'obese'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`} />
            </div>
            <div>
              <div className="text-sm text-surface-500">BMI</div>
              <div className={`text-2xl font-bold ${
                bmiData?.status === 'underweight' || bmiData?.status === 'obese'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-surface-900 dark:text-white'
              }`}>
                {bmiData?.bmi.toFixed(1) || '--'}
              </div>
              <div className={`text-xs ${
                bmiData?.status === 'healthy' 
                  ? 'text-emerald-600' 
                  : bmiData?.status === 'underweight' || bmiData?.status === 'obese'
                  ? 'text-red-600'
                  : 'text-amber-600'
              }`}>
                {bmiData?.status || ''}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Growth Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Growth Over Time</CardTitle>
            <div className="flex rounded-lg bg-surface-100 dark:bg-surface-800 p-1">
              <button
                onClick={() => setActiveTab('weight')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'weight'
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-600 dark:text-surface-400'
                }`}
              >
                Weight
              </button>
              <button
                onClick={() => setActiveTab('height')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'height'
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-600 dark:text-surface-400'
                }`}
              >
                Height
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Chart */}
          <div className="h-64 bg-surface-50 dark:bg-surface-800 rounded-xl p-4 relative">
            {growthData.length >= 2 ? (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                {/* Normal Range Band (5th-95th percentile) */}
                {(() => {
                  const { y5, y95 } = getNormalRangeBand(activeTab)
                  return (
                    <rect
                      x={padding}
                      y={Math.min(y5, y95)}
                      width={chartWidth - 2 * padding}
                      height={Math.abs(y5 - y95)}
                      fill="#10b981"
                      fillOpacity="0.15"
                      rx="2"
                    />
                  )
                })()}
                
                {/* 50th Percentile Line (Expected Median) */}
                {(() => {
                  const p50 = activeTab === 'weight' ? expectedRanges.weight_50 : expectedRanges.height_50
                  const p5 = activeTab === 'weight' ? expectedRanges.weight_5 : expectedRanges.height_5
                  const p95 = activeTab === 'weight' ? expectedRanges.weight_95 : expectedRanges.height_95
                  const minVal = p5 * 0.8
                  const maxVal = p95 * 1.1
                  const range = maxVal - minVal || 1
                  const y50 = chartHeight - padding - ((p50 - minVal) / range) * (chartHeight - 2 * padding)
                  
                  return (
                    <line
                      x1={padding}
                      y1={y50}
                      x2={chartWidth - padding}
                      y2={y50}
                      stroke="#10b981"
                      strokeWidth="0.5"
                      strokeDasharray="2,2"
                      opacity="0.6"
                    />
                  )
                })()}
                
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((p, i) => (
                  <line
                    key={p}
                    x1={padding}
                    y1={padding + (i * (chartHeight - 2 * padding)) / 4}
                    x2={chartWidth - padding}
                    y2={padding + (i * (chartHeight - 2 * padding)) / 4}
                    stroke="currentColor"
                    strokeWidth="0.2"
                    className="text-surface-600 dark:text-surface-300"
                  />
                ))}
                
                {/* Data line */}
                <polyline
                  points={getChartPoints(growthData, activeTab)}
                  fill="none"
                  stroke="url(#growthGradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Data points */}
                {growthData.map((d, i) => {
                  const p5 = activeTab === 'weight' ? expectedRanges.weight_5 : expectedRanges.height_5
                  const p95 = activeTab === 'weight' ? expectedRanges.weight_95 : expectedRanges.height_95
                  const minVal = p5 * 0.8
                  const maxVal = p95 * 1.1
                  const range = maxVal - minVal || 1
                  const val = activeTab === 'weight' ? d.weight : d.height
                  const x = padding + (i / (growthData.length - 1)) * (chartWidth - 2 * padding)
                  const y = chartHeight - padding - ((val - minVal) / range) * (chartHeight - 2 * padding)
                  
                  // Color based on whether value is in normal range
                  const isNormal = val >= p5 && val <= p95
                  
                  return (
                    <circle
                      key={d.id}
                      cx={x}
                      cy={y}
                      r="2"
                      className={isNormal ? 'fill-cyan-500' : 'fill-red-500'}
                    />
                  )
                })}
                
                <defs>
                  <linearGradient id="growthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                </defs>
              </svg>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 text-surface-300 mx-auto mb-2" />
                  <p className="text-surface-500">Add more measurements to see growth chart</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <span className="text-surface-600 dark:text-surface-400">{selectedChild.name}'s {activeTab}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-3 rounded bg-emerald-500/20" />
              <span className="text-surface-600 dark:text-surface-400">Normal Range (5th-95th)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-emerald-500 border-dashed border-emerald-500" style={{ borderStyle: 'dashed' }} />
              <span className="text-surface-600 dark:text-surface-400">50th Percentile</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Percentile Info */}
      <Card className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-cyan-800 dark:text-cyan-200">Understanding Percentiles</h4>
            <p className="text-sm text-cyan-700 dark:text-cyan-300 mt-1">
              Percentiles compare your child's measurements to others of the same age and sex. 
              A 50th percentile means your child is average. Being above or below average is usually 
              normal - what matters most is consistent growth over time.
            </p>
          </div>
        </div>
      </Card>

      {/* Measurement History */}
      <Card>
        <CardHeader>
          <CardTitle>Measurement History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...growthData].reverse().map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-800"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-surface-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-surface-900 dark:text-white">
                      {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {i === 0 && <Badge variant="primary" size="sm">Latest</Badge>}
                  </div>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <div className="text-sm text-surface-500">Weight</div>
                    <div className="font-bold text-surface-900 dark:text-white">{entry.weight} lbs</div>
                  </div>
                  <div>
                    <div className="text-sm text-surface-500">Height</div>
                    <div className="font-bold text-surface-900 dark:text-white">{entry.height}"</div>
                  </div>
                  {entry.headCircumference && (
                    <div>
                      <div className="text-sm text-surface-500">Head</div>
                      <div className="font-bold text-surface-900 dark:text-white">{entry.headCircumference}"</div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Entry Modal */}
      {showAddEntry && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddEntry(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Add Measurement</CardTitle>
                  <button onClick={() => setShowAddEntry(false)} className="text-surface-400 hover:text-surface-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Expected Range Hint */}
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <span className="font-medium">Expected for {selectedChild.name} ({childAge}yo {childGender}):</span>
                      <br />
                      Weight: {expectedRanges.weight_5}-{expectedRanges.weight_95} lbs
                      <br />
                      Height: {expectedRanges.height_5}-{expectedRanges.height_95}"
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newEntry.weight}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder={`e.g., ${expectedRanges.weight_50}`}
                    className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Height (inches)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={newEntry.height}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, height: e.target.value }))}
                    placeholder={`e.g., ${expectedRanges.height_50}`}
                    className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Head Circumference (inches) - Optional
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newEntry.headCircumference}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, headCircumference: e.target.value }))}
                    placeholder="e.g., 19.2"
                    className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setShowAddEntry(false)} fullWidth>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddEntry}
                    disabled={!newEntry.weight || !newEntry.height}
                    fullWidth
                    className="bg-gradient-to-r from-cyan-500 to-teal-600"
                  >
                    Save Measurement
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
      
      {/* Validation Warning Modal */}
      <AnimatePresence>
        {showValidationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowValidationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card className="border-2 border-amber-400 dark:border-amber-600">
                <CardHeader className="bg-amber-50 dark:bg-amber-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-amber-800 dark:text-amber-200">Data Validation Warning</CardTitle>
                      <p className="text-sm text-amber-600 dark:text-amber-400">Please verify this measurement</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    {validationWarnings.map((warning, i) => (
                      <div key={i} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm text-amber-800 dark:text-amber-200">{warning}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
                    <p className="text-sm text-surface-600 dark:text-surface-400">
                      <strong>You entered:</strong><br />
                      Weight: {pendingEntry?.weight} lbs<br />
                      Height: {pendingEntry?.height}"
                    </p>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        setShowValidationModal(false)
                        setPendingEntry(null)
                      }} 
                      fullWidth
                    >
                      Go Back & Edit
                    </Button>
                    <Button 
                      onClick={() => pendingEntry && saveEntry(pendingEntry)}
                      fullWidth
                      className="bg-amber-500 hover:bg-amber-600"
                    >
                      Save Anyway
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
