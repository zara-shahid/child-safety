'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Thermometer,
  Heart,
  Wind,
  Activity,
  Bluetooth,
  User,
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import { Button } from './Button'

interface RiskImpact {
  current_score: number
  predicted_score_if_confirmed: number
  severity: 'low' | 'moderate' | 'high' | 'critical'
}

interface SuggestedAction {
  title: string
  message: string
}

interface DetectedEventCardProps {
  id: string
  type: 'temperature' | 'heart_rate' | 'oxygen' | 'activity' | 'symptom'
  value: number | string
  unit: string
  timestamp: string
  source: 'manual' | 'device' | 'ai_inferred'
  deviceName?: string
  deviceConfidence?: number
  status: 'pending' | 'confirmed' | 'ignored'
  thresholdExceeded?: boolean
  thresholdValue?: number
  baselineDiff?: string
  context?: string
  riskImpact?: RiskImpact
  suggestedAction?: SuggestedAction
  onConfirm: (id: string) => void
  onIgnore: (id: string) => void
}

const typeConfig = {
  temperature: {
    icon: Thermometer,
    label: 'Temperature',
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  heart_rate: {
    icon: Heart,
    label: 'Heart Rate',
    color: 'text-pink-500',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    borderColor: 'border-pink-200 dark:border-pink-800',
  },
  oxygen: {
    icon: Wind,
    label: 'Oxygen Saturation',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  activity: {
    icon: Activity,
    label: 'Activity',
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  symptom: {
    icon: AlertTriangle,
    label: 'Symptom',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
}

const sourceIcons = {
  manual: { icon: User, label: 'Manual Entry', color: 'text-surface-500' },
  device: { icon: Bluetooth, label: 'Device Synced', color: 'text-blue-500' },
  ai_inferred: { icon: Sparkles, label: 'AI Detected', color: 'text-purple-500' },
}

export function DetectedEventCard({
  id,
  type,
  value,
  unit,
  timestamp,
  source,
  deviceName,
  deviceConfidence,
  status,
  thresholdExceeded,
  thresholdValue,
  baselineDiff,
  context,
  riskImpact,
  suggestedAction,
  onConfirm,
  onIgnore,
}: DetectedEventCardProps) {
  const [localStatus, setLocalStatus] = useState<'pending' | 'confirmed' | 'ignored'>(status)
  
  const config = typeConfig[type]
  const sourceConfig = sourceIcons[source]
  const TypeIcon = config.icon
  const SourceIcon = sourceConfig.icon

  const timeAgo = () => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const handleConfirm = () => {
    setLocalStatus('confirmed')
    onConfirm(id)
  }

  const handleIgnore = () => {
    setLocalStatus('ignored')
    onIgnore(id)
  }

  if (localStatus === 'ignored') return null

  // Confirmed state - show success message
  if (localStatus === 'confirmed') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 rounded-xl border-2 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-100 dark:bg-green-800">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm">
              Vitals Logged Successfully
            </h4>
            <span className="text-xs text-green-700 dark:text-green-300">
              {config.label} ({value}{unit}) added to medical history. Risk assessment updated.
            </span>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`
        rounded-xl border-2 overflow-hidden
        ${thresholdExceeded 
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' 
          : `${config.bgColor} ${config.borderColor}`
        }
      `}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${thresholdExceeded ? 'bg-amber-100 dark:bg-amber-800' : config.bgColor}`}>
              {thresholdExceeded ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <TypeIcon className={`w-5 h-5 ${config.color}`} />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-surface-900 dark:text-white text-sm">
                {suggestedAction?.title || `New ${config.label} Reading`}
              </h4>
              <span className="text-xs text-surface-500 flex items-center gap-1">
                <SourceIcon className={`w-3 h-3 ${sourceConfig.color}`} />
                via {deviceName || sourceConfig.label} • {timeAgo()}
              </span>
            </div>
          </div>
          
          {/* Value Display */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-1">
              <TypeIcon className={`w-4 h-4 ${thresholdExceeded ? 'text-amber-600' : config.color}`} />
              <span className={`text-2xl font-bold ${thresholdExceeded ? 'text-amber-600 dark:text-amber-400' : 'text-surface-900 dark:text-white'}`}>
                {value}{unit}
              </span>
            </div>
            {baselineDiff && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                baselineDiff.startsWith('+') 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              }`}>
                {baselineDiff} from baseline
              </span>
            )}
          </div>
        </div>

        {/* Context / AI Insight */}
        {(suggestedAction?.message || context) && (
          <div className="p-3 rounded-lg bg-surface-100/80 dark:bg-surface-800/50 mb-3">
            <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
              {suggestedAction?.message || context}
              {riskImpact && (
                <span className="font-semibold text-surface-900 dark:text-white">
                  {' '}This will update the Risk Score to{' '}
                  <span className={`${
                    riskImpact.predicted_score_if_confirmed >= 80 ? 'text-red-600' :
                    riskImpact.predicted_score_if_confirmed >= 60 ? 'text-amber-600' : 'text-surface-900'
                  }`}>
                    {riskImpact.predicted_score_if_confirmed}
                  </span>.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Risk Impact Preview */}
        {riskImpact && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-100/50 dark:bg-surface-800/30 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-surface-500">Risk Impact:</span>
              <span className="text-lg font-bold text-surface-700 dark:text-surface-300">
                {riskImpact.current_score}
              </span>
              <ArrowRight className="w-4 h-4 text-surface-400" />
              <span className={`text-lg font-bold ${
                riskImpact.predicted_score_if_confirmed >= 80 ? 'text-red-600 dark:text-red-400' :
                riskImpact.predicted_score_if_confirmed >= 60 ? 'text-amber-600 dark:text-amber-400' :
                'text-green-600 dark:text-green-400'
              }`}>
                {riskImpact.predicted_score_if_confirmed}
              </span>
            </div>
            <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded-full ${
              riskImpact.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              riskImpact.severity === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
              riskImpact.severity === 'moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            }`}>
              {riskImpact.severity.charAt(0).toUpperCase() + riskImpact.severity.slice(1)}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 bg-surface-900 dark:bg-white hover:bg-black dark:hover:bg-surface-100 text-white dark:text-surface-900 text-sm font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm & Log
          </button>
          <button
            onClick={handleIgnore}
            className="flex-1 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 text-sm font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            False Alarm
          </button>
        </div>
      </div>

      {/* Device Confidence Footer */}
      {deviceConfidence && deviceConfidence > 0 && (
        <div className="px-4 py-2 bg-surface-100/50 dark:bg-surface-800/30 border-t border-surface-200 dark:border-surface-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-500">Device Confidence</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full" 
                  style={{ width: `${deviceConfidence * 100}%` }}
                />
              </div>
              <span className="text-surface-600 dark:text-surface-400 font-medium">
                {Math.round(deviceConfidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Data Provenance Icon component for reuse
export function DataSourceIcon({ 
  source, 
  size = 'sm' 
}: { 
  source: 'manual' | 'device' | 'ai_inferred'
  size?: 'sm' | 'md' 
}) {
  const config = sourceIcons[source]
  const Icon = config.icon
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  
  return (
    <span title={config.label} className="inline-flex items-center">
      <Icon className={`${sizeClass} ${config.color}`} />
    </span>
  )
}

// Trend Sparkline component
export function TrendSparkline({ 
  data, 
  color = 'text-cyan-500',
  height = 24,
  width = 60,
}: { 
  data: number[]
  color?: string
  height?: number
  width?: number
}) {
  if (data.length < 2) return null
  
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  
  const trend = data[data.length - 1] > data[0] ? 'up' : data[data.length - 1] < data[0] ? 'down' : 'stable'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null
  
  return (
    <div className="inline-flex items-center gap-1">
      <svg width={width} height={height} className={color}>
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {TrendIcon && <TrendIcon className={`w-3 h-3 ${trend === 'up' ? 'text-red-500' : 'text-green-500'}`} />}
    </div>
  )
}

export default DetectedEventCard
