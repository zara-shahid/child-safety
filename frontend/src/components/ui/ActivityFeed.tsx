'use client'

import { motion } from 'framer-motion'
import {
  Thermometer,
  Pill,
  Stethoscope,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Syringe,
  Ruler,
  FileText,
  Users,
  MessageSquare,
} from 'lucide-react'

export interface ActivityItem {
  id: string
  type: 'temperature' | 'medication' | 'symptom' | 'assessment' | 'vaccine' | 'growth' | 'report' | 'share' | 'chat'
  title: string
  description: string
  timestamp: Date
  severity?: 'info' | 'success' | 'warning' | 'danger'
  metadata?: Record<string, string | number>
}

const typeConfig = {
  temperature: { icon: Thermometer, color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' },
  medication: { icon: Pill, color: 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400' },
  symptom: { icon: Stethoscope, color: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400' },
  assessment: { icon: Activity, color: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400' },
  vaccine: { icon: Syringe, color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' },
  growth: { icon: Ruler, color: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' },
  report: { icon: FileText, color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' },
  share: { icon: Users, color: 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400' },
  chat: { icon: MessageSquare, color: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' },
}

const severityColors = {
  info: 'border-l-surface-300 dark:border-l-surface-600',
  success: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  maxItems?: number
  showTimeline?: boolean
  compact?: boolean
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ActivityFeed({
  activities,
  maxItems = 10,
  showTimeline = true,
  compact = false,
}: ActivityFeedProps) {
  const displayedActivities = activities.slice(0, maxItems)

  if (displayedActivities.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="w-12 h-12 text-surface-300 mx-auto mb-3" />
        <p className="text-surface-500">No recent activity</p>
      </div>
    )
  }

  return (
    <div className={`relative ${showTimeline ? 'pl-6' : ''}`}>
      {/* Timeline line */}
      {showTimeline && (
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-surface-200 dark:bg-surface-700" />
      )}

      <div className="space-y-4">
        {displayedActivities.map((activity, index) => {
          const config = typeConfig[activity.type]
          const Icon = config.icon
          const severityColor = activity.severity ? severityColors[activity.severity] : severityColors.info

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative"
            >
              {/* Timeline dot */}
              {showTimeline && (
                <div className={`absolute -left-6 top-3 w-[22px] h-[22px] rounded-full ${config.color} flex items-center justify-center ring-4 ring-white dark:ring-surface-900 z-10`}>
                  <Icon className="w-3 h-3" />
                </div>
              )}

              {/* Activity card */}
              <div
                className={`
                  ${compact ? 'p-3' : 'p-4'} 
                  rounded-xl bg-surface-50 dark:bg-surface-800 
                  border-l-4 ${severityColor}
                  hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors
                `}
              >
                <div className="flex items-start gap-3">
                  {!showTimeline && (
                    <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`font-medium text-surface-900 dark:text-white ${compact ? 'text-sm' : ''}`}>
                        {activity.title}
                      </h4>
                      <span className={`text-surface-500 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                    <p className={`text-surface-600 dark:text-surface-400 ${compact ? 'text-xs mt-0.5' : 'text-sm mt-1'}`}>
                      {activity.description}
                    </p>
                    
                    {/* Metadata badges */}
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && !compact && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(activity.metadata).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-0.5 rounded-full bg-surface-200 dark:bg-surface-700 text-xs text-surface-600 dark:text-surface-400"
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {activities.length > maxItems && (
        <div className="text-center mt-4">
          <button className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
            View all {activities.length} activities
          </button>
        </div>
      )}
    </div>
  )
}

// Sample activities for demo
export const sampleActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'medication',
    title: 'Medication Given',
    description: 'Acetaminophen (Tylenol) 160mg administered',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    severity: 'success',
    metadata: { Dose: '160mg', Method: 'Oral' },
  },
  {
    id: '2',
    type: 'temperature',
    title: 'Temperature Logged',
    description: 'Reading: 99.8°F (Low-grade fever)',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    severity: 'warning',
    metadata: { Reading: '99.8°F' },
  },
  {
    id: '3',
    type: 'symptom',
    title: 'Symptom Check Completed',
    description: 'Assessed: Cough, Runny Nose - Mild severity',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    severity: 'info',
  },
  {
    id: '4',
    type: 'assessment',
    title: 'AI Assessment',
    description: 'Low risk level - Home monitoring recommended',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    severity: 'success',
  },
  {
    id: '5',
    type: 'vaccine',
    title: 'Vaccine Recorded',
    description: 'DTaP Dose 4 marked as complete',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    severity: 'success',
  },
  {
    id: '6',
    type: 'growth',
    title: 'Growth Measurement',
    description: 'Weight: 30 lbs, Height: 39" - 50th percentile',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
    severity: 'info',
  },
  {
    id: '7',
    type: 'share',
    title: 'Caregiver Added',
    description: 'Grandma Rose was given viewer access',
    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000),
    severity: 'info',
  },
]

export default ActivityFeed
