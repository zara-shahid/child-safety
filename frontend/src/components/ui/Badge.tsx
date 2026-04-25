'use client'

import { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
  pulse?: boolean
}

const variants = {
  default: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300',
  secondary: 'bg-accent-100 text-accent-700 dark:bg-accent-900/50 dark:text-accent-300',
  success: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-300',
  danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/50 dark:text-danger-300',
  info: 'bg-accent-100 text-accent-700 dark:bg-accent-900/50 dark:text-accent-300',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
}

const dotColors = {
  default: 'bg-surface-500',
  primary: 'bg-primary-500',
  secondary: 'bg-accent-500',
  success: 'bg-primary-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-accent-500',
}

export function Badge({ 
  variant = 'default', 
  size = 'md', 
  dot = false,
  pulse = false,
  className = '', 
  children, 
  ...props 
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span className={`
          w-1.5 h-1.5 rounded-full
          ${dotColors[variant]}
          ${pulse ? 'animate-pulse-soft' : ''}
        `} />
      )}
      {children}
    </span>
  )
}

export default Badge
