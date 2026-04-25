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
    iconInner: 'w-4 h-4',
    tagline: 'text-[8px]',
    fullName: 'text-[8px]',
  },
  md: {
    text: 'text-2xl',
    icon: 'w-10 h-10',
    iconInner: 'w-5 h-5',
    tagline: 'text-[10px]',
    fullName: 'text-[9px]',
  },
  lg: {
    text: 'text-3xl',
    icon: 'w-12 h-12',
    iconInner: 'w-6 h-6',
    tagline: 'text-xs',
    fullName: 'text-[10px]',
  },
  xl: {
    text: 'text-5xl',
    icon: 'w-16 h-16',
    iconInner: 'w-8 h-8',
    tagline: 'text-sm',
    fullName: 'text-xs',
  },
  hero: {
    text: 'text-7xl md:text-8xl',
    icon: 'w-20 h-20 md:w-24 md:h-24',
    iconInner: 'w-10 h-10 md:w-12 md:h-12',
    tagline: 'text-sm',
    fullName: 'text-sm',
  },
}

export function Logo({ 
  size = 'md', 
  showTagline = false, 
  showFullName = true,
  showPulse = true, 
  animate = true,
  className = '' 
}: LogoProps) {
  const config = sizeConfig[size]
  
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Top Row: Logo Text + Pulse Icon */}
      <div className="flex items-center gap-2">
        {/* EPCID Text */}
        <motion.span
          initial={animate ? { opacity: 0, x: -10 } : false}
          animate={animate ? { opacity: 1, x: 0 } : false}
          transition={{ duration: 0.5 }}
          className={`${config.text} font-black tracking-tight text-surface-900 dark:text-white`}
        >
          EPCID
        </motion.span>
        
        {/* Heart with Pulse Icon - No background box */}
        {showPulse && (
          <motion.div 
            initial={animate ? { opacity: 0, scale: 0.8 } : false}
            animate={animate ? { opacity: 1, scale: 1 } : false}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`${config.icon} flex items-center justify-center`}
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              className={`${config.icon} text-cyan-500`}
              stroke="currentColor" 
              strokeWidth="1.5"
            >
              {/* Heart shape - filled */}
              <path 
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
                fill="url(#heartGradient)"
                stroke="none"
              />
              {/* Pulse line - white */}
              <path
                d="M4 11h3l2-3 3 6 2-3h6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        )}
      </div>
      
      {/* Full Name - Below logo */}
      {showFullName && (
        <motion.div
          initial={animate ? { opacity: 0, y: 5 } : false}
          animate={animate ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-0.5"
        >
          <span className={`${config.fullName} text-cyan-600 dark:text-cyan-400 font-medium tracking-wide`}>
            Early Pediatric Critical Illness Detection
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
      {/* Heart with Pulse Icon - No background */}
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          className="w-10 h-10"
        >
          {/* Heart shape - gradient filled */}
          <path 
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
            fill="url(#heartGradientCompact)"
            stroke="none"
          />
          {/* Pulse line - white */}
          <path
            d="M4 11h3l2-3 3 6 2-3h6"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="heartGradientCompact" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>
        </svg>
        {/* Status dot */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-navy-950" />
      </div>
      
      {/* Text */}
      <div>
        <span className="text-lg font-bold text-surface-900 dark:text-white block">
          EPCID
        </span>
        {showFullName ? (
          <div className="text-[9px] text-cyan-600 dark:text-cyan-400 font-medium tracking-wide leading-tight max-w-[140px]">
            Early Pediatric Critical Illness Detection
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
