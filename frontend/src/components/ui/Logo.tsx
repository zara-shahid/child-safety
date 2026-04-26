'use client'

import { motion } from 'framer-motion'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  showTagline?: boolean
  showFullName?: boolean
  showPulse?: boolean
  animate?: boolean
  className?: string
}

const sizeConfig = {
  sm: {
    text: 'text-xl',
    icon: 'w-8 h-8',
    tagline: 'text-[8px]',
    fullName: 'text-[8px]',
  },
  md: {
    text: 'text-2xl',
    icon: 'w-10 h-10',
    tagline: 'text-[10px]',
    fullName: 'text-[9px]',
  },
  lg: {
    text: 'text-3xl',
    icon: 'w-12 h-12',
    tagline: 'text-xs',
    fullName: 'text-[10px]',
  },
  xl: {
    text: 'text-5xl',
    icon: 'w-16 h-16',
    tagline: 'text-sm',
    fullName: 'text-xs',
  },
  hero: {
    text: 'text-7xl md:text-8xl',
    icon: 'w-20 h-20 md:w-24 md:h-24',
    tagline: 'text-sm',
    fullName: 'text-sm',
  },
}

function ChildIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      {/* Background rounded square */}
      <rect width="24" height="24" rx="5" fill="url(#logoBg)" />
      {/* Child head */}
      <circle cx="12" cy="6.5" r="2.8" fill="white" />
      {/* Child body */}
      <path d="M8 20 Q8 14 12 13 Q16 14 16 20Z" fill="white" />
      {/* Left arm */}
      <path d="M8 15.5 Q6 13.5 5.5 12" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      {/* Right arm */}
      <path d="M16 15.5 Q18 13.5 18.5 12" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      {/* Heartbeat pulse line */}
      <path
        d="M8.5 17 L10 17 L11 15 L12 19 L13 15 L14 17 L15.5 17"
        stroke="#f43f5e"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function Logo({
  size = 'md',
  showTagline = false,
  showFullName = true,
  showPulse = true,
  animate = true,
  className = '',
}: LogoProps) {
  const config = sizeConfig[size]

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Top Row: Icon + Text */}
      <div className="flex items-center gap-2">
        {/* Child Silhouette Icon */}
        {showPulse && (
          <motion.div
            initial={animate ? { opacity: 0, scale: 0.8 } : false}
            animate={animate ? { opacity: 1, scale: 1 } : false}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`${config.icon} flex items-center justify-center flex-shrink-0`}
          >
            <ChildIcon className={config.icon} />
          </motion.div>
        )}

        {/* VitalKids Text */}
        <motion.span
          initial={animate ? { opacity: 0, x: -10 } : false}
          animate={animate ? { opacity: 1, x: 0 } : false}
          transition={{ duration: 0.5 }}
          className={`${config.text} font-black tracking-tight text-surface-900 dark:text-white`}
        >
          VitalKids
        </motion.span>
      </div>

      {/* Full Name */}
      {showFullName && (
        <motion.div
          initial={animate ? { opacity: 0, y: 5 } : false}
          animate={animate ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-0.5"
        >
          <span className={`${config.fullName} text-cyan-600 dark:text-cyan-400 font-medium tracking-wide`}>
            Vital Monitoring for Kids
          </span>
        </motion.div>
      )}

      {/* Tagline */}
      {showTagline && (
        <motion.span
          initial={animate ? { opacity: 0 } : false}
          animate={animate ? { opacity: 1 } : false}
          transition={{ duration: 0.5, delay: 0.4 }}
          className={`${config.tagline} text-surface-500 dark:text-surface-400 font-medium tracking-wide mt-1`}
        >
          Clinical-grade pediatric safety net
        </motion.span>
      )}
    </div>
  )
}

// Compact version for sidebar/nav
export function LogoCompact({ className = '', showFullName = true }: { className?: string; showFullName?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Child Silhouette Icon */}
      <div className="relative w-10 h-10 flex items-center justify-center">
        <ChildIcon className="w-10 h-10" />
        {/* Status dot */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-gray-900" />
      </div>

      {/* Text */}
      <div>
        <span className="text-lg font-bold text-surface-900 dark:text-white block">
          VitalKids
        </span>
        {showFullName ? (
          <div className="text-[9px] text-cyan-600 dark:text-cyan-400 font-medium tracking-wide leading-tight max-w-[140px]">
            Vital Monitoring for Kids
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-surface-500 dark:text-primary-400/70">
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Safety Net</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Logo