'use client'

import { forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  children?: React.ReactNode
}

const variants = {
  primary: `
    bg-primary-500 hover:bg-primary-600 active:bg-primary-700
    text-white font-medium
    shadow-sm hover:shadow-md hover:shadow-primary-500/25
    dark:bg-primary-600 dark:hover:bg-primary-500
  `,
  secondary: `
    bg-surface-100 hover:bg-surface-200 active:bg-surface-300
    text-surface-700 font-medium
    border border-surface-200
    dark:bg-surface-800 dark:hover:bg-surface-700 dark:active:bg-surface-600
    dark:text-surface-200 dark:border-surface-700
  `,
  ghost: `
    bg-transparent hover:bg-surface-100 active:bg-surface-200
    text-surface-600 hover:text-surface-900
    dark:hover:bg-surface-800 dark:active:bg-surface-700
    dark:text-surface-400 dark:hover:text-surface-100
  `,
  danger: `
    bg-danger-500 hover:bg-danger-600 active:bg-danger-700
    text-white font-medium
    shadow-sm hover:shadow-md hover:shadow-danger-500/25
  `,
  success: `
    bg-primary-500 hover:bg-primary-600 active:bg-primary-700
    text-white font-medium
    shadow-sm hover:shadow-md hover:shadow-primary-500/25
  `,
  warning: `
    bg-warning-500 hover:bg-warning-600 active:bg-warning-700
    text-white font-medium
    shadow-sm hover:shadow-md hover:shadow-warning-500/25
  `,
  outline: `
    bg-transparent hover:bg-primary-50 active:bg-primary-100
    text-primary-600 font-medium
    border-2 border-primary-500 hover:border-primary-600
    dark:hover:bg-primary-950/50 dark:text-primary-400
  `,
}

const sizes = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1',
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2',
  xl: 'px-6 py-3 text-lg rounded-2xl gap-2.5',
}

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-5 h-5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    loading, 
    icon, 
    iconPosition = 'left',
    fullWidth = false,
    children, 
    className = '', 
    disabled, 
    ...props 
  }, ref) => {
    const iconSize = iconSizes[size]
    
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        className={`
          inline-flex items-center justify-center
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
          dark:focus-visible:ring-offset-surface-900
          ${variants[variant]}
          ${sizes[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : icon && iconPosition === 'left' ? (
          <span className={iconSize}>{icon}</span>
        ) : null}
        {children}
        {!loading && icon && iconPosition === 'right' ? (
          <span className={iconSize}>{icon}</span>
        ) : null}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'

export default Button
