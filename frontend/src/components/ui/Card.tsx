'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'glass' | 'elevated' | 'outline' | 'filled'
  hover?: boolean
  glow?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const variants = {
  default: `
    bg-white dark:bg-surface-900 
    border border-surface-200 dark:border-surface-800
    shadow-soft dark:shadow-none
  `,
  glass: `
    glass-card
  `,
  elevated: `
    bg-white dark:bg-surface-900
    shadow-soft-lg dark:shadow-none
    border border-surface-100 dark:border-surface-800
  `,
  outline: `
    bg-transparent
    border-2 border-surface-200 dark:border-surface-700
  `,
  filled: `
    bg-surface-50 dark:bg-surface-800
    border border-surface-100 dark:border-surface-700
  `,
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    variant = 'default', 
    hover = false, 
    glow = false, 
    padding = 'md',
    className = '', 
    children, 
    ...props 
  }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={hover ? { 
          y: -4, 
          transition: { duration: 0.2 } 
        } : undefined}
        className={`
          rounded-2xl
          ${variants[variant]}
          ${paddings[padding]}
          ${hover ? 'cursor-pointer transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-soft-md dark:hover:shadow-glow-sm' : ''}
          ${glow ? 'glow-border' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

Card.displayName = 'Card'

export const CardHeader = ({ className = '', children }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`mb-4 ${className}`}>
    {children}
  </div>
)

export const CardTitle = ({ className = '', children }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-lg font-semibold text-surface-900 dark:text-white ${className}`}>
    {children}
  </h3>
)

export const CardDescription = ({ className = '', children }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-surface-600 dark:text-surface-400 mt-1 ${className}`}>
    {children}
  </p>
)

export const CardContent = ({ className = '', children }: HTMLAttributes<HTMLDivElement>) => (
  <div className={className}>
    {children}
  </div>
)

export const CardFooter = ({ className = '', children }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`mt-6 pt-4 border-t border-surface-200 dark:border-surface-700 ${className}`}>
    {children}
  </div>
)

export default Card
