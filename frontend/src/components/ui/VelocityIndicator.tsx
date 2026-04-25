'use client'

import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'

interface VelocityIndicatorProps {
  currentValue: number
  previousValue?: number
  type: 'temperature' | 'heart_rate' | 'oxygen' | 'general'
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

type VelocityLevel = 'rapid_rise' | 'rising' | 'stable' | 'falling' | 'rapid_fall'

export function VelocityIndicator({
  currentValue,
  previousValue,
  type,
  showLabel = true,
  size = 'md',
}: VelocityIndicatorProps) {
  // Define thresholds for different vital types
  const thresholds = {
    temperature: { rapidChange: 1.5, normalChange: 0.5 }, // °F per hour
    heart_rate: { rapidChange: 20, normalChange: 10 },    // bpm change
    oxygen: { rapidChange: 3, normalChange: 1.5 },        // % change
    general: { rapidChange: 10, normalChange: 5 },
  }

  const threshold = thresholds[type]
  
  // Calculate velocity
  const change = previousValue !== undefined ? currentValue - previousValue : 0
  
  let velocity: VelocityLevel = 'stable'
  
  if (type === 'oxygen') {
    // For oxygen, decreasing is bad
    if (change <= -threshold.rapidChange) velocity = 'rapid_fall'
    else if (change <= -threshold.normalChange) velocity = 'falling'
    else if (change >= threshold.rapidChange) velocity = 'rapid_rise'
    else if (change >= threshold.normalChange) velocity = 'rising'
  } else {
    // For temp/HR, increasing is typically concerning
    if (change >= threshold.rapidChange) velocity = 'rapid_rise'
    else if (change >= threshold.normalChange) velocity = 'rising'
    else if (change <= -threshold.rapidChange) velocity = 'rapid_fall'
    else if (change <= -threshold.normalChange) velocity = 'falling'
  }

  const config = {
    rapid_rise: {
      icon: TrendingUp,
      color: type === 'oxygen' ? 'text-green-500' : 'text-red-500',
      bg: type === 'oxygen' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30',
      label: 'Rapid Rise',
      animate: true,
    },
    rising: {
      icon: ArrowUp,
      color: type === 'oxygen' ? 'text-green-400' : 'text-amber-500',
      bg: type === 'oxygen' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
      label: 'Rising',
      animate: false,
    },
    stable: {
      icon: Minus,
      color: 'text-surface-600 dark:text-surface-400',
      bg: 'bg-surface-100 dark:bg-surface-800',
      label: 'Stable',
      animate: false,
    },
    falling: {
      icon: ArrowDown,
      color: type === 'oxygen' ? 'text-amber-500' : 'text-green-400',
      bg: type === 'oxygen' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20',
      label: 'Falling',
      animate: false,
    },
    rapid_fall: {
      icon: TrendingDown,
      color: type === 'oxygen' ? 'text-red-500' : 'text-green-500',
      bg: type === 'oxygen' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30',
      label: 'Rapid Drop',
      animate: type === 'oxygen',
    },
  }

  const { icon: Icon, color, bg, label, animate } = config[velocity]
  
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const containerClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }

  if (previousValue === undefined) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1 rounded-full ${bg} ${containerClasses[size]}`}
    >
      <motion.div
        animate={animate ? { y: [0, -2, 0] } : {}}
        transition={animate ? { repeat: Infinity, duration: 0.8 } : {}}
      >
        <Icon className={`${sizeClasses[size]} ${color}`} />
      </motion.div>
      {showLabel && (
        <span className={`font-medium ${color}`}>
          {label}
        </span>
      )}
      {change !== 0 && (
        <span className={`${color} opacity-70`}>
          ({change > 0 ? '+' : ''}{type === 'temperature' ? change.toFixed(1) : Math.round(change)})
        </span>
      )}
    </motion.div>
  )
}

// Compact velocity arrow for inline use
export function VelocityArrow({
  direction,
  urgent = false,
}: {
  direction: 'up' | 'down' | 'stable'
  urgent?: boolean
}) {
  const config = {
    up: {
      icon: urgent ? TrendingUp : ArrowUp,
      color: urgent ? 'text-red-500' : 'text-amber-500',
    },
    down: {
      icon: urgent ? TrendingDown : ArrowDown,
      color: urgent ? 'text-green-500' : 'text-emerald-400',
    },
    stable: {
      icon: ArrowRight,
      color: 'text-surface-600 dark:text-surface-400',
    },
  }

  const { icon: Icon, color } = config[direction]

  return (
    <motion.span
      animate={urgent ? { scale: [1, 1.1, 1] } : {}}
      transition={urgent ? { repeat: Infinity, duration: 0.5 } : {}}
      className="inline-flex"
    >
      <Icon className={`w-4 h-4 ${color}`} />
    </motion.span>
  )
}

export default VelocityIndicator
