'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  Pill,
  AlertTriangle,
  Info,
  Calculator,
  ChevronDown,
  ChevronRight,
  Clock,
  Shield,
  Droplets,
  User,
  CheckCircle,
  X,
  Zap,
  Package,
  Syringe,
  Timer,
  AlertCircle,
  Plus,
  History,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore from '@/store/useStore'
import { calculateAge } from '@/lib/utils'
import Link from 'next/link'

// Enhanced medication data with detailed formulations
const medications = {
  acetaminophen: {
    name: 'Acetaminophen (Tylenol)',
    brandNames: ['Tylenol', 'FeverAll', 'Panadol'],
    uses: ['Fever reduction', 'Pain relief'],
    dosePerKg: { min: 10, max: 15 },
    maxDosesPerDay: 5,
    minHoursBetween: 4,
    maxDailyMg: 75, // per kg
    frequency: 'Every 4-6 hours as needed',
    ageRestriction: 'Consult doctor for infants under 3 months',
    minAgeMonths: 0,
    formulations: [
      {
        id: 'tylenol_infant_drops',
        name: 'Infant Drops',
        brand: 'Tylenol Infants',
        concentration: 160,
        perMl: 5,
        type: 'liquid',
        icon: '💧',
        description: '160 mg per 5 mL',
        maxMl: 5,
        forAge: '0-2 years',
      },
      {
        id: 'tylenol_liquid',
        name: "Children's Liquid",
        brand: "Children's Tylenol",
        concentration: 160,
        perMl: 5,
        type: 'liquid',
        icon: '🧴',
        description: '160 mg per 5 mL',
        maxMl: 15,
        forAge: '2-11 years',
      },
      {
        id: 'tylenol_chewable',
        name: 'Chewable Tablets',
        brand: "Children's Tylenol",
        concentration: 160,
        perUnit: 1,
        type: 'tablet',
        icon: '💊',
        description: '160 mg per tablet',
        forAge: '2-11 years',
      },
      {
        id: 'tylenol_junior',
        name: 'Junior Strength',
        brand: 'Tylenol Junior',
        concentration: 325,
        perUnit: 1,
        type: 'tablet',
        icon: '💊',
        description: '325 mg per tablet',
        forAge: '6+ years',
      },
    ],
    warnings: [
      'Do not exceed 5 doses in 24 hours',
      'Many cold/flu medicines contain acetaminophen - check all labels',
      'Can cause liver damage in overdose',
    ],
    color: 'purple',
  },
  ibuprofen: {
    name: 'Ibuprofen (Advil/Motrin)',
    brandNames: ['Advil', 'Motrin', 'Nuprin'],
    uses: ['Fever reduction', 'Pain relief', 'Inflammation'],
    dosePerKg: { min: 5, max: 10 },
    maxDosesPerDay: 4,
    minHoursBetween: 6,
    maxDailyMg: 40, // per kg
    frequency: 'Every 6-8 hours as needed',
    ageRestriction: 'NOT for infants under 6 months',
    minAgeMonths: 6,
    formulations: [
      {
        id: 'advil_infant_drops',
        name: 'Infant Drops',
        brand: 'Infant Advil',
        concentration: 50,
        perMl: 1.25,
        type: 'liquid',
        icon: '💧',
        description: '50 mg per 1.25 mL',
        maxMl: 2.5,
        forAge: '6-23 months',
      },
      {
        id: 'motrin_liquid',
        name: "Children's Liquid",
        brand: "Children's Motrin",
        concentration: 100,
        perMl: 5,
        type: 'liquid',
        icon: '🧴',
        description: '100 mg per 5 mL',
        maxMl: 15,
        forAge: '2-11 years',
      },
      {
        id: 'advil_chewable',
        name: 'Chewable Tablets',
        brand: "Children's Advil",
        concentration: 50,
        perUnit: 1,
        type: 'tablet',
        icon: '💊',
        description: '50 mg per tablet',
        forAge: '2-11 years',
      },
      {
        id: 'advil_junior',
        name: 'Junior Strength',
        brand: 'Junior Advil',
        concentration: 100,
        perUnit: 1,
        type: 'tablet',
        icon: '💊',
        description: '100 mg per tablet',
        forAge: '6+ years',
      },
    ],
    warnings: [
      'NOT for infants under 6 months',
      'Give with food to prevent stomach upset',
      'Do not use if child is dehydrated',
      'Avoid in children with kidney problems',
    ],
    color: 'orange',
  },
  diphenhydramine: {
    name: 'Diphenhydramine (Benadryl)',
    brandNames: ['Benadryl', 'Banophen'],
    uses: ['Allergic reactions', 'Itching', 'Hives'],
    dosePerKg: { min: 1, max: 1.25 },
    maxDosesPerDay: 4,
    minHoursBetween: 6,
    maxDailyMg: 5, // per kg
    frequency: 'Every 6 hours as needed',
    ageRestriction: 'NOT for children under 2 years without doctor approval',
    minAgeMonths: 24,
    formulations: [
      {
        id: 'benadryl_liquid',
        name: "Children's Liquid",
        brand: "Children's Benadryl",
        concentration: 12.5,
        perMl: 5,
        type: 'liquid',
        icon: '🧴',
        description: '12.5 mg per 5 mL',
        maxMl: 20,
        forAge: '2-11 years',
      },
      {
        id: 'benadryl_chewable',
        name: 'Chewable Tablets',
        brand: "Children's Benadryl",
        concentration: 12.5,
        perUnit: 1,
        type: 'tablet',
        icon: '💊',
        description: '12.5 mg per tablet',
        forAge: '2-11 years',
      },
    ],
    warnings: [
      'Causes drowsiness',
      'NOT for children under 2 years without doctor approval',
      'Do not use to make child sleepy',
      'Can cause excitability in some children',
    ],
    color: 'pink',
  },
}

type MedicationType = keyof typeof medications

interface DoseResult {
  minDoseMg: number
  maxDoseMg: number
  recommendedMg: number
  liquidMl: number
  liquidAmount: string
  tabletCount: number
  tabletAmount: string
  frequency: string
  maxDailyDoses: number
  formulationType: 'liquid' | 'tablet'
}

export default function DosageCalculatorPage() {
  const { selectedChild, doseLogs, addDoseLog, medications: storedMedications } = useStore()
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs')
  const [weight, setWeight] = useState<string>('')
  const [selectedMed, setSelectedMed] = useState<MedicationType | null>(null)
  const [selectedFormulation, setSelectedFormulation] = useState<number>(0)
  const [expandedWarnings, setExpandedWarnings] = useState(false)
  const [showRecentDoseWarning, setShowRecentDoseWarning] = useState(false)
  const [recentDoseInfo, setRecentDoseInfo] = useState<{ time: Date; hoursAgo: number; nextSafeTime: Date } | null>(null)
  const [doseLogged, setDoseLogged] = useState(false)

  // Auto-populate weight from profile
  const profileWeight = selectedChild?.weight_lbs
  const useProfileWeight = () => {
    if (profileWeight) {
      setWeight(profileWeight.toString())
      setWeightUnit('lbs')
    }
  }

  // Child age for age-appropriate formulation filtering
  const childAgeMonths = useMemo(() => {
    if (!selectedChild?.date_of_birth) return 72
    const dob = new Date(selectedChild.date_of_birth)
    const now = new Date()
    return (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth())
  }, [selectedChild])

  const childAgeYears = useMemo(() => {
    if (!selectedChild?.date_of_birth) return 6
    return calculateAge(selectedChild.date_of_birth)
  }, [selectedChild])

  // Convert weight to kg
  const weightKg = useMemo(() => {
    const w = parseFloat(weight) || 0
    return weightUnit === 'lbs' ? w / 2.205 : w
  }, [weight, weightUnit])

  // Check for recent doses of this medication (Double-Dose Prevention)
  const lastDoseOfMed = useMemo(() => {
    if (!selectedMed || !selectedChild) return null

    // Check dose logs for this medication
    const medName = medications[selectedMed].name.toLowerCase()
    const recentDoses = doseLogs
      .filter(log => {
        const logMedName = log.medication?.toLowerCase() || ''
        return (
          log.child_id === selectedChild.id &&
          (logMedName.includes('tylenol') || logMedName.includes('acetaminophen')
            ? selectedMed === 'acetaminophen'
            : logMedName.includes('advil') || logMedName.includes('motrin') || logMedName.includes('ibuprofen')
              ? selectedMed === 'ibuprofen'
              : logMedName.includes('benadryl') || logMedName.includes('diphenhydramine')
                ? selectedMed === 'diphenhydramine'
                : false
          )
        )
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return recentDoses[0] || null
  }, [selectedMed, selectedChild, doseLogs])

  // Calculate time until next safe dose
  const nextSafeDose = useMemo(() => {
    if (!lastDoseOfMed || !selectedMed) return null

    const lastDoseTime = new Date(lastDoseOfMed.timestamp)
    const minHours = medications[selectedMed].minHoursBetween
    const nextSafeTime = new Date(lastDoseTime.getTime() + minHours * 60 * 60 * 1000)
    const now = new Date()
    const hoursAgo = (now.getTime() - lastDoseTime.getTime()) / (1000 * 60 * 60)
    const hoursTillSafe = (nextSafeTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    return {
      lastDoseTime,
      hoursAgo,
      nextSafeTime,
      hoursTillSafe,
      isSafeNow: hoursTillSafe <= 0,
    }
  }, [lastDoseOfMed, selectedMed])

  // Check for warning when medication changes
  useEffect(() => {
    if (nextSafeDose && !nextSafeDose.isSafeNow) {
      setShowRecentDoseWarning(true)
      setRecentDoseInfo({
        time: nextSafeDose.lastDoseTime,
        hoursAgo: nextSafeDose.hoursAgo,
        nextSafeTime: nextSafeDose.nextSafeTime,
      })
    } else {
      setShowRecentDoseWarning(false)
      setRecentDoseInfo(null)
    }
  }, [nextSafeDose])

  // Calculate dose
  const doseResult = useMemo((): DoseResult | null => {
    if (!selectedMed || !weight || weightKg <= 0) return null

    const med = medications[selectedMed]
    const form = med.formulations[selectedFormulation]

    const minDoseMg = Math.round(weightKg * med.dosePerKg.min)
    const maxDoseMg = Math.round(weightKg * med.dosePerKg.max)
    const recommendedMg = Math.round((minDoseMg + maxDoseMg) / 2)

    // Calculate liquid amount (mL)
    const liquidMl = form.perMl ? (recommendedMg / form.concentration) * form.perMl : 0

    // Calculate tablet amount
    const tabletCount = form.perUnit ? recommendedMg / form.concentration : 0

    return {
      minDoseMg,
      maxDoseMg,
      recommendedMg,
      liquidMl,
      liquidAmount: liquidMl > 0 ? `${liquidMl.toFixed(1)} mL` : 'N/A',
      tabletCount,
      tabletAmount: tabletCount > 0 ? `${Math.round(tabletCount * 2) / 2}` : 'N/A', // Round to nearest 0.5
      frequency: med.frequency,
      maxDailyDoses: med.maxDosesPerDay,
      formulationType: form.type as 'liquid' | 'tablet',
    }
  }, [selectedMed, weight, weightKg, selectedFormulation])

  // Log the calculated dose
  const handleLogDose = () => {
    if (!selectedChild || !selectedMed || !doseResult) return

    const med = medications[selectedMed]
    const form = med.formulations[selectedFormulation]

    addDoseLog({
      id: `dose_${Date.now()}`,
      medicationId: selectedMed,
      child_id: selectedChild.id,
      medication: `${form.brand} ${form.name}`,
      medication_name: `${form.brand} ${form.name}`,
      dosage: form.type === 'liquid'
        ? `${doseResult.liquidAmount}`
        : `${doseResult.tabletAmount} tablet(s)`,
      dosage_mg: doseResult.recommendedMg,
      timestamp: new Date().toISOString(),
    })

    setDoseLogged(true)
    setTimeout(() => setDoseLogged(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex items-start gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            Always confirm dosing with your pediatrician or pharmacist
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            This calculator is for reference only. When in doubt, contact your healthcare provider.
            Never exceed recommended doses.
          </p>
        </div>
      </motion.div>

      {/* Recent Dose Warning Modal */}
      <AnimatePresence>
        {showRecentDoseWarning && recentDoseInfo && selectedMed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                <Timer className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-red-800 dark:text-red-200 text-lg">
                  ⚠️ Recent Dose Detected
                </h4>
                <p className="text-red-700 dark:text-red-300 mt-1">
                  {selectedChild?.name} had <strong>{medications[selectedMed].name}</strong> {recentDoseInfo.hoursAgo.toFixed(1)} hours ago.
                </p>
                <div className="mt-3 p-3 rounded-lg bg-white dark:bg-surface-800">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-600 dark:text-surface-400">Next safe dose:</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {recentDoseInfo.nextSafeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-surface-500">
                    Wait {(medications[selectedMed].minHoursBetween - recentDoseInfo.hoursAgo).toFixed(1)} more hours before next dose
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowRecentDoseWarning(false)}
                  >
                    I understand, continue
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedMed(null)}
                  >
                    Choose different medication
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setShowRecentDoseWarning(false)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dose Logged Success Toast */}
      <AnimatePresence>
        {doseLogged && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-emerald-500 text-white shadow-lg flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Dose logged to {selectedChild?.name}'s record!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weight Input with Smart Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Child's Weight
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* One-Tap Profile Weight */}
          {profileWeight && !weight && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={useProfileWeight}
              className="w-full p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/30 dark:to-teal-900/30 border-2 border-cyan-300 dark:border-cyan-700 hover:border-cyan-400 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                  <User className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-cyan-800 dark:text-cyan-200">
                    Use {selectedChild?.name}'s Weight
                  </div>
                  <div className="text-sm text-cyan-600 dark:text-cyan-400">
                    {profileWeight} lbs • from profile
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform">
                <Zap className="w-4 h-4" />
                <span className="font-medium">One-Tap</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.button>
          )}

          {/* Weight already filled from profile */}
          {weight && profileWeight && weight === profileWeight.toString() && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 text-sm">
              <CheckCircle className="w-4 h-4" />
              Using {selectedChild?.name}'s weight from profile
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={profileWeight ? `Or enter different weight` : "Enter weight"}
                className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-lg placeholder-surface-500 focus:border-cyan-500 focus:outline-none"
              />
              {weight && (
                <button
                  onClick={() => setWeight('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700">
              <button
                onClick={() => setWeightUnit('lbs')}
                className={`px-4 py-3 font-medium transition-colors ${weightUnit === 'lbs'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                  }`}
              >
                lbs
              </button>
              <button
                onClick={() => setWeightUnit('kg')}
                className={`px-4 py-3 font-medium transition-colors ${weightUnit === 'kg'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                  }`}
              >
                kg
              </button>
            </div>
          </div>
          {weight && (
            <p className="text-sm text-surface-500">
              {weightUnit === 'lbs'
                ? `= ${weightKg.toFixed(1)} kg`
                : `= ${(weightKg * 2.205).toFixed(1)} lbs`
              }
            </p>
          )}

          {/* Missing weight prompt */}
          {!profileWeight && !weight && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  {selectedChild ? `Add ${selectedChild.name}'s weight to their profile for one-tap access` : 'Select a child and add their weight for one-tap dosage calculation'}
                </span>
              </div>
              <Link href="/dashboard/children">
                <Button size="sm" variant="secondary">Update Profile</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medication Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Select Medication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {(Object.entries(medications) as [MedicationType, typeof medications.acetaminophen][]).map(([key, med]) => {
              const isAgeAppropriate = childAgeMonths >= med.minAgeMonths

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedMed(key)
                    setSelectedFormulation(0)
                    setDoseLogged(false)
                  }}
                  disabled={!isAgeAppropriate}
                  className={`p-4 rounded-xl text-left transition-all relative ${selectedMed === key
                      ? 'bg-cyan-50 dark:bg-cyan-900/30 border-2 border-cyan-500'
                      : isAgeAppropriate
                        ? 'bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 hover:border-cyan-300 dark:hover:border-cyan-700'
                        : 'bg-surface-100 dark:bg-surface-800/30 border border-surface-200 dark:border-surface-700 opacity-50 cursor-not-allowed'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                        {med.name}
                        {!isAgeAppropriate && (
                          <Badge variant="danger" size="sm">Not for {childAgeYears}yo</Badge>
                        )}
                      </div>
                      <div className="text-sm text-surface-500 mt-1">
                        {med.uses.join(' • ')}
                      </div>
                      <div className="text-xs text-surface-400 mt-1">
                        Brands: {med.brandNames.join(', ')}
                      </div>
                    </div>
                    {selectedMed === key ? (
                      <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-surface-300 dark:border-surface-600" />
                    )}
                  </div>
                  <div className={`mt-2 text-xs ${isAgeAppropriate ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    ⚠️ {med.ageRestriction}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Medicine Cabinet - Formulation Picker */}
      {selectedMed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-violet-800 dark:text-violet-200">
                <Package className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                Which bottle do you have?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-violet-700 dark:text-violet-300 mb-4">
                Select the product from your medicine cabinet to get the exact measurement
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {medications[selectedMed].formulations.map((form, index) => (
                  <button
                    key={form.id}
                    onClick={() => setSelectedFormulation(index)}
                    className={`p-4 rounded-xl text-left transition-all ${selectedFormulation === index
                        ? 'bg-white dark:bg-surface-800 border-2 border-violet-500 shadow-lg ring-2 ring-violet-200 dark:ring-violet-800'
                        : 'bg-white/50 dark:bg-surface-800/50 border border-violet-200 dark:border-violet-700 hover:border-violet-400'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{form.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-surface-900 dark:text-white">
                          {form.brand}
                        </div>
                        <div className="text-sm text-violet-700 dark:text-violet-300">
                          {form.name}
                        </div>
                        <div className="text-xs text-surface-500 mt-1">
                          {form.description}
                        </div>
                        <Badge variant="info" size="sm" className="mt-2">
                          {form.forAge}
                        </Badge>
                      </div>
                      {selectedFormulation === index && (
                        <CheckCircle className="w-5 h-5 text-violet-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Dosing Result */}
      {doseResult && selectedMed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Calculated Dose for {selectedChild?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visual Dose Display - THE HERO */}
              <div className="p-6 rounded-xl bg-white dark:bg-surface-800 border border-emerald-200 dark:border-emerald-700 text-center">
                {doseResult.formulationType === 'liquid' ? (
                  <>
                    {/* Syringe Visualization */}
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <div className="relative">
                        {/* Syringe body */}
                        <div className="w-20 h-48 rounded-lg border-4 border-cyan-400 bg-gradient-to-t from-cyan-400 to-transparent relative overflow-hidden">
                          {/* Liquid level */}
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500 to-cyan-300 transition-all"
                            style={{ height: `${Math.min(100, (doseResult.liquidMl / 15) * 100)}%` }}
                          />
                          {/* Measurement lines */}
                          <div className="absolute inset-0 flex flex-col justify-between py-2">
                            {[15, 10, 5, 0].map(ml => (
                              <div key={ml} className="flex items-center">
                                <div className="w-3 h-0.5 bg-surface-400" />
                                <span className="text-[10px] text-surface-500 ml-1">{ml}mL</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Syringe tip */}
                        <div className="w-4 h-6 bg-cyan-400 mx-auto -mt-1 rounded-b" />
                      </div>
                      <div className="text-left">
                        <div className="text-6xl font-bold text-emerald-600 dark:text-emerald-400">
                          {doseResult.liquidMl.toFixed(1)}
                        </div>
                        <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                          mL
                        </div>
                      </div>
                    </div>
                    <div className="text-lg text-surface-600 dark:text-surface-400">
                      Fill syringe to <strong>{doseResult.liquidMl.toFixed(1)} mL</strong> line
                    </div>
                  </>
                ) : (
                  <>
                    {/* Tablet Visualization */}
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <div className="flex gap-2">
                        {Array.from({ length: Math.floor(parseFloat(doseResult.tabletAmount)) }).map((_, i) => (
                          <div key={i} className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xl">
                            💊
                          </div>
                        ))}
                        {parseFloat(doseResult.tabletAmount) % 1 >= 0.5 && (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xl overflow-hidden">
                            <div className="w-1/2 h-full bg-surface-300 dark:bg-surface-700" />
                            <span className="absolute">½</span>
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-6xl font-bold text-emerald-600 dark:text-emerald-400">
                          {doseResult.tabletAmount}
                        </div>
                        <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                          tablet{parseFloat(doseResult.tabletAmount) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg text-surface-600 dark:text-surface-400">
                      Give <strong>{doseResult.tabletAmount} tablet{parseFloat(doseResult.tabletAmount) !== 1 ? 's' : ''}</strong>
                    </div>
                  </>
                )}

                <div className="mt-3 text-sm text-surface-500">
                  = {doseResult.recommendedMg} mg ({doseResult.minDoseMg}-{doseResult.maxDoseMg} mg range)
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{medications[selectedMed].formulations[selectedFormulation].icon}</span>
                  <div>
                    <div className="font-semibold text-surface-900 dark:text-white">
                      {medications[selectedMed].formulations[selectedFormulation].brand}
                    </div>
                    <div className="text-sm text-surface-500">
                      {medications[selectedMed].formulations[selectedFormulation].description}
                    </div>
                  </div>
                </div>
              </div>

              {/* Frequency & Next Dose */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-cyan-600" />
                    <span className="font-medium text-surface-900 dark:text-white">Frequency</span>
                  </div>
                  <div className="text-surface-600 dark:text-surface-400">
                    {doseResult.frequency}
                  </div>
                  <div className="text-sm text-surface-500 mt-1">
                    Maximum {doseResult.maxDailyDoses} doses in 24 hours
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="w-5 h-5 text-violet-600" />
                    <span className="font-medium text-surface-900 dark:text-white">Next Safe Dose</span>
                  </div>
                  {nextSafeDose ? (
                    nextSafeDose.isSafeNow ? (
                      <div className="text-emerald-600 font-medium">
                        ✓ Safe to give now
                      </div>
                    ) : (
                      <>
                        <div className="text-amber-600 font-medium">
                          {nextSafeDose.nextSafeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm text-surface-500 mt-1">
                          In {nextSafeDose.hoursTillSafe.toFixed(1)} hours
                        </div>
                      </>
                    )
                  ) : (
                    <div className="text-emerald-600 font-medium">
                      ✓ No recent doses logged
                    </div>
                  )}
                </div>
              </div>

              {/* Log This Dose Button */}
              <div className="flex gap-3">
                <Button
                  fullWidth
                  onClick={handleLogDose}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  icon={<Plus className="w-4 h-4" />}
                >
                  Log This Dose to {selectedChild?.name}'s Record
                </Button>
                <Link href="/dashboard/medications" className="flex-shrink-0">
                  <Button variant="secondary" icon={<History className="w-4 h-4" />}>
                    View History
                  </Button>
                </Link>
              </div>

              {/* Warnings */}
              <div>
                <button
                  onClick={() => setExpandedWarnings(!expandedWarnings)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium text-amber-800 dark:text-amber-200">Important Warnings</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-amber-600 transition-transform ${expandedWarnings ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {expandedWarnings && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-2 px-3"
                    >
                      {medications[selectedMed].warnings.map((warning, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                          <span className="text-amber-500">•</span>
                          {warning}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Disclaimer */}
      <div className="p-4 rounded-xl bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-surface-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-surface-600 dark:text-surface-400">
            <strong>Disclaimer:</strong> This dosage calculator is for reference only and should not replace
            professional medical advice. Always verify dosing with your pediatrician or pharmacist, especially
            for infants or children with medical conditions. Use only the measuring device provided with the medication.
          </div>
        </div>
      </div>
    </div>
  )
}
