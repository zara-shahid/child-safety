'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Stethoscope,
  Thermometer,
  Heart,
  Wind,
  Plus,
  X,
  Camera,
  Mic,
  Save,
  Clock,
  AlertTriangle,
  Check,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import useStore from '@/store/useStore'
import { isDemoMode } from '@/lib/api'

const commonSymptoms = [
  { name: 'Fever', icon: Thermometer, color: 'text-red-400' },
  { name: 'Cough', icon: Wind, color: 'text-orange-400' },
  { name: 'Runny Nose', icon: Stethoscope, color: 'text-blue-400' },
  { name: 'Sore Throat', icon: Stethoscope, color: 'text-pink-400' },
  { name: 'Headache', icon: Stethoscope, color: 'text-purple-400' },
  { name: 'Fatigue', icon: Stethoscope, color: 'text-yellow-400' },
  { name: 'Vomiting', icon: Stethoscope, color: 'text-green-400' },
  { name: 'Diarrhea', icon: Stethoscope, color: 'text-teal-400' },
  { name: 'Rash', icon: Stethoscope, color: 'text-rose-400' },
  { name: 'Ear Pain', icon: Stethoscope, color: 'text-amber-400' },
  { name: 'Stomach Pain', icon: Stethoscope, color: 'text-lime-400' },
  { name: 'Difficulty Breathing', icon: Wind, color: 'text-red-500' },
]

const severityLevels = [
  { value: 1, label: 'Mild', color: 'bg-primary-500' },
  { value: 2, label: 'Moderate', color: 'bg-yellow-500' },
  { value: 3, label: 'Severe', color: 'bg-orange-500' },
  { value: 4, label: 'Critical', color: 'bg-red-500' },
]

interface SelectedSymptom {
  name: string
  severity: number
  duration_hours?: number
  notes?: string
}

export default function SymptomsPage() {
  const { selectedChild, addSymptomEntry } = useStore()
  const [selectedSymptoms, setSelectedSymptoms] = useState<SelectedSymptom[]>([])
  const [vitals, setVitals] = useState({
    temperature: '',
    heart_rate: '',
    respiratory_rate: '',
    oxygen_saturation: '',
  })
  const [customSymptom, setCustomSymptom] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [loading, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addSymptom = (name: string) => {
    if (!selectedSymptoms.find(s => s.name === name)) {
      setSelectedSymptoms([...selectedSymptoms, { name, severity: 2 }])
    }
    setShowCustomInput(false)
    setCustomSymptom('')
  }

  const removeSymptom = (name: string) => {
    setSelectedSymptoms(selectedSymptoms.filter(s => s.name !== name))
  }

  const updateSymptom = (name: string, updates: Partial<SelectedSymptom>) => {
    setSelectedSymptoms(selectedSymptoms.map(s =>
      s.name === name ? { ...s, ...updates } : s
    ))
  }

  const handleSave = async () => {
    if (!selectedChild || selectedSymptoms.length === 0) return

    setSaving(true)
    const data = {
      symptoms: selectedSymptoms,
      vitals: {
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
        heart_rate: vitals.heart_rate ? parseInt(vitals.heart_rate) : undefined,
        respiratory_rate: vitals.respiratory_rate ? parseInt(vitals.respiratory_rate) : undefined,
        oxygen_saturation: vitals.oxygen_saturation ? parseInt(vitals.oxygen_saturation) : undefined,
      },
    }

    // Create local entry (works in demo mode and as fallback)
    const localResult = {
      id: `symptom-${Date.now()}`,
      child_id: selectedChild.id,
      symptoms: selectedSymptoms,
      vitals: data.vitals,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    let result = localResult

    // Only try API if not in demo mode
    if (!isDemoMode()) {
      try {
        const { symptomsApi } = await import('@/lib/api')
        result = await symptomsApi.create(selectedChild.id, data)
      } catch (error) {
        // Use local entry as fallback
        result = localResult
      }
    }
    
    addSymptomEntry(result)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setSelectedSymptoms([])
      setVitals({ temperature: '', heart_rate: '', respiratory_rate: '', oxygen_saturation: '' })
    }, 2000)
    setSaving(false)
  }

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Child Selected</h2>
        <p className="text-surface-600 dark:text-surface-400">Please select a child from the sidebar to log symptoms.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Log Symptoms</h1>
        <p className="text-surface-600 dark:text-surface-400">Record {selectedChild.name}&apos;s symptoms for AI analysis</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Symptom Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Common Symptoms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary-400" />
                Select Symptoms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {commonSymptoms.map((symptom) => {
                  const isSelected = selectedSymptoms.find(s => s.name === symptom.name)
                  return (
                    <button
                      key={symptom.name}
                      onClick={() => isSelected ? removeSymptom(symptom.name) : addSymptom(symptom.name)}
                      className={`
                        p-3 rounded-xl border transition-all text-left flex items-center gap-2 active:scale-95 transform
                        ${isSelected
                          ? 'border-primary-500 bg-primary-500/20'
                          : 'border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800/50 hover:border-surface-400 dark:hover:border-surface-600'
                        }
                      `}
                    >
                      <symptom.icon className={`w-5 h-5 ${symptom.color}`} />
                      <span className={isSelected ? 'text-primary-300' : 'text-surface-600 dark:text-surface-300'}>
                        {symptom.name}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary-400 ml-auto" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Custom Symptom */}
              <div className="mt-4">
                {showCustomInput ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter custom symptom"
                      value={customSymptom}
                      onChange={(e) => setCustomSymptom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customSymptom.trim()) {
                          addSymptom(customSymptom.trim())
                        }
                      }}
                    />
                    <Button onClick={() => customSymptom.trim() && addSymptom(customSymptom.trim())}>
                      Add
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCustomInput(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setShowCustomInput(true)}>
                    <Plus className="w-4 h-4" />
                    Add Custom Symptom
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Symptoms Details */}
          {selectedSymptoms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Symptom Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedSymptoms.map((symptom) => (
                  <motion.div
                    key={symptom.name}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-surface-100 dark:bg-surface-800/50 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-white">{symptom.name}</h4>
                      <button
                        onClick={() => removeSymptom(symptom.name)}
                        className="p-1 text-surface-400 hover:text-red-400 transition-all active:scale-90 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Severity */}
                    <div>
                      <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block">Severity</label>
                      <div className="flex gap-2">
                        {severityLevels.map((level) => (
                          <button
                            key={level.value}
                            onClick={() => updateSymptom(symptom.name, { severity: level.value })}
                            className={`
                              flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all active:scale-95 transform
                              ${symptom.severity === level.value
                                ? `${level.color} text-white`
                                : 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-600'
                              }
                            `}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block">Duration</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Hours"
                          value={symptom.duration_hours || ''}
                          onChange={(e) => updateSymptom(symptom.name, { 
                            duration_hours: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                          className="w-24"
                        />
                        <span className="text-surface-600 dark:text-surface-400">hours</span>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block">Notes (optional)</label>
                      <textarea
                        placeholder="Any additional details..."
                        value={symptom.notes || ''}
                        onChange={(e) => updateSymptom(symptom.name, { notes: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:border-primary-500 resize-none"
                        rows={2}
                      />
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Vitals & Actions */}
        <div className="space-y-6">
          {/* Vitals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-400" />
                Vitals (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  Temperature (°F)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="98.6"
                  value={vitals.temperature}
                  onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Heart Rate (bpm)
                </label>
                <Input
                  type="number"
                  placeholder="80"
                  value={vitals.heart_rate}
                  onChange={(e) => setVitals({ ...vitals, heart_rate: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block flex items-center gap-2">
                  <Wind className="w-4 h-4" />
                  Respiratory Rate (breaths/min)
                </label>
                <Input
                  type="number"
                  placeholder="20"
                  value={vitals.respiratory_rate}
                  onChange={(e) => setVitals({ ...vitals, respiratory_rate: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm text-surface-600 dark:text-surface-400 mb-2 block">
                  Oxygen Saturation (%)
                </label>
                <Input
                  type="number"
                  placeholder="98"
                  value={vitals.oxygen_saturation}
                  onChange={(e) => setVitals({ ...vitals, oxygen_saturation: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-accent-400" />
                Add Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-8 border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-xl hover:border-surface-400 dark:hover:border-surface-600 transition-all text-center active:scale-[0.98] transform"
              >
                <Camera className="w-8 h-8 text-surface-600 dark:text-surface-500 mx-auto mb-2" />
                <p className="text-surface-600 dark:text-surface-400">Upload symptom photos</p>
                <p className="text-xs text-surface-600 dark:text-surface-500 mt-1">Rashes, throat, etc.</p>
              </button>
            </CardContent>
          </Card>

          {/* Save Button */}
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-4 rounded-xl bg-primary-500/20 border border-primary-500/30 text-center"
              >
                <Check className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                <p className="text-primary-300 font-medium">Symptoms Saved!</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Button
                  onClick={handleSave}
                  loading={loading}
                  disabled={selectedSymptoms.length === 0}
                  className="w-full"
                  size="lg"
                >
                  <Save className="w-5 h-5" />
                  Save Symptoms
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-xs text-surface-600 dark:text-surface-500 text-center">
            After saving, run a Risk Assessment to get AI analysis
          </p>
        </div>
      </div>
    </div>
  )
}
