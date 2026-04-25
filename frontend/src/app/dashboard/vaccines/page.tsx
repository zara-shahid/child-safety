'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Syringe,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Plus,
  Info,
  Shield,
  X,
  Bell,
  FileText,
  Download,
  AlertTriangle,
  GraduationCap,
  Baby,
  User,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore from '@/store/useStore'
import { calculateAge, calculateAgeInMonths } from '@/lib/utils'

interface VaccineDose {
  doseNumber: number
  recommendedAge: string
  ageMonths: number
  maxCatchUpAgeMonths?: number // After this age, catch-up is NOT recommended
  administered?: Date
  notes?: string
}

interface Vaccine {
  id: string
  name: string
  shortName: string
  description: string
  category: 'infant' | 'childhood' | 'adolescent' | 'annual'
  minAgeMonths: number    // Minimum age to start
  maxAgeMonths?: number   // Maximum age for catch-up (undefined = no limit)
  doses: VaccineDose[]
  schoolRequired?: boolean // Required for school entry
  catchUpNote?: string    // Explanation if catch-up isn't available
}

// CDC-Based Vaccine Schedule with age-appropriate filtering
const vaccineSchedule: Vaccine[] = [
  // === INFANT VACCINES (Series typically completed by age 2) ===
  {
    id: 'hepb',
    name: 'Hepatitis B',
    shortName: 'HepB',
    description: 'Protects against hepatitis B virus infection',
    category: 'infant',
    minAgeMonths: 0,
    maxAgeMonths: undefined, // Catch-up available at any age
    schoolRequired: true,
    doses: [
      { doseNumber: 1, recommendedAge: 'Birth', ageMonths: 0 },
      { doseNumber: 2, recommendedAge: '1-2 months', ageMonths: 1 },
      { doseNumber: 3, recommendedAge: '6-18 months', ageMonths: 6 },
    ],
  },
  {
    id: 'rv',
    name: 'Rotavirus',
    shortName: 'RV',
    description: 'Protects against rotavirus gastroenteritis',
    category: 'infant',
    minAgeMonths: 2,
    maxAgeMonths: 8, // CDC: Do NOT start series after 15 weeks, complete by 8 months
    catchUpNote: 'Rotavirus vaccine cannot be given after 8 months of age. This vaccine is no longer applicable.',
    doses: [
      { doseNumber: 1, recommendedAge: '2 months', ageMonths: 2, maxCatchUpAgeMonths: 4 },
      { doseNumber: 2, recommendedAge: '4 months', ageMonths: 4, maxCatchUpAgeMonths: 8 },
      { doseNumber: 3, recommendedAge: '6 months', ageMonths: 6, maxCatchUpAgeMonths: 8 },
    ],
  },
  {
    id: 'dtap',
    name: 'Diphtheria, Tetanus, Pertussis (DTaP)',
    shortName: 'DTaP',
    description: 'Childhood series - protects against diphtheria, tetanus, and whooping cough',
    category: 'childhood',
    minAgeMonths: 2,
    maxAgeMonths: 84, // DTaP is for children under 7; Tdap replaces it after
    catchUpNote: 'DTaP is for children under 7. After age 7, Tdap is used instead.',
    schoolRequired: true,
    doses: [
      { doseNumber: 1, recommendedAge: '2 months', ageMonths: 2 },
      { doseNumber: 2, recommendedAge: '4 months', ageMonths: 4 },
      { doseNumber: 3, recommendedAge: '6 months', ageMonths: 6 },
      { doseNumber: 4, recommendedAge: '15-18 months', ageMonths: 15 },
      { doseNumber: 5, recommendedAge: '4-6 years', ageMonths: 48, maxCatchUpAgeMonths: 84 },
    ],
  },
  {
    id: 'hib',
    name: 'Haemophilus influenzae type b',
    shortName: 'Hib',
    description: 'Protects against Hib disease including meningitis',
    category: 'infant',
    minAgeMonths: 2,
    maxAgeMonths: 60, // Not routinely given after age 5 for healthy children
    catchUpNote: 'Hib vaccine is not routinely recommended for healthy children over 5 years old.',
    doses: [
      { doseNumber: 1, recommendedAge: '2 months', ageMonths: 2 },
      { doseNumber: 2, recommendedAge: '4 months', ageMonths: 4 },
      { doseNumber: 3, recommendedAge: '6 months', ageMonths: 6, maxCatchUpAgeMonths: 60 },
      { doseNumber: 4, recommendedAge: '12-15 months', ageMonths: 12, maxCatchUpAgeMonths: 60 },
    ],
  },
  {
    id: 'pcv',
    name: 'Pneumococcal Conjugate',
    shortName: 'PCV15/20',
    description: 'Protects against pneumococcal disease',
    category: 'infant',
    minAgeMonths: 2,
    maxAgeMonths: 60, // Not routinely given after age 5 for healthy children
    catchUpNote: 'PCV is not routinely recommended for healthy children over 5 years old.',
    doses: [
      { doseNumber: 1, recommendedAge: '2 months', ageMonths: 2 },
      { doseNumber: 2, recommendedAge: '4 months', ageMonths: 4 },
      { doseNumber: 3, recommendedAge: '6 months', ageMonths: 6, maxCatchUpAgeMonths: 60 },
      { doseNumber: 4, recommendedAge: '12-15 months', ageMonths: 12, maxCatchUpAgeMonths: 60 },
    ],
  },
  {
    id: 'ipv',
    name: 'Polio (IPV)',
    shortName: 'IPV',
    description: 'Protects against polio',
    category: 'childhood',
    minAgeMonths: 2,
    maxAgeMonths: 216, // Can be given through age 18 for catch-up
    schoolRequired: true,
    doses: [
      { doseNumber: 1, recommendedAge: '2 months', ageMonths: 2 },
      { doseNumber: 2, recommendedAge: '4 months', ageMonths: 4 },
      { doseNumber: 3, recommendedAge: '6-18 months', ageMonths: 6 },
      { doseNumber: 4, recommendedAge: '4-6 years', ageMonths: 48 },
    ],
  },
  {
    id: 'mmr',
    name: 'Measles, Mumps, Rubella',
    shortName: 'MMR',
    description: 'Protects against measles, mumps, and rubella',
    category: 'childhood',
    minAgeMonths: 12,
    maxAgeMonths: undefined, // Catch-up available at any age
    schoolRequired: true,
    doses: [
      { doseNumber: 1, recommendedAge: '12-15 months', ageMonths: 12 },
      { doseNumber: 2, recommendedAge: '4-6 years', ageMonths: 48 },
    ],
  },
  {
    id: 'var',
    name: 'Varicella (Chickenpox)',
    shortName: 'VAR',
    description: 'Protects against chickenpox',
    category: 'childhood',
    minAgeMonths: 12,
    maxAgeMonths: undefined, // Catch-up available at any age
    schoolRequired: true,
    doses: [
      { doseNumber: 1, recommendedAge: '12-15 months', ageMonths: 12 },
      { doseNumber: 2, recommendedAge: '4-6 years', ageMonths: 48 },
    ],
  },
  {
    id: 'hepa',
    name: 'Hepatitis A',
    shortName: 'HepA',
    description: 'Protects against hepatitis A virus infection',
    category: 'childhood',
    minAgeMonths: 12,
    maxAgeMonths: undefined, // Catch-up available at any age
    doses: [
      { doseNumber: 1, recommendedAge: '12-23 months', ageMonths: 12 },
      { doseNumber: 2, recommendedAge: '2-3 years', ageMonths: 24 },
    ],
  },
  
  // === ADOLESCENT VACCINES (11-12+ years) ===
  {
    id: 'tdap',
    name: 'Tdap (Tetanus, Diphtheria, Pertussis Booster)',
    shortName: 'Tdap',
    description: 'Adolescent booster for tetanus, diphtheria, and whooping cough - Required for 7th grade entry',
    category: 'adolescent',
    minAgeMonths: 132, // 11 years
    maxAgeMonths: undefined,
    schoolRequired: true,
    doses: [
      { doseNumber: 1, recommendedAge: '11-12 years', ageMonths: 132 },
    ],
  },
  {
    id: 'menacwy',
    name: 'Meningococcal ACWY',
    shortName: 'MenACWY',
    description: 'Protects against meningococcal disease (required for 7th grade and college)',
    category: 'adolescent',
    minAgeMonths: 132, // 11 years
    maxAgeMonths: undefined,
    schoolRequired: true,
    doses: [
      { doseNumber: 1, recommendedAge: '11-12 years', ageMonths: 132 },
      { doseNumber: 2, recommendedAge: '16 years (booster)', ageMonths: 192 },
    ],
  },
  {
    id: 'hpv',
    name: 'Human Papillomavirus (HPV)',
    shortName: 'HPV',
    description: 'Protects against HPV-related cancers - most effective when given at 11-12',
    category: 'adolescent',
    minAgeMonths: 108, // Can start at 9
    maxAgeMonths: 312, // Recommended through age 26
    doses: [
      { doseNumber: 1, recommendedAge: '11-12 years', ageMonths: 132 },
      { doseNumber: 2, recommendedAge: '6-12 months after dose 1', ageMonths: 138 },
    ],
  },
  {
    id: 'menb',
    name: 'Meningococcal B',
    shortName: 'MenB',
    description: 'Additional protection against serogroup B meningococcal disease',
    category: 'adolescent',
    minAgeMonths: 192, // 16 years (based on shared clinical decision-making)
    maxAgeMonths: 276, // Through age 23
    doses: [
      { doseNumber: 1, recommendedAge: '16-23 years', ageMonths: 192 },
      { doseNumber: 2, recommendedAge: '1-6 months after dose 1', ageMonths: 198 },
    ],
  },
  
  // === ANNUAL VACCINES ===
  {
    id: 'flu',
    name: 'Influenza (Flu)',
    shortName: 'Flu',
    description: 'Annual protection against seasonal flu - recommended every year',
    category: 'annual',
    minAgeMonths: 6,
    maxAgeMonths: undefined,
    doses: [
      { doseNumber: 1, recommendedAge: '6+ months (yearly)', ageMonths: 6 },
    ],
  },
  {
    id: 'covid',
    name: 'COVID-19',
    shortName: 'COVID',
    description: 'Protection against COVID-19 - updated vaccine recommended annually',
    category: 'annual',
    minAgeMonths: 6,
    maxAgeMonths: undefined,
    doses: [
      { doseNumber: 1, recommendedAge: '6+ months (yearly)', ageMonths: 6 },
    ],
  },
]

export default function VaccinesPage() {
  const { selectedChild } = useStore()
  const [selectedVaccine, setSelectedVaccine] = useState<Vaccine | null>(null)
  const [showMarkComplete, setShowMarkComplete] = useState<{ vaccineId: string; doseNumber: number } | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'due' | 'completed' | 'upcoming'>('all')

  // Calculate child's age
  const childAgeMonths = selectedChild 
    ? calculateAgeInMonths(selectedChild.date_of_birth)
    : 24
  const childAgeYears = selectedChild 
    ? calculateAge(selectedChild.date_of_birth)
    : 2
    
  // Initialize vaccines with age-appropriate completion status
  const [vaccines, setVaccines] = useState<Vaccine[]>(() => {
    return vaccineSchedule.map(v => ({
      ...v,
      doses: v.doses.map((d) => {
        // For demo: Mark childhood vaccines as complete if child is older
        // Simulate that a 12-year-old has received their childhood vaccines
        const shouldBeComplete = 
          (v.category === 'infant' && childAgeMonths > 24) ||
          (v.category === 'childhood' && d.ageMonths < 72 && childAgeMonths > 72) ||
          (v.id === 'mmr' && d.doseNumber === 1 && childAgeMonths > 24) ||
          (v.id === 'mmr' && d.doseNumber === 2 && childAgeMonths > 72) ||
          (v.id === 'var' && d.doseNumber === 1 && childAgeMonths > 24) ||
          (v.id === 'var' && d.doseNumber === 2 && childAgeMonths > 72) ||
          (v.id === 'hepa' && childAgeMonths > 36) ||
          (v.id === 'ipv' && d.doseNumber <= 4 && childAgeMonths > 72)
        
        return {
          ...d,
          administered: shouldBeComplete 
            ? new Date(Date.now() - (childAgeMonths - d.ageMonths) * 30 * 24 * 60 * 60 * 1000) 
            : undefined,
        }
      }),
    }))
  })
  
  // Filter vaccines by age-appropriateness
  const ageFilteredVaccines = useMemo(() => {
    return vaccines.filter(v => {
      // Always show vaccines where catch-up is still possible
      if (v.maxAgeMonths === undefined || childAgeMonths <= v.maxAgeMonths) {
        return true
      }
      // Show completed vaccines even if child is past catch-up age
      const hasCompletedDoses = v.doses.some(d => d.administered)
      return hasCompletedDoses
    })
  }, [vaccines, childAgeMonths])
  
  // Categorize vaccines for display
  const categorizedVaccines = useMemo(() => {
    const dueNow: Vaccine[] = []
    const upcoming: Vaccine[] = []
    const completed: Vaccine[] = []
    const notApplicable: Vaccine[] = []
    
    ageFilteredVaccines.forEach(vaccine => {
      // Check if this vaccine is still relevant for the child's age
      const isPastCatchUpAge = vaccine.maxAgeMonths !== undefined && childAgeMonths > vaccine.maxAgeMonths
      
      if (isPastCatchUpAge && !vaccine.doses.some(d => d.administered)) {
        notApplicable.push(vaccine)
        return
      }
      
      const allDosesComplete = vaccine.doses.every(d => d.administered)
      const hasDueDoses = vaccine.doses.some(d => {
        if (d.administered) return false
        // Check if dose is due (recommended age passed) AND still eligible for catch-up
        const isDue = d.ageMonths <= childAgeMonths
        const canCatchUp = d.maxCatchUpAgeMonths === undefined || childAgeMonths <= d.maxCatchUpAgeMonths
        return isDue && canCatchUp
      })
      const hasUpcomingDoses = vaccine.doses.some(d => {
        if (d.administered) return false
        return d.ageMonths > childAgeMonths && d.ageMonths <= childAgeMonths + 12
      })
      
      if (allDosesComplete) {
        completed.push(vaccine)
      } else if (hasDueDoses) {
        dueNow.push(vaccine)
      } else if (hasUpcomingDoses) {
        upcoming.push(vaccine)
      } else {
        // Check if it's a future vaccine (adolescent for young children)
        const isAdolescentVaccine = vaccine.category === 'adolescent' && childAgeMonths < vaccine.minAgeMonths
        if (isAdolescentVaccine) {
          upcoming.push(vaccine)
        } else {
          completed.push(vaccine)
        }
      }
    })
    
    return { dueNow, upcoming, completed, notApplicable }
  }, [ageFilteredVaccines, childAgeMonths])

  // Calculate stats based on age-appropriate vaccines only
  const stats = useMemo(() => {
    let totalRelevantDoses = 0
    let completedDoses = 0
    let dueDoses = 0
    let upcomingDoses = 0

    ageFilteredVaccines.forEach(vaccine => {
      // Skip vaccines past catch-up age that weren't received
      const isPastCatchUpAge = vaccine.maxAgeMonths !== undefined && childAgeMonths > vaccine.maxAgeMonths
      if (isPastCatchUpAge && !vaccine.doses.some(d => d.administered)) {
        return
      }
      
      vaccine.doses.forEach(dose => {
        // Only count doses that are still relevant
        const canCatchUp = dose.maxCatchUpAgeMonths === undefined || childAgeMonths <= dose.maxCatchUpAgeMonths
        
        if (dose.administered) {
          totalRelevantDoses++
          completedDoses++
        } else if (dose.ageMonths <= childAgeMonths && canCatchUp) {
          totalRelevantDoses++
          dueDoses++
        } else if (dose.ageMonths <= childAgeMonths + 12) {
          totalRelevantDoses++
          upcomingDoses++
        }
      })
    })

    return { 
      totalDoses: totalRelevantDoses, 
      completedDoses, 
      dueDoses, 
      upcomingDoses,
      percentComplete: totalRelevantDoses > 0 ? Math.round((completedDoses / totalRelevantDoses) * 100) : 100
    }
  }, [ageFilteredVaccines, childAgeMonths])

  const handleMarkComplete = (vaccineId: string, doseNumber: number, date: Date) => {
    setVaccines(prev => prev.map(v => {
      if (v.id === vaccineId) {
        return {
          ...v,
          doses: v.doses.map(d => 
            d.doseNumber === doseNumber 
              ? { ...d, administered: date }
              : d
          ),
        }
      }
      return v
    }))
    setShowMarkComplete(null)
  }

  const getDoseStatus = (vaccine: Vaccine, dose: VaccineDose): 'completed' | 'due' | 'upcoming' | 'future' | 'expired' => {
    if (dose.administered) return 'completed'
    
    // Check if catch-up is still possible
    const canCatchUp = dose.maxCatchUpAgeMonths === undefined || childAgeMonths <= dose.maxCatchUpAgeMonths
    const vaccineCanCatchUp = vaccine.maxAgeMonths === undefined || childAgeMonths <= vaccine.maxAgeMonths
    
    if (!canCatchUp || !vaccineCanCatchUp) return 'expired'
    if (dose.ageMonths <= childAgeMonths) return 'due'
    if (dose.ageMonths <= childAgeMonths + 12) return 'upcoming'
    return 'future'
  }
  
  // Generate school form data
  const generateSchoolFormData = () => {
    const schoolVaccines = vaccines.filter(v => v.schoolRequired)
    return schoolVaccines.map(v => ({
      name: v.name,
      shortName: v.shortName,
      doses: v.doses.map(d => ({
        doseNumber: d.doseNumber,
        administered: d.administered,
        status: getDoseStatus(v, d)
      }))
    }))
  }
  
  // Get category icon
  const getCategoryIcon = (category: Vaccine['category']) => {
    switch (category) {
      case 'infant': return Baby
      case 'childhood': return User
      case 'adolescent': return GraduationCap
      case 'annual': return Calendar
      default: return Syringe
    }
  }

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Syringe className="w-16 h-16 text-surface-600 dark:text-surface-300 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Child Selected</h2>
        <p className="text-surface-600 dark:text-surface-400">Select a child to view vaccination schedule</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Vaccination Schedule</h1>
          <p className="text-surface-600 dark:text-surface-400">
            {selectedChild.name}'s immunizations • Age: {childAgeYears} years old
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            icon={<FileText className="w-4 h-4" />}
            onClick={() => setShowExportModal(true)}
          >
            Export for School
          </Button>
          <Button variant="secondary" icon={<Bell className="w-4 h-4" />}>
            Set Reminders
          </Button>
        </div>
      </div>
      
      {/* Age-Appropriate Info Banner */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-800 dark:text-blue-200">
              {childAgeYears >= 11 ? 'Adolescent Vaccine Schedule' : childAgeYears >= 4 ? 'School-Age Vaccine Schedule' : 'Childhood Vaccine Schedule'}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {childAgeYears >= 11 
                ? `At ${childAgeYears} years old, ${selectedChild.name} should receive Tdap, MenACWY, and HPV vaccines. These are required for 7th grade entry in most states.`
                : childAgeYears >= 4
                  ? `At ${childAgeYears} years old, ${selectedChild.name} should have completed the childhood vaccine series. Check for any catch-up doses needed.`
                  : `Following the CDC recommended schedule for children under 4 years old.`
              }
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">{stats.completedDoses}</div>
              <div className="text-xs text-surface-500">Completed</div>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">{stats.dueDoses}</div>
              <div className="text-xs text-surface-500">Due Now</div>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">{stats.upcomingDoses}</div>
              <div className="text-xs text-surface-500">Upcoming</div>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">
                {stats.percentComplete}%
              </div>
              <div className="text-xs text-surface-500">Complete</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Age-Appropriate Immunization Progress
            </span>
            <span className="text-sm text-surface-500">{stats.completedDoses} of {stats.totalDoses} doses</span>
          </div>
          <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.percentComplete}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Due Now Alert */}
      {stats.dueDoses > 0 && (
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-800 dark:text-red-200">
                {stats.dueDoses} Vaccine{stats.dueDoses > 1 ? 's' : ''} Due Now
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {categorizedVaccines.dueNow.map(v => v.shortName).join(', ')} {stats.dueDoses > 1 ? 'are' : 'is'} recommended for {selectedChild.name}'s age.
                Contact your pediatrician to schedule.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex rounded-lg bg-surface-100 dark:bg-surface-800 p-1 w-fit">
        {[
          { id: 'all', label: 'All' },
          { id: 'due', label: `Due Now (${categorizedVaccines.dueNow.length})` },
          { id: 'upcoming', label: `Upcoming (${categorizedVaccines.upcoming.length})` },
          { id: 'completed', label: `Completed (${categorizedVaccines.completed.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeFilter === tab.id
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                : 'text-surface-600 dark:text-surface-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Due Now Section */}
      {(activeFilter === 'all' || activeFilter === 'due') && categorizedVaccines.dueNow.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Due Now - Action Required
          </h2>
          {categorizedVaccines.dueNow.map((vaccine, i) => {
            const CategoryIcon = getCategoryIcon(vaccine.category)
            const completedCount = vaccine.doses.filter(d => d.administered).length
            
            return (
              <motion.div
                key={vaccine.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-red-500"
                  onClick={() => setSelectedVaccine(vaccine)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                        <Syringe className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-surface-900 dark:text-white">{vaccine.name}</h3>
                        <p className="text-sm text-surface-500">
                          {vaccine.shortName} • {completedCount}/{vaccine.doses.length} doses
                          {vaccine.schoolRequired && <span className="ml-2 text-amber-600">• School Required</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="danger">Due Now</Badge>
                      <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
      
      {/* Upcoming Section */}
      {(activeFilter === 'all' || activeFilter === 'upcoming') && categorizedVaccines.upcoming.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Upcoming Vaccines
          </h2>
          {categorizedVaccines.upcoming.map((vaccine, i) => {
            const CategoryIcon = getCategoryIcon(vaccine.category)
            const completedCount = vaccine.doses.filter(d => d.administered).length
            const nextDose = vaccine.doses.find(d => !d.administered)
            
            return (
              <motion.div
                key={vaccine.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-amber-400"
                  onClick={() => setSelectedVaccine(vaccine)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <CategoryIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-surface-900 dark:text-white">{vaccine.name}</h3>
                        <p className="text-sm text-surface-500">
                          {nextDose ? `Due at ${nextDose.recommendedAge}` : vaccine.description}
                          {vaccine.schoolRequired && <span className="ml-2 text-amber-600">• School Required</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="warning">Upcoming</Badge>
                      <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
      
      {/* Completed Section */}
      {(activeFilter === 'all' || activeFilter === 'completed') && categorizedVaccines.completed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Completed Vaccines
          </h2>
          {categorizedVaccines.completed.map((vaccine, i) => {
            const completedCount = vaccine.doses.filter(d => d.administered).length
            
            return (
              <motion.div
                key={vaccine.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-emerald-500"
                  onClick={() => setSelectedVaccine(vaccine)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-surface-900 dark:text-white">{vaccine.name}</h3>
                        <p className="text-sm text-surface-500">{vaccine.shortName} • {completedCount}/{vaccine.doses.length} doses</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="success">Complete</Badge>
                      <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
      
      {/* Not Applicable Section */}
      {categorizedVaccines.notApplicable.length > 0 && activeFilter === 'all' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-surface-600 dark:text-surface-400 flex items-center gap-2">
            <Info className="w-5 h-5" />
            Not Applicable (Infant Vaccines)
          </h2>
          <Card className="bg-surface-50 dark:bg-surface-800/50">
            <p className="text-sm text-surface-500 mb-3">
              The following vaccines are for infants only and cannot be administered at {childAgeYears} years old:
            </p>
            <div className="flex flex-wrap gap-2">
              {categorizedVaccines.notApplicable.map(v => (
                <Badge key={v.id} variant="secondary">{v.shortName}</Badge>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-cyan-800 dark:text-cyan-200">CDC Age-Appropriate Schedule</h4>
            <p className="text-sm text-cyan-700 dark:text-cyan-300 mt-1">
              This schedule is filtered for {selectedChild.name}'s age ({childAgeYears} years). 
              Infant vaccines that are past the catch-up window are not shown as "overdue."
              Always consult your pediatrician for personalized recommendations.
            </p>
          </div>
        </div>
      </Card>

      {/* Vaccine Detail Modal */}
      {selectedVaccine && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedVaccine(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[80vh] overflow-y-auto"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedVaccine.name}</CardTitle>
                    <p className="text-sm text-surface-500 mt-1">{selectedVaccine.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{selectedVaccine.category}</Badge>
                      {selectedVaccine.schoolRequired && <Badge variant="warning">School Required</Badge>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedVaccine(null)} className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Catch-up note if applicable */}
                {selectedVaccine.catchUpNote && selectedVaccine.maxAgeMonths && childAgeMonths > selectedVaccine.maxAgeMonths && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-700 dark:text-amber-300">{selectedVaccine.catchUpNote}</p>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  {selectedVaccine.doses.map((dose) => {
                    const status = getDoseStatus(selectedVaccine, dose)
                    return (
                      <div 
                        key={dose.doseNumber}
                        className={`p-4 rounded-xl ${
                          status === 'completed' 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20' 
                            : status === 'due'
                              ? 'bg-red-50 dark:bg-red-900/20'
                              : status === 'expired'
                                ? 'bg-surface-100 dark:bg-surface-800 opacity-60'
                                : 'bg-surface-50 dark:bg-surface-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              status === 'completed'
                                ? 'bg-emerald-500 text-white'
                                : status === 'due'
                                  ? 'bg-red-500 text-white'
                                  : status === 'expired'
                                    ? 'bg-surface-300 text-surface-500'
                                    : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                            }`}>
                              {status === 'completed' ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : status === 'expired' ? (
                                <X className="w-4 h-4" />
                              ) : (
                                <span className="text-sm font-bold">{dose.doseNumber}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-surface-900 dark:text-white">
                                Dose {dose.doseNumber}
                              </div>
                              <div className="text-sm text-surface-500">
                                {dose.administered 
                                  ? `Given: ${new Date(dose.administered).toLocaleDateString()}`
                                  : status === 'expired'
                                    ? `No longer applicable (past catch-up age)`
                                    : `Recommended: ${dose.recommendedAge}`
                                }
                              </div>
                            </div>
                          </div>
                          {!dose.administered && status !== 'expired' && (
                            <Button
                              size="sm"
                              onClick={() => setShowMarkComplete({ vaccineId: selectedVaccine.id, doseNumber: dose.doseNumber })}
                              className="bg-gradient-to-r from-cyan-500 to-teal-600"
                            >
                              Mark Complete
                            </Button>
                          )}
                          {status === 'expired' && (
                            <Badge variant="secondary">N/A</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Mark Complete Modal */}
      {showMarkComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowMarkComplete(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader>
                <CardTitle>Mark Vaccine Complete</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-surface-600 dark:text-surface-400">
                  When was this vaccine dose administered?
                </p>
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleMarkComplete(showMarkComplete.vaccineId, showMarkComplete.doseNumber, new Date(e.target.value))
                    }
                  }}
                />
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowMarkComplete(null)} fullWidth>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => handleMarkComplete(showMarkComplete.vaccineId, showMarkComplete.doseNumber, new Date())}
                    fullWidth
                    className="bg-gradient-to-r from-cyan-500 to-teal-600"
                  >
                    Today
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
      
      {/* Export for School Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[80vh] overflow-y-auto"
            >
              <Card>
                <CardHeader className="bg-cyan-50 dark:bg-cyan-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <CardTitle>School Immunization Record</CardTitle>
                      <p className="text-sm text-surface-500 mt-1">
                        Export vaccination record for {selectedChild.name}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* School-Required Vaccines */}
                  <div>
                    <h4 className="font-semibold text-surface-900 dark:text-white mb-3">
                      School-Required Vaccines
                    </h4>
                    <div className="space-y-2">
                      {vaccines.filter(v => v.schoolRequired).map(vaccine => {
                        const completedCount = vaccine.doses.filter(d => d.administered).length
                        const isComplete = completedCount === vaccine.doses.length
                        
                        return (
                          <div 
                            key={vaccine.id}
                            className={`p-3 rounded-lg flex items-center justify-between ${
                              isComplete 
                                ? 'bg-emerald-50 dark:bg-emerald-900/20' 
                                : 'bg-amber-50 dark:bg-amber-900/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {isComplete ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                              )}
                              <div>
                                <div className="font-medium text-surface-900 dark:text-white">
                                  {vaccine.shortName}
                                </div>
                                <div className="text-xs text-surface-500">
                                  {completedCount}/{vaccine.doses.length} doses
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-xs text-surface-500">
                              {vaccine.doses.filter(d => d.administered).map((d, i) => (
                                <div key={i}>
                                  Dose {d.doseNumber}: {new Date(d.administered!).toLocaleDateString()}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Summary */}
                  <div className="p-4 rounded-lg bg-surface-100 dark:bg-surface-800">
                    <h4 className="font-semibold text-surface-900 dark:text-white mb-2">Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-surface-500">Patient:</div>
                      <div className="font-medium">{selectedChild.name}</div>
                      <div className="text-surface-500">Age:</div>
                      <div className="font-medium">{childAgeYears} years old</div>
                      <div className="text-surface-500">School Vaccines:</div>
                      <div className="font-medium">
                        {vaccines.filter(v => v.schoolRequired && v.doses.every(d => d.administered)).length}/
                        {vaccines.filter(v => v.schoolRequired).length} complete
                      </div>
                      <div className="text-surface-500">Generated:</div>
                      <div className="font-medium">{new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button variant="secondary" onClick={() => setShowExportModal(false)} fullWidth>
                      Cancel
                    </Button>
                    <Button 
                      icon={<Download className="w-4 h-4" />}
                      onClick={() => {
                        alert('PDF generation would be implemented here. For now, you can screenshot this form.')
                        setShowExportModal(false)
                      }}
                      fullWidth
                      className="bg-gradient-to-r from-cyan-500 to-teal-600"
                    >
                      Download PDF
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
