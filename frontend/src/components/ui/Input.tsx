'use client'

import { forwardRef, InputHTMLAttributes, ReactNode, isValidElement } from 'react'
import { LucideIcon } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: LucideIcon | ReactNode
  iconPosition?: 'left' | 'right'
  variant?: 'default' | 'filled' | 'outline'
}

const variants = {
  default: `
    bg-white dark:bg-surface-900
    border-2 border-surface-200 dark:border-surface-700
    focus:border-primary-500 dark:focus:border-primary-500
    focus:ring-4 focus:ring-primary-500/10 dark:focus:ring-primary-500/20
  `,
  filled: `
    bg-surface-100 dark:bg-surface-800
    border-2 border-transparent
    focus:bg-white dark:focus:bg-surface-900
    focus:border-primary-500 dark:focus:border-primary-500
    focus:ring-4 focus:ring-primary-500/10 dark:focus:ring-primary-500/20
  `,
  outline: `
    bg-transparent
    border-2 border-surface-300 dark:border-surface-600
    focus:border-primary-500 dark:focus:border-primary-500
    focus:ring-4 focus:ring-primary-500/10 dark:focus:ring-primary-500/20
  `,
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    label, 
    error, 
    hint,
    icon, 
    iconPosition = 'left',
    variant = 'default',
    className = '', 
    id,
    ...props 
  }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const hasIcon = !!icon
    
    // Render icon - handle both component reference and JSX element
    const renderIcon = () => {
      if (!icon) return null
      // If it's already a React element (JSX), render it directly
      if (isValidElement(icon)) {
        return icon
      }
      // Otherwise treat as component reference
      const IconComponent = icon as LucideIcon
      return <IconComponent className="w-5 h-5 text-surface-400 dark:text-surface-500" />
    }
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {hasIcon && iconPosition === 'left' && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400 dark:text-surface-500">
              {renderIcon()}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full px-4 py-3 rounded-xl
              text-surface-900 dark:text-white
              placeholder:text-surface-400 dark:placeholder:text-surface-500
              transition-all duration-200
              outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${variants[variant]}
              ${hasIcon && iconPosition === 'left' ? 'pl-11' : ''}
              ${hasIcon && iconPosition === 'right' ? 'pr-11' : ''}
              ${error ? 'border-danger-500 dark:border-danger-500 focus:border-danger-500 focus:ring-danger-500/10' : ''}
              ${className}
            `}
            {...props}
          />
          
          {hasIcon && iconPosition === 'right' && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-surface-400 dark:text-surface-500">
              {renderIcon()}
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{error}</p>
        )}
        
        {hint && !error && (
          <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
