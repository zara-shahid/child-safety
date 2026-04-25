'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Thermometer,
  Heart,
  Wind,
  Activity,
  Brain,
  Sparkles,
  Settings,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react'
import { Button } from './Button'
import useStore from '@/store/useStore'

interface PersonalizedBaselinesProps {
  childId: string
  childName: string
  compact?: boolean
}

export function PersonalizedBaselines({ childId, childName, compact = false }: PersonalizedBaselinesProps) {
  const { 
    children, 
    updateChildBaselines, 
    learnBaselinesFromHistory,
    vitalReadings,
  } = useStore()
  
  const [isEditing, setIsEditing] = useState(false)
  const [isLearning, setIsLearning] = useState(false)
  
  const child = children.find(c => c.id === childId)
  const baselines = child?.baselines || {
    temperature: { value: 98.6, unit: '°F', learned: false },
    heart_rate: { value: 80, unit: 'bpm', learned: false },
    oxygen: { value: 98, unit: '%', learned: false },
    respiratory_rate: { value: 20, unit: '/min', learned: false },
  }
  
  const [editValues, setEditValues] = useState({
    temperature: baselines.temperature.value,
    heart_rate: baselines.heart_rate.value,
    oxygen: baselines.oxygen.value,
  })

  // Count readings for this child
  const readingCount = vitalReadings.filter(r => r.child_id === childId).length

  const handleLearnBaselines = async () => {
    setIsLearning(true)
    // Simulate learning delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    learnBaselinesFromHistory(childId)
    setIsLearning(false)
  }

  const handleSaveBaselines = () => {
    updateChildBaselines(childId, {
      temperature: { value: editValues.temperature, unit: '°F', learned: false },
      heart_rate: { value: editValues.heart_rate, unit: 'bpm', learned: false },
      oxygen: { value: editValues.oxygen, unit: '%', learned: false },
    })
    setIsEditing(false)
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
            {childName}'s Baselines:
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-red-500" />
            {baselines.temperature.value}°F
            {baselines.temperature.learned && <Sparkles className="w-3 h-3 text-purple-400" />}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-pink-500" />
            {baselines.heart_rate.value} bpm
            {baselines.heart_rate.learned && <Sparkles className="w-3 h-3 text-purple-400" />}
          </span>
          <span className="flex items-center gap-1">
            <Wind className="w-3 h-3 text-blue-500" />
            {baselines.oxygen.value}%
            {baselines.oxygen.learned && <Sparkles className="w-3 h-3 text-purple-400" />}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-white">
              {childName}'s Personal Baselines
            </h3>
            <p className="text-xs text-surface-500">
              Personalized thresholds for more accurate alerts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsEditing(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Baselines Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Temperature */}
        <div className="p-3 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-surface-500">Temperature</span>
            {baselines.temperature.learned && (
              <span title="Learned from history"><Sparkles className="w-3 h-3 text-purple-400" /></span>
            )}
          </div>
          {isEditing ? (
            <input
              type="number"
              step="0.1"
              value={editValues.temperature}
              onChange={(e) => setEditValues(v => ({ ...v, temperature: parseFloat(e.target.value) }))}
              className="w-full px-2 py-1 text-lg font-bold rounded border border-surface-300 dark:border-surface-600 bg-transparent"
            />
          ) : (
            <div className="text-lg font-bold text-surface-900 dark:text-white">
              {baselines.temperature.value}°F
            </div>
          )}
          <div className="text-xs text-surface-400 mt-1">
            Normal: 97.0-99.0°F
          </div>
        </div>

        {/* Heart Rate */}
        <div className="p-3 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-pink-500" />
            <span className="text-xs font-medium text-surface-500">Heart Rate</span>
            {baselines.heart_rate.learned && (
              <span title="Learned from history"><Sparkles className="w-3 h-3 text-purple-400" /></span>
            )}
          </div>
          {isEditing ? (
            <input
              type="number"
              value={editValues.heart_rate}
              onChange={(e) => setEditValues(v => ({ ...v, heart_rate: parseInt(e.target.value) }))}
              className="w-full px-2 py-1 text-lg font-bold rounded border border-surface-300 dark:border-surface-600 bg-transparent"
            />
          ) : (
            <div className="text-lg font-bold text-surface-900 dark:text-white">
              {baselines.heart_rate.value} bpm
            </div>
          )}
          <div className="text-xs text-surface-400 mt-1">
            Age-based normal
          </div>
        </div>

        {/* Oxygen */}
        <div className="p-3 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-2 mb-2">
            <Wind className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-surface-500">O2 Saturation</span>
            {baselines.oxygen.learned && (
              <span title="Learned from history"><Sparkles className="w-3 h-3 text-purple-400" /></span>
            )}
          </div>
          {isEditing ? (
            <input
              type="number"
              value={editValues.oxygen}
              onChange={(e) => setEditValues(v => ({ ...v, oxygen: parseInt(e.target.value) }))}
              className="w-full px-2 py-1 text-lg font-bold rounded border border-surface-300 dark:border-surface-600 bg-transparent"
            />
          ) : (
            <div className="text-lg font-bold text-surface-900 dark:text-white">
              {baselines.oxygen.value}%
            </div>
          )}
          <div className="text-xs text-surface-400 mt-1">
            Normal: 95-100%
          </div>
        </div>
      </div>

      {/* Actions */}
      {isEditing ? (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)} fullWidth>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSaveBaselines} fullWidth>
            <Check className="w-4 h-4" />
            Save Baselines
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <Info className="w-3 h-3" />
            <span>
              {readingCount >= 3 
                ? `${readingCount} readings available for learning`
                : `Need ${3 - readingCount} more readings to learn baselines`
              }
            </span>
          </div>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleLearnBaselines}
            disabled={readingCount < 3 || isLearning}
          >
            {isLearning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Learning...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Learn from History
              </>
            )}
          </Button>
        </div>
      )}

      {/* Info Banner */}
      <div className="mt-4 p-3 rounded-lg bg-purple-100/50 dark:bg-purple-900/20">
        <p className="text-xs text-purple-700 dark:text-purple-300">
          <strong>Why personalized baselines matter:</strong> If {childName} normally runs cool (97.0°F), 
          a reading of 99.5°F is significant for them even though it's "normal" for most children. 
          Personal baselines help detect issues earlier.
        </p>
      </div>
    </div>
  )
}

export default PersonalizedBaselines
