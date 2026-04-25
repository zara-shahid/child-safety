'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Info,
  X,
  Sparkles,
  Brain,
  Heart,
  Shield,
  Stethoscope,
  MessageSquare,
  TrendingUp,
  Award,
} from 'lucide-react'

const DEMO_HIGHLIGHTS = [
  {
    icon: Brain,
    title: 'Agentic AI',
    description: 'Multiple AI models working together for comprehensive health analysis'
  },
  {
    icon: Shield,
    title: 'Early Warning',
    description: 'PEWS-based risk scoring detects critical illness before it escalates'
  },
  {
    icon: Stethoscope,
    title: 'Symptom Analysis',
    description: 'AI-powered symptom checker with severity assessment'
  },
  {
    icon: MessageSquare,
    title: 'Medical Chat',
    description: 'Conversational AI assistant for pediatric health guidance'
  },
]

export function DemoModeBanner() {
  const [isVisible, setIsVisible] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        {/* Main Banner */}
        <div className="bg-gradient-to-r from-purple-600 via-cyan-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
                  <Award className="w-4 h-4" />
                  <span className="text-sm font-bold">PLATFORM DEMO</span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">
                    <strong>EPCID</strong> — Early Pediatric Critical Illness Detection
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="px-3 py-1 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Info className="w-4 h-4" />
                  <span className="hidden sm:inline">Learn More</span>
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Info Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 shadow-lg overflow-hidden lg:ml-[280px]"
            >
              <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Problem & Solution */}
                  <div>
                    <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      The Problem We're Solving
                    </h3>
                    <p className="text-surface-600 dark:text-surface-400 text-sm mb-4">
                      <strong>Every year, thousands of children die from conditions that could have been
                        detected earlier.</strong> Parents often don't recognize early warning signs of
                      serious illness like sepsis, meningitis, or respiratory failure.
                    </p>
                    <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                        ⚠️ 75% of pediatric deaths from sepsis show warning signs 24+ hours before deterioration
                      </p>
                    </div>
                  </div>

                  {/* Right: AI Features */}
                  <div>
                    <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-500" />
                      AI-Powered Solution
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {DEMO_HIGHLIGHTS.map((item, i) => {
                        const Icon = item.icon
                        return (
                          <div key={i} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
                            <Icon className="w-5 h-5 text-cyan-500 mb-2" />
                            <h4 className="text-sm font-semibold text-surface-900 dark:text-white">
                              {item.title}
                            </h4>
                            <p className="text-xs text-surface-500 mt-1">
                              {item.description}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Tech Stack */}
                <div className="mt-6 pt-4 border-t border-surface-200 dark:border-surface-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-surface-500">Tech Stack:</span>
                    {['Next.js 14', 'FastAPI', 'Google GenAI SDK', 'Gemini Live API', 'Google Cloud Run', 'Zustand', 'Tailwind CSS', 'Framer Motion'].map((tech) => (
                      <span key={tech} className="px-2 py-1 text-xs bg-surface-100 dark:bg-surface-800 rounded text-surface-600 dark:text-surface-400">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}

export default DemoModeBanner
