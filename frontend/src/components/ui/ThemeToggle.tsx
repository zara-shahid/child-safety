'use client'

import { motion } from 'framer-motion'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from './ThemeProvider'

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown' | 'buttons'
  className?: string
}

export function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()

  if (variant === 'buttons') {
    return (
      <div className={`flex items-center gap-1 p-1 rounded-xl bg-surface-200 dark:bg-surface-800 ${className}`}>
        {[
          { value: 'light', icon: Sun, label: 'Light' },
          { value: 'dark', icon: Moon, label: 'Dark' },
          { value: 'system', icon: Monitor, label: 'System' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
            className={`
              relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
              transition-colors duration-200
              ${theme === option.value
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200'
              }
            `}
          >
            {theme === option.value && (
              <motion.div
                layoutId="theme-indicator"
                className="absolute inset-0 bg-white dark:bg-surface-700 rounded-lg shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">
              <option.icon className="w-4 h-4" />
            </span>
            <span className="relative z-10 hidden sm:inline">{option.label}</span>
          </button>
        ))}
      </div>
    )
  }

  // Icon variant (default)
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={`
        p-2.5 rounded-xl
        bg-surface-100 dark:bg-surface-800
        text-surface-600 dark:text-surface-400
        hover:bg-surface-200 dark:hover:bg-surface-700
        hover:text-surface-900 dark:hover:text-surface-200
        border border-surface-200 dark:border-surface-700
        transition-all duration-200
        ${className}
      `}
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: resolvedTheme === 'dark' ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-5 h-5" />
        ) : (
          <Sun className="w-5 h-5" />
        )}
      </motion.div>
    </motion.button>
  )
}

export default ThemeToggle
