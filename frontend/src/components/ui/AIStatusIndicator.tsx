'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Sparkles,
  Activity,
  Shield,
  MessageSquare,
  Stethoscope,
  TrendingUp,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface AIFeature {
  id: string
  name: string
  description: string
  icon: typeof Brain
  status: 'active' | 'ready' | 'processing'
  model?: string
}

const AI_FEATURES: AIFeature[] = [
  {
    id: 'symptom-analysis',
    name: 'Symptom Analysis',
    description: 'AI-powered symptom severity assessment',
    icon: Stethoscope,
    status: 'active',
    model: 'Gemini 2.5 Flash (GenAI SDK)'
  },
  {
    id: 'risk-prediction',
    name: 'Risk Prediction',
    description: 'PEWS-based early warning detection',
    icon: Shield,
    status: 'active',
    model: 'Custom ML Model'
  },
  {
    id: 'chat-assistant',
    name: 'Medical Chat Assistant',
    description: 'Conversational AI for health guidance',
    icon: MessageSquare,
    status: 'active',
    model: 'Gemini 2.5 Flash (GenAI SDK)'
  },
  {
    id: 'voice-triage',
    name: 'Voice + Vision Triage',
    description: 'Real-time voice & camera assessment via Gemini Live API',
    icon: Activity,
    status: 'active',
    model: 'Gemini Live 2.5 Flash (Audio + Vision)'
  },
  {
    id: 'trend-analysis',
    name: 'Trend Analysis',
    description: 'Pattern recognition in vital signs',
    icon: TrendingUp,
    status: 'active',
    model: 'Statistical AI'
  },
  {
    id: 'dosage-calc',
    name: 'Smart Dosage',
    description: 'AI-verified medication calculations',
    icon: Zap,
    status: 'ready',
    model: 'Rules + AI Validation'
  },
]

export function AIStatusIndicator() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [pulseActive, setPulseActive] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseActive(p => !p)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const activeCount = AI_FEATURES.filter(f => f.status === 'active').length

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <motion.div
        layout
        className="bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden"
        style={{ width: isExpanded ? 320 : 'auto' }}
      >
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center gap-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
        >
          <div className="relative">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center ${pulseActive ? 'animate-pulse' : ''}`}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">{activeCount}</span>
            </div>
          </div>
          
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              AI Engine
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-500 rounded">
                ACTIVE
              </span>
            </div>
            <div className="text-xs text-surface-500">
              {activeCount} features running
            </div>
          </div>

          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-surface-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-surface-400" />
          )}
        </button>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-surface-200 dark:border-surface-700"
            >
              <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {AI_FEATURES.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <div
                      key={feature.id}
                      className="flex items-start gap-3 p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        feature.status === 'active' 
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : feature.status === 'processing'
                          ? 'bg-amber-500/20 text-amber-500'
                          : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-surface-900 dark:text-white">
                            {feature.name}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            feature.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : feature.status === 'processing'
                              ? 'bg-amber-500/20 text-amber-500'
                              : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                          }`}>
                            {feature.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {feature.description}
                        </p>
                        {feature.model && (
                          <span className="text-[10px] text-purple-500 dark:text-purple-400">
                            Model: {feature.model}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-surface-200 dark:border-surface-700 bg-gradient-to-r from-purple-500/5 to-cyan-500/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-surface-500">Powered by</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-purple-500/20 rounded text-purple-400">
                      Google GenAI SDK
                    </span>
                    <span className="px-2 py-0.5 bg-cyan-500/20 rounded text-cyan-400">
                      Live API
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default AIStatusIndicator
