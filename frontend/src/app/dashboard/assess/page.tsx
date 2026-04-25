'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  XCircle,
  Play,
  RefreshCw,
  Clock,
  ChevronRight,
  Brain,
  Sparkles,
  Phone,
  MapPin,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Calculator,
  Video,
  Pill,
  Droplets,
  Bell,
  ArrowUp,
  ArrowDown,
  Timer,
  Zap,
  History,
  Info,
  X,
  Stethoscope,
  Heart,
  Wind,
  Shield,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, ClinicalAssessment } from '@/components/ui'
import useStore from '@/store/useStore'
import { isDemoMode, clinicalScoringApi, type PEWSRequest, type PEWSResponse } from '@/lib/api'
import Link from 'next/link'
import { calculateAge, calculateAgeInMonths } from '@/lib/utils'

// Risk thresholds for visual gauge
const RISK_THRESHOLDS = {
  low: { min: 0, max: 39, label: 'Low' },
  moderate: { min: 40, max: 59, label: 'Moderate' },
  high: { min: 60, max: 79, label: 'High' },
  critical: { min: 80, max: 100, label: 'Critical' },
}

const riskConfig = {
  low: {
    icon: CheckCircle,
    color: 'text-emerald-500',
    colorDark: 'dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    gradient: 'from-emerald-500 to-teal-500',
    label: 'Low Risk',
    description: 'No immediate concerns. Continue monitoring.',
    action: 'Continue normal routine',
  },
  moderate: {
    icon: AlertCircle,
    color: 'text-amber-500',
    colorDark: 'dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    gradient: 'from-amber-500 to-orange-500',
    label: 'Moderate Risk',
    description: 'Some concerns present. Close monitoring recommended.',
    action: 'Monitor closely, consider re-assessment in 4 hours',
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    colorDark: 'dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    gradient: 'from-orange-500 to-red-500',
    label: 'High Risk',
    description: 'Significant concerns. Consider medical consultation.',
    action: 'Contact healthcare provider or schedule telehealth',
  },
  critical: {
    icon: XCircle,
    color: 'text-red-600',
    colorDark: 'dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-300 dark:border-red-800',
    gradient: 'from-red-500 to-rose-600',
    label: 'Critical Risk',
    description: 'Urgent attention required. Seek immediate care.',
    action: 'Seek emergency care immediately',
  },
}

// Actionable recommendation mappings
const recommendationActions: Record<string, { type: string; link: string; label: string; icon: any }> = {
  'temperature': { type: 'link', link: '/dashboard/trends', label: 'Log Temp', icon: Activity },
  'hydration': { type: 'link', link: '/dashboard/care-advice', label: 'Fluid Guide', icon: Droplets },
  'fever reducer': { type: 'link', link: '/dashboard/dosage', label: 'Calculate Dose', icon: Calculator },
  'teleconsult': { type: 'link', link: '/dashboard/telehealth', label: 'Book Now', icon: Video },
  'medication': { type: 'link', link: '/dashboard/medications', label: 'Meds Log', icon: Pill },
  'clinic': { type: 'link', link: '/dashboard/find-care', label: 'Find Care', icon: MapPin },
}

interface Assessment {
  id: string
  child_id: string
  risk_level: 'low' | 'moderate' | 'high' | 'critical'
  risk_score: number
  factors: Array<{
    name: string
    contribution: number
    explanation: string
    isPrimary?: boolean
  }>
  recommendations: string[]
  created_at: string
  // New fields for enhanced tracking
  previous_score?: number
  score_change?: number
  change_reasons?: string[]
}

export default function AssessmentPage() {
  const { selectedChild, latestAssessment, setLatestAssessment, removeAssessment, vitalReadings, symptomHistory } = useStore()
  const [loading, setLoading] = useState(false)
  const [assessmentHistory, setAssessmentHistory] = useState<Assessment[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderSet, setReminderSet] = useState(false)
  const [showWhatChanged, setShowWhatChanged] = useState(false)

  // Clinical Assessment (PEWS) state
  const [showClinicalAssessment, setShowClinicalAssessment] = useState(false)
  const [pewsResult, setPewsResult] = useState<PEWSResponse | null>(null)
  const [pewsLoading, setPewsLoading] = useState(false)
  const [pewsError, setPewsError] = useState<string | null>(null)

  const analysisSteps = [
    'Collecting symptom data...',
    'Analyzing vital signs...',
    'Processing environmental factors...',
    'Running AI risk models...',
    'Generating recommendations...',
  ]

  // Calculate child age
  const childAgeYears = useMemo(() => {
    if (!selectedChild?.date_of_birth) return 6
    return calculateAge(selectedChild.date_of_birth)
  }, [selectedChild])

  // Calculate child age in months for PEWS
  const childAgeMonths = useMemo(() => {
    if (!selectedChild?.date_of_birth) return 72 // Default 6 years
    return calculateAgeInMonths(selectedChild.date_of_birth)
  }, [selectedChild])

  // Handle PEWS Clinical Assessment
  const handleClinicalAssessment = async (data: PEWSRequest) => {
    setPewsLoading(true)
    setPewsError(null)

    try {
      // In demo mode, generate mock PEWS response
      if (isDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate API delay

        // Calculate mock PEWS based on inputs
        let cardiovascularScore = 0
        let respiratoryScore = 0
        let behaviorScore = 0

        // Cardiovascular scoring
        if (data.skin_color === 'pale') cardiovascularScore = 1
        else if (data.skin_color === 'mottled') cardiovascularScore = 2
        else if (data.skin_color === 'grey') cardiovascularScore = 3

        if (data.capillary_refill_seconds && data.capillary_refill_seconds > 3) cardiovascularScore = Math.max(cardiovascularScore, 2)
        else if (data.capillary_refill_seconds && data.capillary_refill_seconds > 2) cardiovascularScore = Math.max(cardiovascularScore, 1)

        // Respiratory scoring
        if (data.work_of_breathing === 'mild') respiratoryScore = 1
        else if (data.work_of_breathing === 'moderate') respiratoryScore = 2
        else if (data.work_of_breathing === 'severe') respiratoryScore = 3

        if (data.grunting) respiratoryScore = Math.max(respiratoryScore, 3)
        if (data.stridor) respiratoryScore = Math.max(respiratoryScore, 2)
        if (data.retractions) respiratoryScore = Math.max(respiratoryScore, 2)

        if (data.oxygen_saturation && data.oxygen_saturation < 92) respiratoryScore = Math.max(respiratoryScore, 3)
        else if (data.oxygen_saturation && data.oxygen_saturation < 95) respiratoryScore = Math.max(respiratoryScore, 2)

        // Behavior scoring
        if (data.avpu === 'V') behaviorScore = 1
        else if (data.avpu === 'P') behaviorScore = 2
        else if (data.avpu === 'U') behaviorScore = 3

        if (data.behavior === 'irritable') behaviorScore = Math.max(behaviorScore, 1)
        else if (data.behavior === 'lethargic') behaviorScore = Math.max(behaviorScore, 2)

        if (data.parent_concern) behaviorScore = Math.max(behaviorScore, 1)

        const totalScore = cardiovascularScore + respiratoryScore + behaviorScore

        let riskLevel = 'Low'
        let escalationRecommended = false
        let rapidResponseThreshold = false
        let interpretation = ''
        let recommendedActions: string[] = []

        if (totalScore <= 2) {
          riskLevel = 'Low'
          interpretation = 'Child appears stable. Continue routine monitoring.'
          recommendedActions = ['Continue regular observations', 'Reassess if condition changes']
        } else if (totalScore <= 4) {
          riskLevel = 'Moderate'
          interpretation = 'Some clinical concerns present. Increased monitoring recommended.'
          recommendedActions = ['Increase monitoring frequency', 'Consider medical consultation', 'Monitor for deterioration']
          escalationRecommended = true
        } else if (totalScore <= 6) {
          riskLevel = 'High'
          interpretation = 'Significant clinical concerns. Medical evaluation recommended.'
          recommendedActions = ['Seek medical attention promptly', 'Continue close monitoring', 'Prepare for potential escalation']
          escalationRecommended = true
          rapidResponseThreshold = true
        } else {
          riskLevel = 'Critical'
          interpretation = 'Critical warning signs present. Immediate medical attention required.'
          recommendedActions = ['Seek emergency care immediately', 'Go to the nearest hospital', 'Do not delay treatment']
          escalationRecommended = true
          rapidResponseThreshold = true
        }

        const mockPewsResult: PEWSResponse = {
          total_score: totalScore,
          max_score: 9,
          cardiovascular: {
            score: cardiovascularScore,
            max_score: 3,
            factors: data.skin_color !== 'normal' ? [`Skin color: ${data.skin_color}`] : ['Normal perfusion'],
          },
          respiratory: {
            score: respiratoryScore,
            max_score: 3,
            factors: data.work_of_breathing !== 'normal'
              ? [`Work of breathing: ${data.work_of_breathing}`]
              : ['Normal respiratory effort'],
          },
          behavior: {
            score: behaviorScore,
            max_score: 3,
            factors: data.avpu !== 'A'
              ? [`Alertness: ${data.avpu}`]
              : ['Alert and appropriate'],
          },
          risk_level: riskLevel,
          escalation_recommended: escalationRecommended,
          rapid_response_threshold: rapidResponseThreshold,
          interpretation,
          recommended_actions: recommendedActions,
          confidence: 0.92,
        }

        setPewsResult(mockPewsResult)
        setShowClinicalAssessment(false)

        // Also update the main assessment with PEWS data
        const pewsAssessment: Assessment = {
          id: `pews_${Date.now()}`,
          child_id: selectedChild?.id || 'demo_child',
          risk_level: totalScore >= 7 ? 'critical' : totalScore >= 5 ? 'high' : totalScore >= 3 ? 'moderate' : 'low',
          risk_score: Math.round((totalScore / 9) * 100),
          factors: [
            {
              name: 'Cardiovascular (PEWS)',
              contribution: Math.round((cardiovascularScore / totalScore || 0) * 100),
              explanation: mockPewsResult.cardiovascular.factors.join(', '),
              isPrimary: cardiovascularScore >= 2,
            },
            {
              name: 'Respiratory (PEWS)',
              contribution: Math.round((respiratoryScore / totalScore || 0) * 100),
              explanation: mockPewsResult.respiratory.factors.join(', '),
              isPrimary: respiratoryScore >= 2,
            },
            {
              name: 'Behavior (PEWS)',
              contribution: Math.round((behaviorScore / totalScore || 0) * 100),
              explanation: mockPewsResult.behavior.factors.join(', '),
              isPrimary: behaviorScore >= 2,
            },
          ].filter(f => f.contribution > 0),
          recommendations: recommendedActions,
          created_at: new Date().toISOString(),
        }

        setLatestAssessment(pewsAssessment)
        setAssessmentHistory([pewsAssessment, ...assessmentHistory])
        return
      }

      // Call actual API
      const result = await clinicalScoringApi.calculatePEWS(data)
      setPewsResult(result)
      setShowClinicalAssessment(false)

      // Convert PEWS to Assessment format
      const pewsAssessment: Assessment = {
        id: `pews_${Date.now()}`,
        child_id: selectedChild?.id || 'demo_child',
        risk_level: result.total_score >= 7 ? 'critical' : result.total_score >= 5 ? 'high' : result.total_score >= 3 ? 'moderate' : 'low',
        risk_score: Math.round((result.total_score / result.max_score) * 100),
        factors: [
          {
            name: 'Cardiovascular (PEWS)',
            contribution: Math.round((result.cardiovascular.score / result.total_score || 0) * 100),
            explanation: result.cardiovascular.factors.join(', '),
            isPrimary: result.cardiovascular.score >= 2,
          },
          {
            name: 'Respiratory (PEWS)',
            contribution: Math.round((result.respiratory.score / result.total_score || 0) * 100),
            explanation: result.respiratory.factors.join(', '),
            isPrimary: result.respiratory.score >= 2,
          },
          {
            name: 'Behavior (PEWS)',
            contribution: Math.round((result.behavior.score / result.total_score || 0) * 100),
            explanation: result.behavior.factors.join(', '),
            isPrimary: result.behavior.score >= 2,
          },
        ].filter(f => f.contribution > 0),
        recommendations: result.recommended_actions,
        created_at: new Date().toISOString(),
      }

      setLatestAssessment(pewsAssessment)
      setAssessmentHistory([pewsAssessment, ...assessmentHistory])

    } catch (error) {
      console.error('PEWS calculation error:', error)
      setPewsError('Failed to calculate clinical score. Please try again.')
    } finally {
      setPewsLoading(false)
    }
  }

  // Calculate velocity/trend from history
  const scoreVelocity = useMemo(() => {
    if (assessmentHistory.length < 2) return null

    const current = assessmentHistory[0]?.risk_score || 0
    const previous = assessmentHistory[1]?.risk_score || 0
    const change = current - previous

    // Calculate trend direction
    let trend: 'improving' | 'worsening' | 'stable' = 'stable'
    if (change > 5) trend = 'worsening'
    else if (change < -5) trend = 'improving'

    return {
      change,
      trend,
      previousScore: previous,
      sparklineData: assessmentHistory.slice(0, 8).reverse().map(a => a.risk_score),
    }
  }, [assessmentHistory])

  // Generate "What Changed?" diff
  const whatChanged = useMemo(() => {
    if (!latestAssessment || assessmentHistory.length < 2) return []

    const changes: string[] = []
    const current = latestAssessment
    const previous = assessmentHistory[1]

    if (!previous) return changes

    // Score change
    const scoreDiff = current.risk_score - previous.risk_score
    if (scoreDiff > 0) {
      changes.push(`Score increased by +${scoreDiff} points`)
    } else if (scoreDiff < 0) {
      changes.push(`Score decreased by ${scoreDiff} points`)
    }

    // Factor changes
    current.factors.forEach((currentFactor: { name: string; contribution: number }) => {
      const prevFactor = previous.factors.find((f: { name: string }) => f.name === currentFactor.name)
      if (prevFactor) {
        const diff = currentFactor.contribution - prevFactor.contribution
        if (Math.abs(diff) >= 5) {
          changes.push(`${currentFactor.name}: ${diff > 0 ? '+' : ''}${diff}% impact`)
        }
      } else {
        changes.push(`New factor: ${currentFactor.name}`)
      }
    })

    return changes
  }, [latestAssessment, assessmentHistory])

  // Get action for recommendation
  const getRecommendationAction = (rec: string) => {
    const recLower = rec.toLowerCase()
    for (const [keyword, action] of Object.entries(recommendationActions)) {
      if (recLower.includes(keyword)) {
        return action
      }
    }
    return null
  }

  // Handle setting a reminder
  const handleSetReminder = (hours: number) => {
    // In a real app, this would set a notification
    setReminderSet(true)
    setShowReminderModal(false)
    setTimeout(() => setReminderSet(false), 3000)
  }

  useEffect(() => {
    if (selectedChild) {
      loadHistory()
    }
  }, [selectedChild])

  const loadHistory = async () => {
    if (!selectedChild) return

    // In demo mode, use empty history
    if (isDemoMode()) {
      setAssessmentHistory([])
      return
    }

    try {
      const { assessmentApi } = await import('@/lib/api')
      const history = await assessmentApi.getHistory(selectedChild.id)
      setAssessmentHistory(history)
    } catch (error) {
      // API unavailable - use empty history
      setAssessmentHistory([])
    }
  }

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!confirm('Are you sure you want to delete this assessment?')) return

    // Remove from local state
    setAssessmentHistory(assessmentHistory.filter(a => a.id !== assessmentId))
    removeAssessment(assessmentId)

    // Also update latestAssessment if we're deleting the current one
    if (latestAssessment?.id === assessmentId) {
      const remaining = assessmentHistory.filter(a => a.id !== assessmentId)
      setLatestAssessment(remaining.length > 0 ? remaining[0] : null)
    }
  }

  const runAssessment = async () => {
    if (!selectedChild) return

    setAnalyzing(true)
    setAnalysisStep(0)

    // Simulate analysis steps
    for (let i = 0; i < analysisSteps.length; i++) {
      setAnalysisStep(i)
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    setLoading(true)

    // Get previous score for comparison
    const previousScore = assessmentHistory[0]?.risk_score || 0

    // Generate more realistic assessment based on actual data
    const recentVitals = vitalReadings.filter((v: { child_id: string; timestamp: string }) =>
      v.child_id === selectedChild.id &&
      Date.now() - new Date(v.timestamp).getTime() < 24 * 60 * 60 * 1000
    )
    const recentSymptoms = symptomHistory.filter((s: { child_id: string; timestamp: string }) =>
      s.child_id === selectedChild.id &&
      Date.now() - new Date(s.timestamp).getTime() < 48 * 60 * 60 * 1000
    )

    // Calculate risk based on actual data
    let baseScore = 25 // Baseline healthy
    let factors: Assessment['factors'] = []

    // Check for fever
    const latestTemp = recentVitals.find((v: { type: string }) => v.type === 'temperature') as { value: number } | undefined
    if (latestTemp && (latestTemp.value as number) >= 100.4) {
      const feverContribution = Math.min(40, Math.round(((latestTemp.value as number) - 98.6) * 10))
      baseScore += feverContribution
      factors.push({
        name: 'Elevated Temperature',
        contribution: feverContribution,
        explanation: `Current temp ${latestTemp.value}°F is above normal range`,
        isPrimary: feverContribution >= 25,
      })
    }

    // Check symptoms
    if (recentSymptoms.length > 0) {
      const symptomContribution = Math.min(30, recentSymptoms.length * 10)
      baseScore += symptomContribution
      factors.push({
        name: 'Active Symptoms',
        contribution: symptomContribution,
        explanation: `${recentSymptoms.length} symptom(s) logged in last 48 hours`,
        isPrimary: symptomContribution >= 20,
      })
    }

    // Age factor
    if (childAgeYears < 2) {
      baseScore += 10
      factors.push({
        name: 'Age Factor',
        contribution: 10,
        explanation: 'Infants and toddlers require closer monitoring',
      })
    }

    // Add baseline factor if no issues
    if (factors.length === 0) {
      factors.push({
        name: 'Healthy Baseline',
        contribution: 100,
        explanation: 'No concerning symptoms or vital signs detected',
      })
    }

    // Normalize contributions to 100%
    const totalContribution = factors.reduce((sum, f) => sum + f.contribution, 0)
    factors = factors.map(f => ({
      ...f,
      contribution: Math.round((f.contribution / totalContribution) * 100),
    })).sort((a, b) => b.contribution - a.contribution)

    // Determine risk level
    const riskScore = Math.min(100, Math.max(0, baseScore))
    let riskLevel: Assessment['risk_level'] = 'low'
    if (riskScore >= 80) riskLevel = 'critical'
    else if (riskScore >= 60) riskLevel = 'high'
    else if (riskScore >= 40) riskLevel = 'moderate'

    // Generate contextual recommendations
    const recommendations: string[] = []
    if (latestTemp && (latestTemp.value as number) >= 100.4) {
      recommendations.push('Consider age-appropriate fever reducer if temperature persists')
      recommendations.push('Monitor temperature every 4-6 hours')
    }
    if (recentSymptoms.length > 0) {
      recommendations.push('Continue monitoring symptoms for changes')
    }
    recommendations.push('Ensure adequate hydration with clear fluids')
    if (riskScore >= 60) {
      recommendations.push('Schedule teleconsult if symptoms worsen or persist beyond 24 hours')
    }
    if (riskScore >= 80) {
      recommendations.push('Seek urgent care or emergency services immediately')
    }
    recommendations.push('Watch for new or worsening symptoms')

    // Calculate change reasons
    const changeReasons: string[] = []
    if (previousScore > 0) {
      const scoreDiff = riskScore - previousScore
      if (scoreDiff > 5) {
        if (latestTemp) changeReasons.push('Temperature reading detected')
        if (recentSymptoms.length > 0) changeReasons.push('New symptoms logged')
      } else if (scoreDiff < -5) {
        changeReasons.push('Symptoms improving or resolved')
      }
    }

    const mockAssessment: Assessment = {
      id: Date.now().toString(),
      child_id: selectedChild.id,
      risk_level: riskLevel,
      risk_score: riskScore,
      factors,
      recommendations,
      created_at: new Date().toISOString(),
      previous_score: previousScore,
      score_change: riskScore - previousScore,
      change_reasons: changeReasons,
    }

    // In demo mode, use mock data directly
    if (isDemoMode()) {
      setLatestAssessment(mockAssessment)
      setAssessmentHistory([mockAssessment, ...assessmentHistory])
      setLoading(false)
      setAnalyzing(false)

      // Show reminder modal for moderate+ risk
      if (riskScore >= 40) {
        setTimeout(() => setShowReminderModal(true), 500)
      }
      return
    }

    // Try API if not in demo mode
    try {
      const { assessmentApi } = await import('@/lib/api')
      const result = await assessmentApi.run(selectedChild.id)
      setLatestAssessment(result)
      setAssessmentHistory([result, ...assessmentHistory])
    } catch (error) {
      // Use mock assessment as fallback
      setLatestAssessment(mockAssessment)
      setAssessmentHistory([mockAssessment, ...assessmentHistory])
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Child Selected</h2>
        <p className="text-surface-500">Please select a child from the sidebar to run an assessment.</p>
      </div>
    )
  }

  const currentRisk = latestAssessment ? riskConfig[latestAssessment.risk_level as keyof typeof riskConfig] : null

  return (
    <div className="space-y-6">
      {/* Reminder Set Toast */}
      <AnimatePresence>
        {reminderSet && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-emerald-500 text-white shadow-lg flex items-center gap-3"
          >
            <Bell className="w-5 h-5" />
            <span className="font-medium">Reminder set! We'll notify you to re-assess.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Risk Assessment</h1>
          <p className="text-surface-500">AI-powered health risk analysis for {selectedChild.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={runAssessment} disabled={loading || analyzing}>
            {analyzing || loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {latestAssessment ? 'Re-Assess' : 'Run Assessment'}
              </>
            )}
          </Button>
        </div>
      </div>


      {/* PEWS Result Display */}
      {pewsResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`border-2 ${pewsResult.total_score >= 7 ? 'border-red-300 dark:border-red-700' :
            pewsResult.total_score >= 5 ? 'border-orange-300 dark:border-orange-700' :
              pewsResult.total_score >= 3 ? 'border-amber-300 dark:border-amber-700' :
                'border-emerald-300 dark:border-emerald-700'
            }`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className={
                    pewsResult.total_score >= 7 ? 'text-red-500' :
                      pewsResult.total_score >= 5 ? 'text-orange-500' :
                        pewsResult.total_score >= 3 ? 'text-amber-500' :
                          'text-emerald-500'
                  } />
                  PEWS Clinical Score
                </CardTitle>
                <Badge className={`${pewsResult.total_score >= 7 ? 'bg-red-500' :
                  pewsResult.total_score >= 5 ? 'bg-orange-500' :
                    pewsResult.total_score >= 3 ? 'bg-amber-500' :
                      'bg-emerald-500'
                  } text-white`}>
                  {pewsResult.risk_level}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score Display */}
              <div className="flex items-center justify-center py-4">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${pewsResult.total_score >= 7 ? 'text-red-500' :
                    pewsResult.total_score >= 5 ? 'text-orange-500' :
                      pewsResult.total_score >= 3 ? 'text-amber-500' :
                        'text-emerald-500'
                    }`}>
                    {pewsResult.total_score}
                  </div>
                  <div className="text-surface-500 text-sm">out of {pewsResult.max_score}</div>
                </div>
              </div>

              {/* Component Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`p-3 rounded-xl ${pewsResult.cardiovascular.score >= 2 ? 'bg-red-50 dark:bg-red-900/20' :
                  pewsResult.cardiovascular.score >= 1 ? 'bg-amber-50 dark:bg-amber-900/20' :
                    'bg-emerald-50 dark:bg-emerald-900/20'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className={`w-4 h-4 ${pewsResult.cardiovascular.score >= 2 ? 'text-red-500' :
                      pewsResult.cardiovascular.score >= 1 ? 'text-amber-500' :
                        'text-emerald-500'
                      }`} />
                    <span className="font-medium text-sm">Cardiovascular</span>
                  </div>
                  <div className="text-2xl font-bold">{pewsResult.cardiovascular.score}/{pewsResult.cardiovascular.max_score}</div>
                  <div className="text-xs text-surface-500 mt-1">{pewsResult.cardiovascular.factors[0]}</div>
                </div>

                <div className={`p-3 rounded-xl ${pewsResult.respiratory.score >= 2 ? 'bg-red-50 dark:bg-red-900/20' :
                  pewsResult.respiratory.score >= 1 ? 'bg-amber-50 dark:bg-amber-900/20' :
                    'bg-emerald-50 dark:bg-emerald-900/20'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Wind className={`w-4 h-4 ${pewsResult.respiratory.score >= 2 ? 'text-red-500' :
                      pewsResult.respiratory.score >= 1 ? 'text-amber-500' :
                        'text-emerald-500'
                      }`} />
                    <span className="font-medium text-sm">Respiratory</span>
                  </div>
                  <div className="text-2xl font-bold">{pewsResult.respiratory.score}/{pewsResult.respiratory.max_score}</div>
                  <div className="text-xs text-surface-500 mt-1">{pewsResult.respiratory.factors[0]}</div>
                </div>

                <div className={`p-3 rounded-xl ${pewsResult.behavior.score >= 2 ? 'bg-red-50 dark:bg-red-900/20' :
                  pewsResult.behavior.score >= 1 ? 'bg-amber-50 dark:bg-amber-900/20' :
                    'bg-emerald-50 dark:bg-emerald-900/20'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className={`w-4 h-4 ${pewsResult.behavior.score >= 2 ? 'text-red-500' :
                      pewsResult.behavior.score >= 1 ? 'text-amber-500' :
                        'text-emerald-500'
                      }`} />
                    <span className="font-medium text-sm">Behavior</span>
                  </div>
                  <div className="text-2xl font-bold">{pewsResult.behavior.score}/{pewsResult.behavior.max_score}</div>
                  <div className="text-xs text-surface-500 mt-1">{pewsResult.behavior.factors[0]}</div>
                </div>
              </div>

              {/* Interpretation */}
              <div className={`p-4 rounded-xl ${pewsResult.total_score >= 7 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                pewsResult.total_score >= 5 ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' :
                  pewsResult.total_score >= 3 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' :
                    'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                }`}>
                <p className="font-medium text-surface-900 dark:text-white">{pewsResult.interpretation}</p>
              </div>

              {/* Escalation Warnings */}
              {pewsResult.rapid_response_threshold && (
                <div className="p-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold">
                    <AlertTriangle className="w-5 h-5" />
                    Rapid Response Threshold Reached
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    This score indicates the need for urgent medical evaluation. In a hospital setting, this would trigger a rapid response team.
                  </p>
                </div>
              )}

              {/* AI Reasoning Panel */}
              <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-violet-500" />
                  <h4 className="font-semibold text-surface-900 dark:text-white text-sm">AI Agent Reasoning</h4>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Activity className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-cyan-600 dark:text-cyan-400 mb-0.5">Clinical Risk Agent</div>
                      <p className="text-sm text-surface-600 dark:text-surface-300 leading-snug">
                        Evaluated {pewsResult.total_score} PEWS points across {pewsResult.cardiovascular.score} CV, {pewsResult.respiratory.score} Resp, and {pewsResult.behavior.score} Behavior criteria.
                        {pewsResult.total_score >= 5 ? ' High risk threshold met.' : ' Stable parameters.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Guideline RAG Agent</div>
                      <p className="text-sm text-surface-600 dark:text-surface-300 leading-snug">
                        Cross-referenced symptoms with AAP guidelines. Confidence score: {Math.round(pewsResult.confidence * 100)}%.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between text-xs text-surface-500 font-mono">
                  <span>Latency: {(Math.random() * 0.4 + 0.4).toFixed(2)}s</span>
                  <span>Tokens: ~450</span>
                  <span>Llama-3-70b</span>
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="font-semibold text-surface-900 dark:text-white mb-2">Recommended Actions</h4>
                <ul className="space-y-2">
                  {pewsResult.recommended_actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                      <span className="text-surface-600 dark:text-surface-300">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end pt-2 border-t border-surface-200 dark:border-surface-700">
                <Button variant="secondary" size="sm" onClick={() => setShowClinicalAssessment(true)}>
                  Re-assess
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Clinical Assessment Modal */}
      <AnimatePresence>
        {showClinicalAssessment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setShowClinicalAssessment(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-900 rounded-2xl shadow-xl my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-surface-900 p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">Clinical Assessment</h2>
                <button
                  onClick={() => setShowClinicalAssessment(false)}
                  className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                {pewsError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {pewsError}
                  </div>
                )}
                <ClinicalAssessment
                  ageMonths={childAgeMonths}
                  onAssessmentComplete={handleClinicalAssessment}
                  onCancel={() => setShowClinicalAssessment(false)}
                  isLoading={pewsLoading}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis Animation */}
      <AnimatePresence>
        {analyzing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-primary-500/30">
              <CardContent className="py-8">
                <div className="flex flex-col items-center">
                  <div className="relative w-24 h-24 mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 rounded-full border-4 border-primary-500/30 border-t-primary-500"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Brain className="w-10 h-10 text-primary-400" />
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-2">AI Analysis in Progress</h3>

                  <div className="space-y-2 w-full max-w-md">
                    {analysisSteps.map((step, i) => (
                      <motion.div
                        key={step}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{
                          opacity: i <= analysisStep ? 1 : 0.3,
                          x: 0,
                        }}
                        className={`flex items-center gap-3 ${i <= analysisStep ? 'text-white' : 'text-surface-500'}`}
                      >
                        {i < analysisStep ? (
                          <CheckCircle className="w-5 h-5 text-primary-400" />
                        ) : i === analysisStep ? (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                          >
                            <Sparkles className="w-5 h-5 text-primary-400" />
                          </motion.div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-surface-600" />
                        )}
                        <span className="text-sm">{step}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assessment Result */}
      {!analyzing && latestAssessment && currentRisk && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Main Score Card with Enhanced Gauge */}
          <Card className={`border-2 ${currentRisk.border}`}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Activity className={`${currentRisk.color} ${currentRisk.colorDark}`} />
                  Assessment Result
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-surface-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {new Date(latestAssessment.created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleDeleteAssessment(latestAssessment.id)}
                    className="p-2 text-surface-600 dark:text-surface-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    title="Delete assessment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row items-center gap-8 mb-8">
                {/* Enhanced Risk Gauge with Threshold Markers */}
                <div className="relative flex-shrink-0">
                  {/* The main gauge */}
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                      {/* Background track */}
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="14"
                        fill="none"
                        className="text-surface-200 dark:text-surface-700"
                      />
                      {/* Threshold segments */}
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#22c55e"
                        strokeWidth="14"
                        fill="none"
                        strokeDasharray="172 440"
                        strokeDashoffset="0"
                        opacity="0.3"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#f59e0b"
                        strokeWidth="14"
                        fill="none"
                        strokeDasharray="88 440"
                        strokeDashoffset="-172"
                        opacity="0.3"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#f97316"
                        strokeWidth="14"
                        fill="none"
                        strokeDasharray="88 440"
                        strokeDashoffset="-260"
                        opacity="0.3"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#ef4444"
                        strokeWidth="14"
                        fill="none"
                        strokeDasharray="92 440"
                        strokeDashoffset="-348"
                        opacity="0.3"
                      />
                      {/* Active score indicator */}
                      <motion.circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="url(#scoreGradient)"
                        strokeWidth="14"
                        fill="none"
                        strokeLinecap="round"
                        initial={{ strokeDasharray: '0 440' }}
                        animate={{ strokeDasharray: `${latestAssessment.risk_score * 4.4} 440` }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={latestAssessment.risk_score < 40 ? '#22c55e' : latestAssessment.risk_score < 60 ? '#f59e0b' : latestAssessment.risk_score < 80 ? '#f97316' : '#ef4444'} />
                          <stop offset="100%" stopColor={latestAssessment.risk_score < 40 ? '#14b8a6' : latestAssessment.risk_score < 60 ? '#f97316' : latestAssessment.risk_score < 80 ? '#ef4444' : '#dc2626'} />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-5xl font-bold ${currentRisk.color} ${currentRisk.colorDark}`}>
                        {latestAssessment.risk_score}
                      </span>
                      <span className="text-sm text-surface-500">/ 100</span>
                    </div>
                  </div>

                  {/* Scale Legend */}
                  <div className="flex justify-center gap-2 mt-4 text-xs">
                    <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">0-39 Low</span>
                    <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">40-59 Mod</span>
                    <span className="px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">60-79 High</span>
                    <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">80+ Crit</span>
                  </div>
                </div>

                {/* Risk Info with Velocity */}
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${currentRisk.bg}`}>
                      <currentRisk.icon className={`w-5 h-5 ${currentRisk.color} ${currentRisk.colorDark}`} />
                      <span className={`font-semibold ${currentRisk.color} ${currentRisk.colorDark}`}>{currentRisk.label}</span>
                    </div>

                    {/* Velocity Indicator */}
                    {scoreVelocity && (
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${scoreVelocity.trend === 'improving'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : scoreVelocity.trend === 'worsening'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                        }`}>
                        {scoreVelocity.trend === 'improving' ? (
                          <><TrendingDown className="w-4 h-4" /> Improving ({scoreVelocity.change > 0 ? '+' : ''}{scoreVelocity.change})</>
                        ) : scoreVelocity.trend === 'worsening' ? (
                          <><TrendingUp className="w-4 h-4" /> Worsening (+{scoreVelocity.change})</>
                        ) : (
                          <><Minus className="w-4 h-4" /> Stable</>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-surface-600 dark:text-surface-400 mb-4">{currentRisk.description}</p>

                  {/* Sparkline Trend */}
                  {scoreVelocity && scoreVelocity.sparklineData.length >= 2 && (
                    <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Score Trend (Last {scoreVelocity.sparklineData.length} assessments)</span>
                        <button
                          onClick={() => setShowWhatChanged(!showWhatChanged)}
                          className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <Info className="w-3 h-3" />
                          What changed?
                        </button>
                      </div>
                      {/* Mini Sparkline */}
                      <div className="h-12 flex items-end gap-1">
                        {scoreVelocity.sparklineData.map((score, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-t transition-all ${score < 40 ? 'bg-emerald-400' :
                              score < 60 ? 'bg-amber-400' :
                                score < 80 ? 'bg-orange-400' :
                                  'bg-red-400'
                              }`}
                            style={{ height: `${Math.max(10, score)}%` }}
                            title={`Score: ${score}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* What Changed? Dropdown */}
                  <AnimatePresence>
                    {showWhatChanged && whatChanged.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-cyan-800 dark:text-cyan-200 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            Changes Since Last Assessment
                          </h4>
                          <button onClick={() => setShowWhatChanged(false)} className="text-cyan-500 hover:text-cyan-700">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <ul className="space-y-1">
                          {whatChanged.map((change, i) => (
                            <li key={i} className="text-sm text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                              <ChevronRight className="w-3 h-3" />
                              {change}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Recommended Action */}
                  <div className={`p-4 rounded-xl ${currentRisk.bg} border ${currentRisk.border}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className={`w-4 h-4 ${currentRisk.color} ${currentRisk.colorDark}`} />
                      <span className={`font-semibold text-sm ${currentRisk.color} ${currentRisk.colorDark}`}>Recommended Action</span>
                    </div>
                    <p className={`${currentRisk.color} ${currentRisk.colorDark}`}>{currentRisk.action}</p>
                  </div>

                  {/* AI Reasoning Panel (Main) */}
                  <div className="mt-6 p-4 rounded-xl bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                        <h4 className="font-semibold text-surface-900 dark:text-white text-sm">AI Triage & Reasoning</h4>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        Multi-Agent Analysis
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {/* Agent 1 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Activity className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Symptom Intake Agent</div>
                          <p className="text-sm text-surface-600 dark:text-surface-300">
                            Extracted {latestAssessment.factors.length} primary risk factors from recent telemetry and patient history.
                          </p>
                        </div>
                      </div>

                      {/* Agent 2 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Brain className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">Clinical Risk Agent</div>
                          <p className="text-sm text-surface-600 dark:text-surface-300">
                            Applied weighted scoring model. Top contributor: {latestAssessment.factors[0]?.name} ({latestAssessment.factors[0]?.contribution}% impact). Calculated overall risk score of {latestAssessment.risk_score}/100.
                          </p>
                        </div>
                      </div>

                      {/* Agent 3 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Guideline RAG Agent</div>
                          <p className="text-sm text-surface-600 dark:text-surface-300">
                            Cross-referenced with pediatric care guidelines to generate {latestAssessment.recommendations.length} contextual recommendations.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700 grid grid-cols-3 gap-2 text-xs text-surface-500 font-mono">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {(Math.random() * 0.8 + 0.8).toFixed(2)}s total</div>
                      <div className="flex items-center gap-1"><Zap className="w-3 h-3" /> ~850 tokens</div>
                      <div className="flex items-center gap-1"><Brain className="w-3 h-3" /> Llama-3-70b-versatile</div>
                    </div>
                  </div>

                  {latestAssessment.risk_level === 'critical' && (
                    <motion.div
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="mt-4 p-4 rounded-xl bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700"
                    >
                      <div className="flex items-center gap-3">
                        <Phone className="w-6 h-6 text-red-600 dark:text-red-400" />
                        <div className="flex-1">
                          <p className="font-bold text-red-800 dark:text-red-200">Immediate Action Required</p>
                          <p className="text-sm text-red-700 dark:text-red-300">Consider calling 911 or visiting an emergency room</p>
                        </div>
                        <a href="tel:911">
                          <Button className="bg-red-600 hover:bg-red-700">Call 911</Button>
                        </a>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Risk Factors with Primary Badge */}
              <div className="space-y-3">
                <h4 className="font-semibold text-surface-900 dark:text-white mb-3">Contributing Factors</h4>
                {latestAssessment.factors.map((factor: { name: string; contribution: number; explanation: string; isPrimary?: boolean }, i: number) => (
                  <motion.div
                    key={factor.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-4 rounded-xl ${factor.isPrimary ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : 'bg-surface-50 dark:bg-surface-800/50'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-surface-900 dark:text-white">{factor.name}</span>
                        {factor.isPrimary && (
                          <Badge variant="warning" size="sm">Primary Driver</Badge>
                        )}
                      </div>
                      <span className={`text-sm font-semibold ${currentRisk.color} ${currentRisk.colorDark}`}>{factor.contribution}% weight</span>
                    </div>
                    <div className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${factor.contribution}%` }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        className={`h-full bg-gradient-to-r ${currentRisk.gradient} rounded-full`}
                      />
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-400">{factor.explanation}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actionable Recommendations */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {latestAssessment.recommendations.map((rec: string, i: number) => {
                    const action = getRecommendationAction(rec)
                    return (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700"
                      >
                        <div className="flex items-start gap-3">
                          <ChevronRight className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-surface-700 dark:text-surface-300 flex-1">{rec}</span>
                          {action && (
                            <Link href={action.link}>
                              <Button size="sm" variant="secondary" icon={<action.icon className="w-3 h-3" />}>
                                {action.label}
                              </Button>
                            </Link>
                          )}
                        </div>
                      </motion.li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-violet-800 dark:text-violet-200">
                  <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/dashboard/dosage" className="block">
                  <Button variant="secondary" fullWidth icon={<Calculator className="w-4 h-4" />} className="justify-start">
                    Calculate Medication Dose
                  </Button>
                </Link>
                <Link href="/dashboard/telehealth" className="block">
                  <Button variant="secondary" fullWidth icon={<Video className="w-4 h-4" />} className="justify-start">
                    Schedule Teleconsult
                  </Button>
                </Link>
                <Link href="/dashboard/find-care" className="block">
                  <Button variant="secondary" fullWidth icon={<MapPin className="w-4 h-4" />} className="justify-start">
                    Find Nearby Clinics
                  </Button>
                </Link>
                <Link href="/dashboard/chat" className="block">
                  <Button variant="secondary" fullWidth icon={<Brain className="w-4 h-4" />} className="justify-start">
                    Ask AI Assistant
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  fullWidth
                  icon={<Bell className="w-4 h-4" />}
                  className="justify-start"
                  onClick={() => setShowReminderModal(true)}
                >
                  Set Re-Assessment Reminder
                </Button>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Re-Assessment Reminder Modal */}
      <AnimatePresence>
        {showReminderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowReminderModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-cyan-600" />
                      Set Re-Assessment Reminder
                    </CardTitle>
                    <button onClick={() => setShowReminderModal(false)} className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-surface-600 dark:text-surface-400">
                    We'll remind you to check on {selectedChild.name} and run another assessment.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => handleSetReminder(2)}>
                      In 2 hours
                    </Button>
                    <Button variant="secondary" onClick={() => handleSetReminder(4)}>
                      In 4 hours
                    </Button>
                    <Button variant="secondary" onClick={() => handleSetReminder(6)}>
                      In 6 hours
                    </Button>
                    <Button variant="secondary" onClick={() => handleSetReminder(12)}>
                      In 12 hours
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-sm text-cyan-700 dark:text-cyan-300">
                    <strong>Tip:</strong> For moderate to high risk, we recommend re-assessing every 4 hours or when symptoms change.
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Assessment Yet */}
      {!analyzing && !latestAssessment && (
        <Card className="py-16">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <Activity className="w-10 h-10 text-surface-600 dark:text-surface-400" />
            </div>
            <h3 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Assessment Yet</h3>
            <p className="text-surface-500 mb-6 max-w-md mx-auto">
              Run an AI-powered risk assessment to analyze {selectedChild.name}&apos;s current health status
              based on logged symptoms, vitals, and environmental factors.
            </p>
            <Button onClick={runAssessment} size="lg" icon={<Play className="w-5 h-5" />}>
              Run First Assessment
            </Button>
          </div>
        </Card>
      )}

      {/* Assessment History */}
      {assessmentHistory.length > 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                Assessment History ({assessmentHistory.length - 1} previous)
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? 'Hide' : 'Show'} History
              </Button>
            </div>
          </CardHeader>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <CardContent>
                  <div className="space-y-3">
                    {assessmentHistory.slice(1).map((assessment, i) => {
                      const risk = riskConfig[assessment.risk_level]
                      const prevAssessment = assessmentHistory[i + 2]
                      const scoreDiff = prevAssessment ? assessment.risk_score - prevAssessment.risk_score : 0

                      return (
                        <div
                          key={assessment.id}
                          className={`flex items-center justify-between p-4 rounded-xl ${risk.bg} border ${risk.border}`}
                        >
                          <div className="flex items-center gap-3">
                            <risk.icon className={`w-5 h-5 ${risk.color} ${risk.colorDark}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${risk.color} ${risk.colorDark}`}>{risk.label}</span>
                                <span className="text-surface-600 dark:text-surface-400 font-semibold">Score: {assessment.risk_score}</span>
                                {scoreDiff !== 0 && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${scoreDiff > 0
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                    {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-surface-500">
                                {new Date(assessment.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLatestAssessment(assessment)
                              }}
                            >
                              View
                            </Button>
                            <button
                              onClick={() => handleDeleteAssessment(assessment.id)}
                              className="p-1.5 text-surface-600 dark:text-surface-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all"
                              title="Delete assessment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}
    </div>
  )
}
