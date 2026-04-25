'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  Wind,
  Brain,
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  HelpCircle,
  CheckCircle,
  Thermometer,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import type { PEWSRequest } from '@/lib/api'

interface ClinicalAssessmentProps {
  ageMonths: number
  onAssessmentComplete: (data: PEWSRequest) => void
  onCancel?: () => void
  initialData?: Partial<PEWSRequest>
  isLoading?: boolean
}

// Normal ranges by age for reference
const NORMAL_RANGES = {
  infant: { // 0-12 months
    heart_rate: { min: 100, max: 160 },
    respiratory_rate: { min: 30, max: 60 },
    systolic_bp: { min: 70, max: 90 },
  },
  toddler: { // 1-3 years
    heart_rate: { min: 90, max: 150 },
    respiratory_rate: { min: 24, max: 40 },
    systolic_bp: { min: 80, max: 100 },
  },
  preschool: { // 3-6 years
    heart_rate: { min: 80, max: 120 },
    respiratory_rate: { min: 22, max: 34 },
    systolic_bp: { min: 85, max: 110 },
  },
  school: { // 6-12 years
    heart_rate: { min: 70, max: 110 },
    respiratory_rate: { min: 18, max: 30 },
    systolic_bp: { min: 90, max: 115 },
  },
  adolescent: { // 12+ years
    heart_rate: { min: 60, max: 100 },
    respiratory_rate: { min: 12, max: 20 },
    systolic_bp: { min: 100, max: 120 },
  },
}

const getAgeGroup = (ageMonths: number) => {
  if (ageMonths < 12) return 'infant'
  if (ageMonths < 36) return 'toddler'
  if (ageMonths < 72) return 'preschool'
  if (ageMonths < 144) return 'school'
  return 'adolescent'
}

export function ClinicalAssessment({
  ageMonths,
  onAssessmentComplete,
  onCancel,
  initialData,
  isLoading,
}: ClinicalAssessmentProps) {
  const [activeSection, setActiveSection] = useState<'cardiovascular' | 'respiratory' | 'behavior' | null>('cardiovascular')
  const [showHelp, setShowHelp] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<PEWSRequest>({
    age_months: ageMonths,
    // Cardiovascular
    heart_rate: initialData?.heart_rate,
    systolic_bp: initialData?.systolic_bp,
    capillary_refill_seconds: initialData?.capillary_refill_seconds,
    skin_color: initialData?.skin_color || 'normal',
    // Respiratory
    respiratory_rate: initialData?.respiratory_rate,
    oxygen_saturation: initialData?.oxygen_saturation,
    oxygen_requirement: initialData?.oxygen_requirement || 0.21,
    work_of_breathing: initialData?.work_of_breathing || 'normal',
    grunting: initialData?.grunting || false,
    stridor: initialData?.stridor || false,
    retractions: initialData?.retractions || false,
    // Behavior
    avpu: initialData?.avpu || 'A',
    behavior: initialData?.behavior || 'appropriate',
    parent_concern: initialData?.parent_concern || false,
  })

  const ageGroup = getAgeGroup(ageMonths)
  const normalRanges = NORMAL_RANGES[ageGroup]

  // Calculate live score for immediate feedback
  const liveScore = useMemo(() => {
    let cv = 0
    let resp = 0
    let behav = 0

    // Cardiovascular
    if (formData.skin_color === 'pale') cv = 1
    else if (formData.skin_color === 'mottled') cv = 2
    else if (formData.skin_color === 'grey') cv = 3

    if (formData.capillary_refill_seconds && formData.capillary_refill_seconds > 3) cv = Math.max(cv, 2)
    else if (formData.capillary_refill_seconds && formData.capillary_refill_seconds > 2) cv = Math.max(cv, 1)

    // Respiratory
    if (formData.work_of_breathing === 'mild') resp = 1
    else if (formData.work_of_breathing === 'moderate') resp = 2
    else if (formData.work_of_breathing === 'severe') resp = 3

    if (formData.grunting) resp = Math.max(resp, 3)
    if (formData.stridor) resp = Math.max(resp, 2)
    if (formData.retractions) resp = Math.max(resp, 2)

    if (formData.oxygen_saturation && formData.oxygen_saturation < 92) resp = Math.max(resp, 3)
    else if (formData.oxygen_saturation && formData.oxygen_saturation < 95) resp = Math.max(resp, 2)

    // Behavior
    if (formData.avpu === 'V') behav = 1
    else if (formData.avpu === 'P') behav = 2
    else if (formData.avpu === 'U') behav = 3

    if (formData.behavior === 'irritable') behav = Math.max(behav, 1)
    else if (formData.behavior === 'lethargic') behav = Math.max(behav, 2)

    if (formData.parent_concern) behav = Math.max(behav, 1)

    return {
      total: cv + resp + behav,
      cv,
      resp,
      behav
    }
  }, [formData])

  // Calculate completion status for each section
  const getCardioComplete = () => {
    return formData.heart_rate !== undefined || formData.skin_color !== 'normal' || formData.capillary_refill_seconds !== undefined
  }

  const getRespiratoryComplete = () => {
    return formData.respiratory_rate !== undefined || formData.oxygen_saturation !== undefined || formData.work_of_breathing !== 'normal'
  }

  const getBehaviorComplete = (): boolean => {
    return formData.avpu !== 'A' || formData.behavior !== 'appropriate' || formData.parent_concern === true
  }

  const handleSubmit = () => {
    onAssessmentComplete(formData)
  }

  const renderSection = (
    section: 'cardiovascular' | 'respiratory' | 'behavior',
    icon: React.ReactNode,
    title: string,
    isComplete: boolean
  ) => {
    const isActive = activeSection === section

    return (
      <Card className={`overflow-hidden transition-all ${isComplete ? 'border-emerald-300 dark:border-emerald-700' : ''}`}>
        <button
          onClick={() => setActiveSection(isActive ? null : section)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isComplete ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-surface-100 dark:bg-surface-800'
              }`}>
              {isComplete ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : icon}
            </div>
            <div>
              <h3 className="font-semibold text-surface-900 dark:text-white">{title}</h3>
              <p className="text-xs text-surface-500">
                {isComplete ? 'Assessment complete' : 'Tap to assess'}
              </p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-surface-600 dark:text-surface-400 transition-transform ${isActive ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 border-t border-surface-200 dark:border-surface-700 space-y-4">
                {section === 'cardiovascular' && renderCardiovascularSection()}
                {section === 'respiratory' && renderRespiratorySection()}
                {section === 'behavior' && renderBehaviorSection()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    )
  }

  const renderCardiovascularSection = () => (
    <>
      {/* Heart Rate */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Heart Rate (bpm)
          </label>
          <span className="text-xs text-surface-500">
            Normal: {normalRanges.heart_rate.min}-{normalRanges.heart_rate.max} bpm
          </span>
        </div>
        <input
          type="number"
          value={formData.heart_rate || ''}
          onChange={(e) => setFormData(f => ({ ...f, heart_rate: e.target.value ? parseInt(e.target.value) : undefined }))}
          placeholder="e.g., 100"
          className="w-full px-4 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
        />
      </div>

      {/* Skin Color */}
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">
          Skin Color
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: 'normal', label: 'Normal/Pink', color: 'emerald' },
            { value: 'pale', label: 'Pale', color: 'amber' },
            { value: 'mottled', label: 'Mottled', color: 'orange' },
            { value: 'grey', label: 'Grey/Blue', color: 'red' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData(f => ({ ...f, skin_color: option.value as any }))}
              className={`p-2 rounded-lg border text-sm font-medium transition-all ${formData.skin_color === option.value
                ? `bg-${option.color}-100 dark:bg-${option.color}-900/30 border-${option.color}-300 dark:border-${option.color}-700 text-${option.color}-700 dark:text-${option.color}-300`
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Capillary Refill */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Capillary Refill Time
          </label>
          <button
            type="button"
            onClick={() => setShowHelp(showHelp === 'capRefill' ? null : 'capRefill')}
            className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-600"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
        {showHelp === 'capRefill' && (
          <div className="p-3 mb-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-sm text-cyan-700 dark:text-cyan-300">
            Press firmly on fingernail or toe for 5 seconds, then release. Count how long it takes for color to return.
            Normal is &lt;2 seconds.
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 1.5, label: '< 2 sec', color: 'emerald' },
            { value: 2.5, label: '2-3 sec', color: 'amber' },
            { value: 4, label: '> 3 sec', color: 'red' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData(f => ({ ...f, capillary_refill_seconds: option.value }))}
              className={`p-2 rounded-lg border text-sm font-medium transition-all ${formData.capillary_refill_seconds === option.value
                ? `bg-${option.color}-100 dark:bg-${option.color}-900/30 border-${option.color}-300 dark:border-${option.color}-700`
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Blood Pressure (optional) */}
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">
          Blood Pressure (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={formData.systolic_bp || ''}
            onChange={(e) => setFormData(f => ({ ...f, systolic_bp: e.target.value ? parseInt(e.target.value) : undefined }))}
            placeholder="Systolic"
            className="w-24 px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm"
          />
          <span className="text-surface-500">/</span>
          <span className="text-surface-600 dark:text-surface-400 text-sm">mmHg</span>
        </div>
      </div>
    </>
  )

  const renderRespiratorySection = () => (
    <>
      {/* Respiratory Rate */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Respiratory Rate (breaths/min)
          </label>
          <span className="text-xs text-surface-500">
            Normal: {normalRanges.respiratory_rate.min}-{normalRanges.respiratory_rate.max}
          </span>
        </div>
        <input
          type="number"
          value={formData.respiratory_rate || ''}
          onChange={(e) => setFormData(f => ({ ...f, respiratory_rate: e.target.value ? parseInt(e.target.value) : undefined }))}
          placeholder="Count breaths for 1 minute"
          className="w-full px-4 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
        />
      </div>

      {/* Oxygen Saturation */}
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">
          Oxygen Saturation (SpO2 %)
        </label>
        <input
          type="number"
          value={formData.oxygen_saturation || ''}
          onChange={(e) => setFormData(f => ({ ...f, oxygen_saturation: e.target.value ? parseInt(e.target.value) : undefined }))}
          placeholder="e.g., 98"
          className="w-full px-4 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
        />
        <p className="text-xs text-surface-500 mt-1">If using pulse oximeter. Normal is 95-100%.</p>
      </div>

      {/* Work of Breathing */}
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">
          Work of Breathing
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'normal', label: 'Normal', desc: 'Breathing easily', color: 'emerald' },
            { value: 'mild', label: 'Mild Increase', desc: 'Slightly labored', color: 'amber' },
            { value: 'moderate', label: 'Moderate', desc: 'Visibly working', color: 'orange' },
            { value: 'severe', label: 'Severe', desc: 'Struggling', color: 'red' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData(f => ({ ...f, work_of_breathing: option.value as any }))}
              className={`p-3 rounded-lg border text-left transition-all ${formData.work_of_breathing === option.value
                ? `bg-${option.color}-100 dark:bg-${option.color}-900/30 border-${option.color}-300 dark:border-${option.color}-700`
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                }`}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-surface-500">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Respiratory Distress Signs */}
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">
          Signs of Respiratory Distress
        </label>
        <div className="space-y-2">
          {[
            { key: 'retractions', label: 'Retractions', desc: 'Ribs or neck muscles pulling in with each breath' },
            { key: 'grunting', label: 'Grunting', desc: 'Making grunting sounds when breathing out' },
            { key: 'stridor', label: 'Stridor', desc: 'High-pitched squeaking sound when breathing in' },
          ].map((sign) => (
            <label
              key={sign.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData[sign.key as keyof PEWSRequest]
                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                }`}
            >
              <input
                type="checkbox"
                checked={formData[sign.key as keyof PEWSRequest] as boolean || false}
                onChange={(e) => setFormData(f => ({ ...f, [sign.key]: e.target.checked }))}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-sm">{sign.label}</div>
                <div className="text-xs text-surface-500">{sign.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* On Oxygen */}
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">
          Is child on supplemental oxygen?
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormData(f => ({ ...f, oxygen_requirement: 0.21 }))}
            className={`flex-1 p-2 rounded-lg border text-sm font-medium ${formData.oxygen_requirement === 0.21
              ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700'
              : 'border-surface-200 dark:border-surface-700'
              }`}
          >
            No (Room Air)
          </button>
          <button
            type="button"
            onClick={() => setFormData(f => ({ ...f, oxygen_requirement: 0.4 }))}
            className={`flex-1 p-2 rounded-lg border text-sm font-medium ${formData.oxygen_requirement && formData.oxygen_requirement > 0.21
              ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
              : 'border-surface-200 dark:border-surface-700'
              }`}
          >
            Yes
          </button>
        </div>
      </div>
    </>
  )

  const renderBehaviorSection = () => (
    <>
      {/* AVPU Scale */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Alertness (AVPU Scale)
          </label>
          <button
            type="button"
            onClick={() => setShowHelp(showHelp === 'avpu' ? null : 'avpu')}
            className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-600"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
        {showHelp === 'avpu' && (
          <div className="p-3 mb-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-sm text-cyan-700 dark:text-cyan-300">
            A = Alert (awake and aware), V = responds to Voice, P = responds only to Pain, U = Unresponsive
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: 'A', label: 'Alert', desc: 'Awake & aware', color: 'emerald' },
            { value: 'V', label: 'Voice', desc: 'Responds to voice', color: 'amber' },
            { value: 'P', label: 'Pain', desc: 'Only to pain', color: 'orange' },
            { value: 'U', label: 'Unresponsive', desc: 'No response', color: 'red' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData(f => ({ ...f, avpu: option.value as any }))}
              className={`p-2 rounded-lg border text-sm transition-all ${formData.avpu === option.value
                ? `bg-${option.color}-100 dark:bg-${option.color}-900/30 border-${option.color}-300 dark:border-${option.color}-700`
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                }`}
            >
              <div className="font-bold">{option.value}</div>
              <div className="text-xs">{option.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Behavior */}
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">
          Behavior
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'appropriate', label: 'Normal', desc: 'Acting like usual', color: 'emerald' },
            { value: 'irritable', label: 'Irritable', desc: 'Fussy, hard to console', color: 'amber' },
            { value: 'lethargic', label: 'Lethargic', desc: 'Very sleepy, weak', color: 'red' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData(f => ({ ...f, behavior: option.value as any }))}
              className={`p-3 rounded-lg border text-left transition-all ${formData.behavior === option.value
                ? `bg-${option.color}-100 dark:bg-${option.color}-900/30 border-${option.color}-300 dark:border-${option.color}-700`
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                }`}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-surface-500">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Parent Concern */}
      <div>
        <label
          className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${formData.parent_concern
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
            : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
            }`}
        >
          <input
            type="checkbox"
            checked={formData.parent_concern || false}
            onChange={(e) => setFormData(f => ({ ...f, parent_concern: e.target.checked }))}
            className="mt-1"
          />
          <div>
            <div className="font-semibold text-surface-900 dark:text-white">
              "Something feels really wrong"
            </div>
            <div className="text-sm text-surface-500">
              Check this if your gut tells you something is seriously wrong, even if you can't pinpoint exactly what.
              Parent intuition is clinically significant.
            </div>
          </div>
        </label>
      </div>
    </>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-violet-900 dark:text-violet-100">
                Clinical Assessment (PEWS)
              </h3>
              <p className="text-sm text-violet-700 dark:text-violet-300 pr-4">
                This assessment uses the Pediatric Early Warning Score. Live triaging is active.
              </p>
            </div>
          </div>

          {/* Live Score Indicator */}
          <motion.div
            key={liveScore.total}
            initial={{ scale: 1.1, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center py-1.5 px-4 bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-violet-100 dark:border-violet-800"
          >
            <div className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-0.5">Live Score</div>
            <div className={`text-2xl font-bold leading-none ${liveScore.total >= 7 ? 'text-red-500' :
                liveScore.total >= 5 ? 'text-orange-500' :
                  liveScore.total >= 3 ? 'text-amber-500' :
                    'text-emerald-500'
              }`}>
              {liveScore.total}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Assessment Sections */}
      <div className="space-y-3">
        {renderSection(
          'cardiovascular',
          <Heart className="w-5 h-5 text-pink-500" />,
          'Cardiovascular Assessment',
          getCardioComplete()
        )}

        {renderSection(
          'respiratory',
          <Wind className="w-5 h-5 text-cyan-500" />,
          'Respiratory Assessment',
          getRespiratoryComplete()
        )}

        {renderSection(
          'behavior',
          <Brain className="w-5 h-5 text-purple-500" />,
          'Behavior & Alertness',
          getBehaviorComplete()
        )}
      </div>

      {/* Summary of Concerns */}
      {(formData.skin_color !== 'normal' || formData.work_of_breathing !== 'normal' ||
        formData.grunting || formData.stridor || formData.retractions ||
        formData.avpu !== 'A' || formData.behavior !== 'appropriate' || formData.parent_concern) && (
          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">Concerns Noted</h4>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                    {formData.skin_color !== 'normal' && <li>• Abnormal skin color: {formData.skin_color}</li>}
                    {formData.work_of_breathing !== 'normal' && <li>• Increased work of breathing: {formData.work_of_breathing}</li>}
                    {formData.grunting && <li>• Grunting present</li>}
                    {formData.stridor && <li>• Stridor present</li>}
                    {formData.retractions && <li>• Retractions present</li>}
                    {formData.avpu !== 'A' && <li>• Altered alertness: {formData.avpu}</li>}
                    {formData.behavior !== 'appropriate' && <li>• Abnormal behavior: {formData.behavior}</li>}
                    {formData.parent_concern && <li>• Parent concern noted</li>}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button
          fullWidth
          onClick={handleSubmit}
          disabled={isLoading}
          className="bg-gradient-to-r from-violet-500 to-purple-600"
        >
          {isLoading ? 'Calculating PEWS Score...' : 'Calculate Clinical Score'}
        </Button>
      </div>
    </div>
  )
}

export default ClinicalAssessment
