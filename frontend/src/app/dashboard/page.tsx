'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  Sun,
  Droplets,
  ChevronRight,
  Plus,
  Stethoscope,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Phone,
  MapPin,
  Sparkles,
  Shield,
  Trash2,
  Bluetooth,
  Radio,
  Zap,
  Info,
  Pill,
  Timer,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, DetectedEventCard, TrendSparkline, PersonalizedBaselines } from '@/components/ui'
import { AnimatePresence } from 'framer-motion'
import useStore from '@/store/useStore'
import { isDemoMode } from '@/lib/api'

// Risk configuration with Stitch-style colors
const riskConfig = {
  low: {
    color: 'text-success-500',
    bg: 'bg-success-500/10',
    border: 'border-success-500/20',
    stroke: '#34d399',
    icon: CheckCircle,
    label: 'Low Risk',
    gradient: 'from-success-400 to-success-600',
  },
  moderate: {
    color: 'text-accent-400',
    bg: 'bg-accent-500/10',
    border: 'border-accent-500/20',
    stroke: '#fbbf24',
    icon: AlertCircle,
    label: 'Moderate',
    gradient: 'from-accent-400 to-accent-600',
  },
  high: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    stroke: '#fb923c',
    icon: AlertCircle,
    label: 'High Risk',
    gradient: 'from-orange-400 to-orange-600',
  },
  critical: {
    color: 'text-danger-400',
    bg: 'bg-danger-500/10',
    border: 'border-danger-500/20',
    stroke: '#f87171',
    icon: Phone,
    label: 'Critical',
    gradient: 'from-danger-400 to-danger-600',
  },
}

// Circular Progress Ring Component (Stitch-style)
const RiskGauge = ({ score, riskLevel }: { score: number; riskLevel: string }) => {
  const risk = riskConfig[riskLevel as keyof typeof riskConfig]
  const circumference = 2 * Math.PI * 54 // radius = 54
  const progress = (score / 100) * circumference

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-surface-200 dark:text-navy-800"
        />
        {/* Progress circle */}
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={risk.stroke}
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${progress} ${circumference}` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${risk.stroke}40)` }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className={`text-4xl font-bold ${risk.color}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">/ 100</span>
      </div>
    </div>
  )
}

// Device Status Component - Shows sensor health
const DeviceStatus = ({ 
  battery, 
  signal, 
  lastSync,
  source 
}: { 
  battery?: number
  signal?: 'strong' | 'medium' | 'weak' | 'none'
  lastSync?: Date
  source?: string
}) => {
  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-success-400'
    if (level > 20) return 'text-accent-400'
    return 'text-danger-400'
  }
  
  const getSignalBars = (strength: string) => {
    switch (strength) {
      case 'strong': return [true, true, true, true]
      case 'medium': return [true, true, true, false]
      case 'weak': return [true, true, false, false]
      default: return [true, false, false, false]
    }
  }
  
  const formatLastSync = (date: Date) => {
    const diff = Date.now() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  return (
    <div className="flex items-center gap-2 text-[10px]">
      {/* Source device */}
      {source && (
        <div className="flex items-center gap-1 text-surface-600 dark:text-surface-400">
          <Bluetooth className="w-3 h-3 text-primary-400" />
          <span>{source}</span>
        </div>
      )}
      
      {/* Signal strength */}
      {signal && (
        <div className="flex items-center gap-0.5" title={`Signal: ${signal}`}>
          {getSignalBars(signal).map((active, i) => (
            <div 
              key={i} 
              className={`w-0.5 rounded-full ${active ? 'bg-primary-400' : 'bg-surface-600'}`}
              style={{ height: `${6 + i * 2}px` }}
            />
          ))}
        </div>
      )}
      
      {/* Battery */}
      {battery !== undefined && (
        <div className={`flex items-center gap-0.5 ${getBatteryColor(battery)}`} title={`Battery: ${battery}%`}>
          <svg className="w-4 h-3" viewBox="0 0 24 12" fill="currentColor">
            <rect x="0" y="1" width="20" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="20" y="3.5" width="3" height="5" rx="1" fill="currentColor"/>
            <rect x="2" y="3" width={`${(battery / 100) * 16}`} height="6" rx="1" fill="currentColor"/>
          </svg>
          <span className="text-[9px]">{battery}%</span>
        </div>
      )}
      
      {/* Last sync */}
      {lastSync && (
        <div className="flex items-center gap-0.5 text-surface-400" title={`Last sync: ${lastSync.toLocaleTimeString()}`}>
          <Radio className="w-2.5 h-2.5" />
          <span>{formatLastSync(lastSync)}</span>
        </div>
      )}
    </div>
  )
}

// Mini Sparkline Component
const MiniSparkline = ({ 
  data, 
  color = '#22d3ee',
  height = 24,
  showDots = false 
}: { 
  data: number[]
  color?: string
  height?: number
  showDots?: boolean
}) => {
  if (data.length < 2) return null
  
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 60
  const padding = 2
  
  const points = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: height - padding - ((val - min) / range) * (height - padding * 2)
  }))
  
  const pathD = points.reduce((acc, point, i) => {
    return i === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`
  }, '')

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      
      {/* Fill area */}
      <path 
        d={`${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      
      {/* Line */}
      <path 
        d={pathD} 
        fill="none" 
        stroke={color} 
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* End dot */}
      {showDots && points.length > 0 && (
        <circle 
          cx={points[points.length - 1].x} 
          cy={points[points.length - 1].y} 
          r="2.5" 
          fill={color}
        />
      )}
    </svg>
  )
}

// Enhanced Vital Card Component (Stitch-style with Device Status & Sparkline)
const VitalCard = ({ 
  icon: Icon, 
  label, 
  value, 
  unit, 
  trend, 
  trendValue,
  iconColor,
  source,
  deviceStatus,
  sparklineData,
  normalRange,
  isAbnormal,
}: { 
  icon: any
  label: string
  value: string | number
  unit: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  iconColor: string
  source?: string
  deviceStatus?: {
    battery?: number
    signal?: 'strong' | 'medium' | 'weak' | 'none'
    lastSync?: Date
  }
  sparklineData?: number[]
  normalRange?: string
  isAbnormal?: boolean
}) => {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus
  const sparkColor = isAbnormal ? '#f87171' : trend === 'down' ? '#34d399' : '#22d3ee'

  return (
    <div className={`vital-card group ${isAbnormal ? 'ring-1 ring-danger-400/50' : ''}`}>
      {/* Header row with icon and device status */}
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <DeviceStatus 
          source={source}
          battery={deviceStatus?.battery}
          signal={deviceStatus?.signal}
          lastSync={deviceStatus?.lastSync}
        />
      </div>
      
      {/* Value and Sparkline row */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={`vital-value ${isAbnormal ? 'text-danger-400' : 'text-surface-900 dark:text-white'}`}>
              {value}
            </span>
            <span className="vital-unit">{unit}</span>
          </div>
          {normalRange && (
            <div className="text-[10px] text-surface-600 dark:text-surface-400 mt-0.5">
              Normal: {normalRange}
            </div>
          )}
        </div>
        
        {/* Sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <MiniSparkline data={sparklineData} color={sparkColor} showDots={true} />
        )}
      </div>
      
      {/* Footer row with label and trend */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-surface-500 dark:text-surface-400">{label}</span>
        {trend && trendValue && (
          <div className={`flex items-center gap-0.5 text-xs ${
            trend === 'up' ? (isAbnormal ? 'text-danger-400' : 'text-accent-400') 
            : trend === 'down' ? 'text-success-400' 
            : 'text-surface-600 dark:text-surface-400'
          }`}>
            <TrendIcon className="w-3 h-3" />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Medication Timer Card (from mockup)
const MedicationTimerCard = ({ 
  name, 
  dosage, 
  timeRemaining, 
  isReady,
  onLogDose 
}: { 
  name: string
  dosage: string
  timeRemaining: string
  isReady: boolean
  onLogDose: () => void
}) => (
  <div className={`medication-card ${isReady ? 'ready' : 'waiting'} p-4`}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${isReady ? 'bg-success-500' : 'bg-accent-500'} flex items-center justify-center`}>
          <Pill className="w-5 h-5 text-white" />
        </div>
        <div>
          <h4 className="font-semibold text-surface-900 dark:text-white">{name}</h4>
          <p className="text-xs text-surface-500 dark:text-surface-400">{dosage}</p>
        </div>
      </div>
      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
        isReady 
          ? 'bg-success-500/20 text-success-400' 
          : 'bg-accent-500/20 text-accent-400'
      }`}>
        {isReady ? 'READY' : 'WAITING'}
      </div>
    </div>
    <div className="flex items-center justify-between">
      <div className={`countdown-display text-3xl font-bold ${isReady ? 'countdown-ready' : 'countdown-waiting'}`}>
        {timeRemaining}
      </div>
      <Button 
        onClick={onLogDose}
        className={`${isReady ? 'bg-success-500 hover:bg-success-600' : 'bg-accent-500 hover:bg-accent-600'} text-white`}
        size="sm"
      >
        <Play className="w-4 h-4 mr-1" />
        Log Dose
      </Button>
    </div>
  </div>
)

// Symptom History Bar (from mockup)
const SymptomHistoryBar = ({ 
  symptoms 
}: { 
  symptoms: Array<{ name: string; severity: number; color: string }> 
}) => (
  <div className="space-y-2">
    <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
      Symptom History
    </h4>
    <div className="flex gap-1 h-8">
      {symptoms.map((symptom, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
          className={`flex-1 rounded ${symptom.color} origin-bottom`}
          style={{ opacity: 0.3 + (symptom.severity / 5) * 0.7 }}
          title={`${symptom.name}: Severity ${symptom.severity}/5`}
        />
      ))}
    </div>
    <div className="flex justify-between text-[10px] text-surface-600 dark:text-surface-400">
      <span>7 days ago</span>
      <span>Today</span>
    </div>
  </div>
)

// Data Reconciliation Alert - Prompts when sensor data conflicts with manual logs
const DataReconciliationAlert = ({
  sensorData,
  hasSymptomLogged,
  onLogSymptom,
  onDismiss,
}: {
  sensorData: { type: string; value: number; threshold: number }
  hasSymptomLogged: boolean
  onLogSymptom: () => void
  onDismiss: () => void
}) => {
  if (hasSymptomLogged) return null
  
  const isAbnormal = sensorData.value > sensorData.threshold
  if (!isAbnormal) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      className="bg-accent-500/10 border border-accent-500/30 rounded-xl p-4 mb-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-500/20 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-accent-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-surface-900 dark:text-white text-sm">
            Data Reconciliation Needed
          </h4>
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
            Sensor detected elevated {sensorData.type} ({sensorData.value}°F) but no symptom has been logged.
            Would you like to record this?
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={onLogSymptom} className="bg-accent-500 hover:bg-accent-600 text-white">
              <Plus className="w-3 h-3 mr-1" />
              Log Fever Symptom
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Alert Configuration Status Component
const AlertConfigStatus = ({
  soundEnabled,
  pushEnabled,
  customThreshold,
  onConfigure,
}: {
  soundEnabled: boolean
  pushEnabled: boolean
  customThreshold?: number
  onConfigure: () => void
}) => (
  <div className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-navy-900/50 rounded-xl">
    <div className="flex items-center gap-2">
      {/* Sound indicator */}
      <div 
        className={`w-6 h-6 rounded-full flex items-center justify-center ${
          soundEnabled ? 'bg-success-500/20 text-success-400' : 'bg-surface-200 dark:bg-navy-800 text-surface-600 dark:text-surface-400'
        }`}
        title={soundEnabled ? 'Sound alerts enabled' : 'Sound alerts disabled'}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          {soundEnabled ? (
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          ) : (
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          )}
        </svg>
      </div>
      
      {/* Push notification indicator */}
      <div 
        className={`w-6 h-6 rounded-full flex items-center justify-center ${
          pushEnabled ? 'bg-success-500/20 text-success-400' : 'bg-surface-200 dark:bg-navy-800 text-surface-600 dark:text-surface-400'
        }`}
        title={pushEnabled ? 'Push notifications enabled' : 'Push notifications disabled'}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
        </svg>
      </div>
    </div>
    
    <div className="flex-1 text-xs">
      <span className="text-surface-500 dark:text-surface-400">
        Alert threshold: <span className="text-surface-900 dark:text-white font-medium">{customThreshold || 100.4}°F</span>
      </span>
    </div>
    
    <button 
      onClick={onConfigure}
      className="text-xs text-primary-400 hover:text-primary-300 font-medium"
    >
      Configure
    </button>
  </div>
)

// Contributing Factors with proper weighting explanation
const ContributingFactorsDisplay = ({
  factors,
  totalScore,
}: {
  factors: Array<{ name: string; score: number; maxScore: number; weight: number }>
  totalScore: number
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
        Contributing Factors (PEWS Weighted)
      </h4>
      <div className="flex items-center gap-1 text-[10px] text-surface-600 dark:text-surface-400">
        <Info className="w-3 h-3" />
        <span>Hover for details</span>
      </div>
    </div>
    
    {factors.map((factor, i) => {
      const percentage = factor.maxScore > 0 ? (factor.score / factor.maxScore) * 100 : 0
      const contribution = (factor.score * factor.weight / 100).toFixed(1)
      
      return (
        <div key={i} className="group" title={`${factor.name}: ${factor.score}/${factor.maxScore} points × ${factor.weight}% weight = ${contribution} contribution to total`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-surface-600 dark:text-surface-300">{factor.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-surface-600 dark:text-surface-400">
                {factor.score}/{factor.maxScore} pts
              </span>
              <span className="text-xs font-medium text-surface-900 dark:text-white">
                {percentage.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-surface-200 dark:bg-navy-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              className={`h-full rounded-full ${
                percentage > 75 ? 'bg-danger-400' : 
                percentage > 50 ? 'bg-accent-400' : 
                percentage > 25 ? 'bg-primary-400' : 'bg-success-400'
              }`}
            />
          </div>
          <div className="text-[10px] text-surface-600 dark:text-surface-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            Weight: {factor.weight}% | Contribution: +{contribution} to overall score
          </div>
        </div>
      )
    })}
    
    <div className="pt-2 border-t border-surface-200 dark:border-navy-800">
      <div className="flex items-center justify-between text-xs">
        <span className="text-surface-500 dark:text-surface-400">Total Weighted Score:</span>
        <span className="font-bold text-surface-900 dark:text-white">{totalScore}/100</span>
      </div>
    </div>
  </div>
)

// Accessibility Panel - Font size and contrast controls
const AccessibilityPanel = ({
  isOpen,
  onClose,
  fontSize,
  setFontSize,
  highContrast,
  setHighContrast,
}: {
  isOpen: boolean
  onClose: () => void
  fontSize: 'normal' | 'large' | 'xlarge'
  setFontSize: (size: 'normal' | 'large' | 'xlarge') => void
  highContrast: boolean
  setHighContrast: (value: boolean) => void
}) => {
  if (!isOpen) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="absolute right-0 top-12 w-72 bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-surface-200 dark:border-navy-800 p-4 z-50"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-surface-900 dark:text-white text-sm">Accessibility</h3>
        <button onClick={onClose} className="text-surface-600 dark:text-surface-400 hover:text-surface-700">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Font Size */}
      <div className="mb-4">
        <label className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2 block">
          Text Size
        </label>
        <div className="flex gap-2">
          {(['normal', 'large', 'xlarge'] as const).map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                fontSize === size
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface-100 dark:bg-navy-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-navy-700'
              }`}
            >
              {size === 'normal' ? 'A' : size === 'large' ? 'A+' : 'A++'}
            </button>
          ))}
        </div>
      </div>
      
      {/* High Contrast */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-surface-900 dark:text-white">High Contrast</span>
          <p className="text-xs text-surface-500 dark:text-surface-400">Increase color contrast</p>
        </div>
        <button
          onClick={() => setHighContrast(!highContrast)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            highContrast ? 'bg-primary-500' : 'bg-surface-300 dark:bg-navy-700'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              highContrast ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>
    </motion.div>
  )
}

// Device Connection Alert - Shows when devices disconnect
const DeviceConnectionAlert = ({
  devices,
  onReconnect,
  onDismiss,
}: {
  devices: Array<{ name: string; status: 'connected' | 'disconnected' | 'weak'; lastSeen: Date }>
  onReconnect: (deviceName: string) => void
  onDismiss: () => void
}) => {
  const disconnectedDevices = devices.filter(d => d.status === 'disconnected')
  const weakDevices = devices.filter(d => d.status === 'weak')
  
  if (disconnectedDevices.length === 0 && weakDevices.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl mb-4 ${
        disconnectedDevices.length > 0 
          ? 'bg-danger-500/10 border border-danger-500/30' 
          : 'bg-accent-500/10 border border-accent-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          disconnectedDevices.length > 0 ? 'bg-danger-500/20' : 'bg-accent-500/20'
        }`}>
          <Bluetooth className={`w-5 h-5 ${disconnectedDevices.length > 0 ? 'text-danger-400' : 'text-accent-400'}`} />
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold text-sm ${disconnectedDevices.length > 0 ? 'text-danger-600 dark:text-danger-300' : 'text-accent-600 dark:text-accent-300'}`}>
            {disconnectedDevices.length > 0 ? 'Device Disconnected' : 'Weak Connection'}
          </h4>
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
            {disconnectedDevices.length > 0 
              ? `${disconnectedDevices.map(d => d.name).join(', ')} lost connection. Data may be stale.`
              : `${weakDevices.map(d => d.name).join(', ')} has weak signal. Consider moving closer.`
            }
          </p>
          <div className="flex gap-2 mt-3">
            {disconnectedDevices.map(device => (
              <Button 
                key={device.name}
                size="sm" 
                onClick={() => onReconnect(device.name)}
                className={disconnectedDevices.length > 0 ? 'bg-danger-500 hover:bg-danger-600' : 'bg-accent-500 hover:bg-accent-600'}
              >
                <Radio className="w-3 h-3 mr-1" />
                Reconnect {device.name}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Custom Threshold Configuration Modal
const ThresholdConfigModal = ({
  isOpen,
  onClose,
  thresholds,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  thresholds: { temperature: number; heartRate: number; oxygen: number }
  onSave: (thresholds: { temperature: number; heartRate: number; oxygen: number }) => void
}) => {
  const [localThresholds, setLocalThresholds] = useState(thresholds)
  
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-surface-900 dark:text-white">Custom Alert Thresholds</h2>
          <button onClick={onClose} className="text-surface-600 dark:text-surface-400 hover:text-surface-700 p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <p className="text-sm text-surface-600 dark:text-surface-400 mb-6">
          Set personalized alert thresholds for your child. We'll notify you when vitals exceed these values.
        </p>
        
        <div className="space-y-5">
          {/* Temperature Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-900 dark:text-white flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-danger-500" />
                Temperature Alert
              </label>
              <span className="text-sm font-bold text-primary-500">{localThresholds.temperature}°F</span>
            </div>
            <input
              type="range"
              min="99"
              max="104"
              step="0.1"
              value={localThresholds.temperature}
              onChange={(e) => setLocalThresholds(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-surface-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-xs text-surface-600 dark:text-surface-400 mt-1">
              <span>99°F</span>
              <span className="text-success-500">Clinical: 100.4°F</span>
              <span>104°F</span>
            </div>
          </div>
          
          {/* Heart Rate Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-900 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                Heart Rate Alert
              </label>
              <span className="text-sm font-bold text-primary-500">{localThresholds.heartRate} bpm</span>
            </div>
            <input
              type="range"
              min="90"
              max="180"
              step="5"
              value={localThresholds.heartRate}
              onChange={(e) => setLocalThresholds(prev => ({ ...prev, heartRate: parseInt(e.target.value) }))}
              className="w-full h-2 bg-surface-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-xs text-surface-600 dark:text-surface-400 mt-1">
              <span>90 bpm</span>
              <span className="text-success-500">Clinical: 120 bpm</span>
              <span>180 bpm</span>
            </div>
          </div>
          
          {/* SpO2 Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary-500" />
                SpO2 Alert (below)
              </label>
              <span className="text-sm font-bold text-primary-500">{localThresholds.oxygen}%</span>
            </div>
            <input
              type="range"
              min="88"
              max="98"
              step="1"
              value={localThresholds.oxygen}
              onChange={(e) => setLocalThresholds(prev => ({ ...prev, oxygen: parseInt(e.target.value) }))}
              className="w-full h-2 bg-surface-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-xs text-surface-600 dark:text-surface-400 mt-1">
              <span>88%</span>
              <span className="text-success-500">Clinical: 95%</span>
              <span>98%</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-8">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            className="flex-1 bg-primary-500 hover:bg-primary-600" 
            onClick={() => {
              onSave(localThresholds)
              onClose()
            }}
          >
            Save Thresholds
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// Medication-Vital Correlation Card
const MedicationVitalCorrelation = ({
  medications,
  vitalHistory,
}: {
  medications: Array<{ name: string; time: Date; type: string }>
  vitalHistory: Array<{ time: Date; temperature: number }>
}) => {
  // Find correlation between medication doses and temperature drops
  const correlations = medications.map(med => {
    const medTime = med.time.getTime()
    const tempBefore = vitalHistory.find(v => v.time.getTime() < medTime && v.time.getTime() > medTime - 30 * 60000)
    const tempAfter = vitalHistory.find(v => v.time.getTime() > medTime + 60 * 60000 && v.time.getTime() < medTime + 3 * 60 * 60000)
    
    return {
      medication: med.name,
      time: med.time,
      tempDrop: tempBefore && tempAfter ? tempBefore.temperature - tempAfter.temperature : null,
      effective: tempBefore && tempAfter ? tempAfter.temperature < tempBefore.temperature : null,
    }
  }).filter(c => c.tempDrop !== null)

  if (correlations.length === 0) return null

  return (
    <div className="bg-surface-50 dark:bg-navy-900/50 rounded-xl p-4 mt-4">
      <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Zap className="w-3 h-3 text-primary-400" />
        Medication Effectiveness
      </h4>
      
      <div className="space-y-3">
        {correlations.slice(-3).map((corr, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              corr.effective ? 'bg-success-500/20 text-success-400' : 'bg-accent-500/20 text-accent-400'
            }`}>
              {corr.effective ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-surface-900 dark:text-white">{corr.medication}</span>
                <span className={`text-xs font-medium ${corr.effective ? 'text-success-400' : 'text-accent-400'}`}>
                  {corr.tempDrop && corr.tempDrop > 0 ? `-${corr.tempDrop.toFixed(1)}°F` : 'No change'}
                </span>
              </div>
              <div className="text-xs text-surface-600 dark:text-surface-400">
                {corr.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} • 
                {corr.effective ? ' Effective response' : ' Limited response'}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <Link href="/dashboard/medications" className="block mt-3">
        <Button variant="ghost" size="sm" className="w-full text-primary-500">
          View Full Medication History <ChevronRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  )
}

export default function DashboardPage() {
  const { 
    selectedChild, 
    latestAssessment, 
    setLatestAssessment, 
    environment, 
    setEnvironment, 
    symptomHistory, 
    removeSymptomEntry,
    detectedEvents,
    vitalReadings,
    riskTrend,
    confirmEvent,
    ignoreEvent,
    simulateDeviceReading,
    addRiskTrend,
    doseLogs,
    medications,
    getPersonalizedDeviation,
  } = useStore()
  const [recentSymptoms, setRecentSymptoms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // New state for 10/10 features
  const [showAccessibility, setShowAccessibility] = useState(false)
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal')
  const [highContrast, setHighContrast] = useState(false)
  const [showThresholdModal, setShowThresholdModal] = useState(false)
  const [customThresholds, setCustomThresholds] = useState({
    temperature: 100.4,
    heartRate: 120,
    oxygen: 95,
  })
  const [deviceStatuses] = useState([
    { name: 'Kinsa Smart', status: 'connected' as const, lastSeen: new Date() },
    { name: 'Apple Watch', status: 'connected' as const, lastSeen: new Date(Date.now() - 5 * 60000) },
    { name: 'Pulse Ox', status: 'connected' as const, lastSeen: new Date(Date.now() - 1 * 60000) },
  ])

  // Get pending events for the selected child
  const pendingEvents = detectedEvents.filter(
    e => e.status === 'pending' && e.child_id === selectedChild?.id
  )

  // Get recent vital readings for the selected child
  const recentVitals = vitalReadings.filter(
    r => r.child_id === selectedChild?.id
  ).slice(0, 10)

  // Calculate risk trend data
  const riskTrendData = riskTrend.slice(-12).map(t => t.score)

  // Get latest vitals by type
  const latestVitalsByType = useMemo(() => {
    const vitals: Record<string, any> = {}
    recentVitals.forEach(v => {
      if (!vitals[v.type]) {
        vitals[v.type] = v
      }
    })
    return vitals
  }, [recentVitals])

  // Detect medication failure - fever persisting after antipyretic
  const detectMedicationFailure = () => {
    if (!selectedChild) return null
    
    const recentDoses = doseLogs
      .filter(d => {
        const med = medications.find(m => m.id === d.medicationId)
        return med?.name.toLowerCase().includes('tylenol') || 
               med?.name.toLowerCase().includes('acetaminophen') ||
               med?.name.toLowerCase().includes('ibuprofen') ||
               med?.name.toLowerCase().includes('advil')
      })
      .filter(d => {
        const hoursSince = (Date.now() - new Date(d.timestamp).getTime()) / (1000 * 60 * 60)
        return hoursSince >= 1 && hoursSince <= 4 // Between 1-4 hours ago
      })
    
    if (recentDoses.length === 0) return null
    
    // Check if there's still an elevated temperature
    const latestTemp = vitalReadings
      .filter(r => r.child_id === selectedChild.id && r.type === 'temperature')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    
    if (latestTemp && latestTemp.value > 100.4) {
      const hoursSinceMed = Math.round(
        (Date.now() - new Date(recentDoses[0].timestamp).getTime()) / (1000 * 60 * 60)
      )
      const med = medications.find(m => m.id === recentDoses[0].medicationId)
      return {
        message: `Fever persisting at ${latestTemp.value}°F despite ${med?.name?.split(' ')[0] || 'medication'} given ${hoursSinceMed} hour${hoursSinceMed !== 1 ? 's' : ''} ago`,
        severity: 'high' as const,
      }
    }
    
    return null
  }
  
  const medicationFailure = detectMedicationFailure()

  const handleDeleteSymptom = async (symptomId: string) => {
    if (!confirm('Are you sure you want to delete this symptom entry?')) return
    removeSymptomEntry(symptomId)
  }

  // Simulate a device reading for demo
  const handleSimulateReading = () => {
    simulateDeviceReading()
  }

  // Track risk score changes
  useEffect(() => {
    if (latestAssessment) {
      addRiskTrend({
        score: latestAssessment.risk_score,
        timestamp: new Date().toISOString(),
      })
    }
  }, [latestAssessment?.risk_score])

  useEffect(() => {
    const loadData = async () => {
      if (!selectedChild) {
        setLoading(false)
        return
      }

      // Set default environment data
      setEnvironment({
        air_quality: { aqi: 42, category: 'Good', pollutants: { pm25: 8, pm10: 15, o3: 30 } },
        weather: { temperature: 72, humidity: 45, conditions: 'Partly Cloudy' },
        pollen: { level: 'Moderate', types: ['Grass', 'Tree'] },
      })

      // In demo mode, use local data only - skip API calls
      if (isDemoMode()) {
        setRecentSymptoms([])
        setLoading(false)
        return
      }

      // Only make API calls if not in demo mode
      try {
        const { symptomsApi, assessmentApi } = await import('@/lib/api')
        
        const symptoms = await symptomsApi.list(selectedChild.id)
        setRecentSymptoms(symptoms.slice(0, 5))

        const assessments = await assessmentApi.getHistory(selectedChild.id)
        if (assessments.length > 0) {
          setLatestAssessment(assessments[0])
        }
      } catch (error) {
        // API unavailable - use empty data
        setRecentSymptoms([])
      }

      setLoading(false)
    }

    loadData()
  }, [selectedChild])

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary-400/20 to-primary-600/20 dark:from-primary-400/10 dark:to-primary-600/10 flex items-center justify-center border border-primary-500/20">
            <Plus className="w-12 h-12 text-primary-500" />
          </div>
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-3">Welcome to EPCID</h2>
          <p className="text-surface-600 dark:text-surface-400 mb-8">
            Start monitoring your child's health by adding their profile.
          </p>
          <Link href="/dashboard/children">
            <Button size="lg" icon={<Plus className="w-5 h-5" />} className="btn-primary">
              Add Your First Child
            </Button>
          </Link>
        </motion.div>
      </div>
    )
  }

  // Determine if we have real symptom/vital data
  const hasRealData = symptomHistory.length > 0 || vitalReadings.length > 0 || pendingEvents.length > 0
  
  // Generate data-consistent risk factors based on ACTUAL logged data
  const generateDataConsistentFactors = () => {
    if (!hasRealData) return []
    
    const factors: Array<{ name: string; contribution: number; explanation: string }> = []
    
    // Check for logged symptoms
    if (symptomHistory.length > 0) {
      const recentSymptoms = symptomHistory[0]?.symptoms || []
      const hasFever = recentSymptoms.some((s: any) => s.name.toLowerCase().includes('fever'))
      const hasRespiratory = recentSymptoms.some((s: any) => 
        ['cough', 'congestion', 'breathing', 'respiratory'].some(k => s.name.toLowerCase().includes(k))
      )
      
      if (hasFever) {
        factors.push({
          name: 'Logged Fever',
          contribution: 35,
          explanation: `Fever logged ${new Date(symptomHistory[0].created_at).toLocaleDateString()}. Prolonged fever may indicate infection.`
        })
      }
      if (hasRespiratory) {
        factors.push({
          name: 'Respiratory Symptoms',
          contribution: 25,
          explanation: 'Respiratory symptoms logged. Monitor for breathing difficulty.'
        })
      }
    }
    
    // Check for elevated temperature readings
    const recentTemp = vitalReadings.find(v => 
      v.child_id === selectedChild?.id && v.type === 'temperature' && v.value > 100.4
    )
    if (recentTemp) {
      factors.push({
        name: 'Elevated Temperature',
        contribution: 40,
        explanation: `Temperature of ${recentTemp.value}°F recorded. Above normal range.`
      })
    }
    
    // If no concerning factors, show healthy baseline
    if (factors.length === 0) {
      factors.push({
        name: 'Healthy Baseline',
        contribution: 100,
        explanation: `${selectedChild?.name} is within normal parameters based on logged data.`
      })
    }
    
    return factors
  }
  
  // Calculate risk score based on actual data
  const calculateDataConsistentRiskScore = () => {
    if (!hasRealData) return 15 // Baseline healthy score
    
    let score = 15
    
    // Add points for symptoms
    symptomHistory.slice(0, 3).forEach(entry => {
      entry.symptoms.forEach((s: any) => {
        score += s.severity * 8
      })
    })
    
    // Add points for elevated vitals
    vitalReadings.filter(v => v.child_id === selectedChild?.id).slice(0, 5).forEach(v => {
      if (v.type === 'temperature' && v.value > 100.4) score += 15
      if (v.type === 'heart_rate' && v.value > 120) score += 10
      if (v.type === 'oxygen' && v.value < 95) score += 20
    })
    
    return Math.min(100, Math.max(0, score))
  }
  
  // Use data-consistent values
  const dataConsistentScore = latestAssessment?.risk_score ?? calculateDataConsistentRiskScore()
  const dataConsistentFactors = latestAssessment?.factors ?? generateDataConsistentFactors()
  
  // Determine risk level based on actual score
  const actualRiskLevel = dataConsistentScore >= 80 ? 'critical' : 
                          dataConsistentScore >= 60 ? 'high' :
                          dataConsistentScore >= 40 ? 'moderate' : 'low'
  const risk = riskConfig[actualRiskLevel as keyof typeof riskConfig]

  // Demo vitals for display
  const displayVitals = {
    temperature: latestVitalsByType.temperature?.value || 101.2,
    heartRate: latestVitalsByType.heart_rate?.value || 98,
    oxygen: latestVitalsByType.oxygen?.value || 98,
  }

  // Mock symptom history for visualization
  const symptomHistoryViz = Array.from({ length: 14 }, (_, i) => ({
    name: ['Fever', 'Cough', 'Fatigue'][i % 3],
    severity: Math.max(1, Math.min(5, Math.floor(Math.random() * 5) + 1)),
    color: ['bg-accent-500', 'bg-primary-500', 'bg-purple-500'][i % 3],
  }))

  return (
    <div className="space-y-6">
      {/* Header Section - Stitch Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-primary-500 dark:text-primary-400 uppercase tracking-wider">
              Clinical Health Dashboard
            </span>
            {hasRealData && (
              <Badge variant="primary" size="sm" className="animate-pulse">
                Live Monitoring
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
            {selectedChild.name}'s Dashboard
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasRealData && (
            <Link href="/dashboard/assess">
              <Button className="btn-accent btn-shine">
                <Sparkles className="w-4 h-4 mr-2" />
                Quick Assess
              </Button>
            </Link>
          )}
          <Link href="/dashboard/telehealth">
            <Button variant="secondary" className="border-primary-500/30 dark:border-primary-400/30">
              <Phone className="w-4 h-4 mr-2" />
              Connect Nurse
            </Button>
          </Link>
          
          {/* Accessibility Toggle */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowAccessibility(!showAccessibility)}
              className="text-surface-500 hover:text-primary-500"
              title="Accessibility Options"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9c.83 0 1.5-.67 1.5-1.5S7.83 8 7 8s-1.5.67-1.5 1.5S6.17 11 7 11zm10 0c.83 0 1.5-.67 1.5-1.5S17.83 8 17 8s-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-5 5c2.33 0 4.32-1.45 5.12-3.5h-1.67c-.69 1.19-1.97 2-3.45 2s-2.75-.81-3.45-2H6.88c.8 2.05 2.79 3.5 5.12 3.5z"/>
              </svg>
            </Button>
            <AnimatePresence>
              {showAccessibility && (
                <AccessibilityPanel
                  isOpen={showAccessibility}
                  onClose={() => setShowAccessibility(false)}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                  highContrast={highContrast}
                  setHighContrast={setHighContrast}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Medication Failure Alert */}
      {medicationFailure && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-danger-500/10 border border-danger-500/30 dark:border-danger-400/30"
        >
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-xl bg-danger-500/20">
              <AlertCircle className="w-6 h-6 text-danger-500 dark:text-danger-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-danger-600 dark:text-danger-300">
                Medication May Not Be Working
              </h3>
              <p className="text-sm text-danger-500 dark:text-danger-400 mt-1">
                {medicationFailure.message}
              </p>
              <div className="flex gap-2 mt-3">
                <Link href="/dashboard/telehealth">
                  <Button size="sm" className="bg-danger-500 hover:bg-danger-600">
                    Connect with Nurse
                  </Button>
                </Link>
                <Link href="/dashboard/medications">
                  <Button variant="secondary" size="sm">
                    Check Medications
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Data Reconciliation Alert - When sensor data conflicts with manual logs */}
      <AnimatePresence>
        {displayVitals.temperature > 100.4 && symptomHistory.filter(s => 
          s.symptoms?.some(sym => sym.name.toLowerCase().includes('fever'))
        ).length === 0 && (
          <DataReconciliationAlert
            sensorData={{
              type: 'temperature',
              value: displayVitals.temperature,
              threshold: 100.4
            }}
            hasSymptomLogged={false}
            onLogSymptom={() => {
              // Navigate to symptom checker with fever pre-selected
              window.location.href = '/dashboard/symptom-checker?symptom=fever'
            }}
            onDismiss={() => {}}
          />
        )}
      </AnimatePresence>

      {/* Device Connection Alert */}
      <DeviceConnectionAlert
        devices={deviceStatuses}
        onReconnect={(name) => console.log('Reconnecting', name)}
        onDismiss={() => {}}
      />

      {/* Alert Configuration Status - Shows notification and threshold settings */}
      <AlertConfigStatus
        soundEnabled={true}
        pushEnabled={true}
        customThreshold={customThresholds.temperature}
        onConfigure={() => setShowThresholdModal(true)}
      />
      
      {/* Custom Threshold Configuration Modal */}
      <AnimatePresence>
        {showThresholdModal && (
          <ThresholdConfigModal
            isOpen={showThresholdModal}
            onClose={() => setShowThresholdModal(false)}
            thresholds={customThresholds}
            onSave={setCustomThresholds}
          />
        )}
      </AnimatePresence>

      {/* Main Dashboard Grid - Stitch Layout */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column - Risk Gauge & Vitals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-8 space-y-6"
        >
          {/* Risk Assessment Card - Stitch Style */}
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary-500" />
                  Current Risk Level
                </h2>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                  {hasRealData ? 'Based on logged data' : 'No symptoms logged'}
                </p>
              </div>
              <Link href="/dashboard/assess">
                <Button variant="ghost" size="sm" className="text-primary-500 dark:text-primary-400">
                  Full Report <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
              {/* Risk Gauge */}
              <div className="flex flex-col items-center">
                <RiskGauge score={dataConsistentScore} riskLevel={actualRiskLevel} />
                <div className={`mt-4 px-4 py-2 rounded-full ${risk.bg} ${risk.border} border`}>
                  <span className={`text-sm font-bold ${risk.color}`}>{risk.label}</span>
                </div>
                {/* Mini Trend */}
                {riskTrendData.length > 1 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-surface-500">
                    <TrendSparkline data={riskTrendData} color={risk.color} />
                    <span>
                      {riskTrendData[riskTrendData.length - 1] > riskTrendData[0] ? '↑ Rising' : 
                       riskTrendData[riskTrendData.length - 1] < riskTrendData[0] ? '↓ Falling' : '→ Stable'}
                    </span>
                  </div>
                )}
              </div>

              {/* Vitals Grid - Enhanced with Device Status & Sparklines */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                <VitalCard
                  icon={Thermometer}
                  label="Temperature"
                  value={displayVitals.temperature}
                  unit="°F"
                  trend={displayVitals.temperature > 100 ? 'up' : displayVitals.temperature < 99 ? 'down' : 'stable'}
                  trendValue={displayVitals.temperature > 100 ? '+2.6°' : displayVitals.temperature < 99 ? '-1.2°' : ''}
                  iconColor="bg-danger-500"
                  source="Kinsa Smart"
                  deviceStatus={{
                    battery: 78,
                    signal: 'strong',
                    lastSync: new Date(Date.now() - 2 * 60000) // 2 min ago
                  }}
                  sparklineData={[99.2, 99.8, 100.4, 101.2, 101.8, 101.2, 100.8, displayVitals.temperature]}
                  normalRange="97.8-99.5"
                  isAbnormal={displayVitals.temperature > 100.4}
                />
                <VitalCard
                  icon={Heart}
                  label="Heart Rate"
                  value={displayVitals.heartRate}
                  unit="bpm"
                  trend={displayVitals.heartRate > 100 ? 'up' : 'stable'}
                  trendValue={displayVitals.heartRate > 100 ? '+12' : ''}
                  iconColor="bg-pink-500"
                  source="Apple Watch"
                  deviceStatus={{
                    battery: 45,
                    signal: 'medium',
                    lastSync: new Date(Date.now() - 5 * 60000) // 5 min ago
                  }}
                  sparklineData={[88, 92, 95, 98, 102, 98, 94, displayVitals.heartRate]}
                  normalRange="70-100"
                  isAbnormal={displayVitals.heartRate > 120}
                />
                <VitalCard
                  icon={Activity}
                  label="SpO2"
                  value={displayVitals.oxygen}
                  unit="%"
                  trend="stable"
                  iconColor="bg-primary-500"
                  source="Pulse Ox"
                  deviceStatus={{
                    battery: 92,
                    signal: 'strong',
                    lastSync: new Date(Date.now() - 1 * 60000) // 1 min ago
                  }}
                  sparklineData={[97, 98, 98, 97, 98, 99, 98, displayVitals.oxygen]}
                  normalRange="95-100"
                  isAbnormal={displayVitals.oxygen < 95}
                />
              </div>
            </div>

            {/* Contributing Factors - Enhanced with PEWS Weighting */}
            {dataConsistentFactors.length > 0 && dataConsistentFactors[0].name !== 'Healthy Baseline' && (
              <div className="mt-6 pt-6 border-t border-surface-200 dark:border-navy-800">
                <ContributingFactorsDisplay
                  factors={dataConsistentFactors.slice(0, 4).map((factor: any) => ({
                    name: factor.name,
                    score: Math.round(factor.contribution / 25), // Convert percentage to score out of 4
                    maxScore: 4,
                    weight: factor.name.includes('Cardiovascular') ? 35 : 
                            factor.name.includes('Respiratory') ? 30 :
                            factor.name.includes('Behavior') ? 20 : 15,
                  }))}
                  totalScore={dataConsistentScore}
                />
              </div>
            )}
          </div>

          {/* Medication Timer - From Mockup */}
          <div className="grid sm:grid-cols-2 gap-4">
            <MedicationTimerCard
              name="Tylenol"
              dosage="480mg (15mL)"
              timeRemaining="02:15:00"
              isReady={false}
              onLogDose={() => {}}
            />
            <MedicationTimerCard
              name="Advil"
              dosage="200mg (10mL)"
              timeRemaining="00:00:00"
              isReady={true}
              onLogDose={() => {}}
            />
          </div>
          
          {/* Medication-Vital Correlation - Shows medication effectiveness */}
          <MedicationVitalCorrelation
            medications={[
              { name: 'Tylenol', time: new Date(Date.now() - 2 * 60 * 60000), type: 'acetaminophen' },
              { name: 'Advil', time: new Date(Date.now() - 8 * 60 * 60000), type: 'ibuprofen' },
            ]}
            vitalHistory={[
              { time: new Date(Date.now() - 9 * 60 * 60000), temperature: 102.1 },
              { time: new Date(Date.now() - 6 * 60 * 60000), temperature: 100.4 },
              { time: new Date(Date.now() - 3 * 60 * 60000), temperature: 101.8 },
              { time: new Date(Date.now() - 1 * 60 * 60000), temperature: 100.2 },
            ]}
          />

          {/* Symptom History Visualization */}
          {symptomHistory.length > 0 && (
            <div className="card-elevated p-6">
              <SymptomHistoryBar symptoms={symptomHistoryViz} />
            </div>
          )}
        </motion.div>

        {/* Right Column - Smart Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-4 space-y-6"
        >
          {/* Smart Insights Card */}
          <div className="card-elevated p-5">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-400" />
              Smart Insights
            </h3>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
                <div className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400">
                  <TrendingUp className="w-4 h-4" />
                  Trend Analysis
                </div>
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                  Temperature trending down over last 4 hours
                </p>
              </div>
              <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/20">
                <div className="flex items-center gap-2 text-sm font-medium text-accent-600 dark:text-accent-400">
                  <Pill className="w-4 h-4" />
                  Medication Reminder
                </div>
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                  Next Advil dose ready in 2h 15m
                </p>
              </div>
              <div className="p-3 rounded-xl bg-success-500/10 border border-success-500/20">
                <div className="flex items-center gap-2 text-sm font-medium text-success-600 dark:text-success-400">
                  <CheckCircle className="w-4 h-4" />
                  Hydration Status
                </div>
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                  On track - 4 of 6 target servings logged
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card-elevated p-5">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Link href="/dashboard/symptom-checker" className="block">
                <div className="p-3 rounded-xl bg-surface-50 dark:bg-navy-900/50 hover:bg-surface-100 dark:hover:bg-navy-800 border border-surface-200 dark:border-navy-800 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                      <Stethoscope className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <span className="font-medium text-sm text-surface-900 dark:text-white">Check Symptoms</span>
                      <p className="text-xs text-surface-500">Run symptom checker</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400 group-hover:text-primary-500 transition-colors" />
                </div>
              </Link>
              <Link href="/dashboard/medications" className="block">
                <div className="p-3 rounded-xl bg-surface-50 dark:bg-navy-900/50 hover:bg-surface-100 dark:hover:bg-navy-800 border border-surface-200 dark:border-navy-800 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                      <Pill className="w-5 h-5 text-accent-500" />
                    </div>
                    <div>
                      <span className="font-medium text-sm text-surface-900 dark:text-white">Log Medication</span>
                      <p className="text-xs text-surface-500">Track doses</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400 group-hover:text-accent-500 transition-colors" />
                </div>
              </Link>
              <Link href="/dashboard/trends" className="block">
                <div className="p-3 rounded-xl bg-surface-50 dark:bg-navy-900/50 hover:bg-surface-100 dark:hover:bg-navy-800 border border-surface-200 dark:border-navy-800 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <span className="font-medium text-sm text-surface-900 dark:text-white">View Trends</span>
                      <p className="text-xs text-surface-500">Health charts</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400 group-hover:text-purple-500 transition-colors" />
                </div>
              </Link>
            </div>
          </div>

          {/* Child Profile Mini */}
          <div className="card-elevated p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary-500/25 ring-2 ring-primary-400/20">
                {selectedChild?.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-surface-900 dark:text-white">{selectedChild?.name}</h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {new Date().getFullYear() - new Date(selectedChild?.date_of_birth || '').getFullYear()} years old • {selectedChild?.gender || 'Not specified'}
                </p>
              </div>
            </div>
            {selectedChild?.allergies && selectedChild.allergies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedChild.allergies.map((allergy: string) => (
                  <Badge key={allergy} variant="danger" size="sm">{allergy}</Badge>
                ))}
              </div>
            )}
            <Link href={`/dashboard/children?edit=${selectedChild?.id}`} className="block">
              <Button variant="secondary" fullWidth size="sm">
                Edit Profile
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Live Vitals Feed - Pending Confirmations */}
      {pendingEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="card-elevated border border-accent-500/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-accent-500 animate-pulse" />
                Live Vitals Feed
                <Badge variant="warning" size="sm">{pendingEvents.length} Pending</Badge>
              </h3>
              <div className="flex items-center gap-2 text-xs text-surface-500">
                <Bluetooth className="w-4 h-4 text-primary-400" />
                <span>Device Connected</span>
              </div>
            </div>
            <AnimatePresence>
              <div className="space-y-3">
                {pendingEvents.slice(0, 3).map((event) => (
                  <DetectedEventCard
                    key={event.id}
                    id={event.id}
                    type={event.type}
                    value={event.value}
                    unit={event.unit}
                    timestamp={event.timestamp}
                    source={event.source}
                    deviceName={event.device_name}
                    deviceConfidence={event.device_source?.confidence_score}
                    status={event.status}
                    thresholdExceeded={event.threshold_exceeded}
                    thresholdValue={event.threshold_value}
                    baselineDiff={event.baseline_diff}
                    context={event.context}
                    riskImpact={event.risk_impact}
                    suggestedAction={event.suggested_action}
                    onConfirm={confirmEvent}
                    onIgnore={ignoreEvent}
                  />
                ))}
              </div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Environment Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="card-elevated p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <Wind className="w-5 h-5 text-primary-500" />
            Environment
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-50 dark:bg-navy-900/50 border border-surface-200 dark:border-navy-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <Wind className="w-5 h-5 text-primary-500" />
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Air Quality</div>
                    <div className="font-semibold text-surface-900 dark:text-white">{environment?.air_quality?.category || 'Good'}</div>
                  </div>
                </div>
                <span className="text-2xl font-bold text-primary-500">{environment?.air_quality?.aqi || 42}</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-surface-50 dark:bg-navy-900/50 border border-surface-200 dark:border-navy-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                    <Sun className="w-5 h-5 text-accent-500" />
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Weather</div>
                    <div className="font-semibold text-surface-900 dark:text-white">{environment?.weather?.conditions || 'Partly Cloudy'}</div>
                  </div>
                </div>
                <span className="text-2xl font-bold text-accent-500">{environment?.weather?.temperature || 72}°</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-surface-50 dark:bg-navy-900/50 border border-surface-200 dark:border-navy-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Droplets className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Pollen</div>
                    <div className="font-semibold text-surface-900 dark:text-white">{environment?.pollen?.level || 'Moderate'}</div>
                  </div>
                </div>
                <Badge variant="warning" size="sm">{environment?.pollen?.types?.join(', ') || 'Grass, Tree'}</Badge>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
