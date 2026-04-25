'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Phone } from 'lucide-react'
import { motion } from 'framer-motion'
import { errorLogger, createErrorFromUnknown, AppError, ErrorCode } from '@/lib/errors'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: AppError, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: AppError | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing.
 * 
 * Features:
 * - Graceful error handling with user-friendly messages
 * - Emergency contact information always visible
 * - Retry and navigation options
 * - Error logging to monitoring service
 */
class ErrorBoundaryClass extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error: createErrorFromUnknown(error),
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = createErrorFromUnknown(error)
    
    // Log the error
    errorLogger.log(appError, {
      componentStack: errorInfo.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    })

    this.setState({ errorInfo })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(appError, errorInfo)
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
    }
  }

  private handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error } = this.state
      const isEmergencyRelated = error?.code === ErrorCode.EMERGENCY_DETECTED || 
                                  error?.code === ErrorCode.CLINICAL_WARNING

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-navy-950 dark:to-navy-900 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg w-full"
          >
            {/* Emergency Notice - Always visible */}
            <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-danger-600 dark:text-danger-400">
                    Medical Emergency?
                  </p>
                  <p className="text-sm text-danger-600/80 dark:text-danger-400/80 mt-1">
                    If your child needs immediate medical attention, call{' '}
                    <a href="tel:911" className="font-bold underline">911</a>{' '}
                    or go to the nearest emergency room.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Card */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
              {/* Header */}
              <div className={`p-6 ${isEmergencyRelated ? 'bg-danger-500' : 'bg-amber-500'}`}>
                <div className="flex items-center gap-3 text-white">
                  <AlertTriangle className="w-8 h-8" />
                  <div>
                    <h1 className="text-xl font-bold">
                      {isEmergencyRelated ? 'Critical Error' : 'Something went wrong'}
                    </h1>
                    <p className="text-sm opacity-90">
                      Don't worry, your data is safe
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  {error?.userMessage || 'An unexpected error occurred. Please try again.'}
                </p>

                {/* Error details (collapsible in production) */}
                {process.env.NODE_ENV === 'development' && error && (
                  <details className="mb-4">
                    <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
                      Technical Details
                    </summary>
                    <pre className="mt-2 p-3 bg-slate-100 dark:bg-navy-800 rounded-lg text-xs overflow-auto max-h-40">
                      {JSON.stringify(error.toJSON(), null, 2)}
                    </pre>
                  </details>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={this.handleRetry}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                  
                  <button
                    onClick={this.handleGoHome}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Go to Dashboard
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-navy-800/50 border-t border-slate-200 dark:border-navy-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  If this problem persists, please contact support.
                  <br />
                  Error ID: {error?.timestamp?.slice(0, 19) || 'unknown'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Functional wrapper for Error Boundary
 * Allows using hooks in the future if needed
 */
export function ErrorBoundary({ children, fallback, onError }: Props) {
  return (
    <ErrorBoundaryClass fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundaryClass>
  )
}

/**
 * Minimal Error Fallback for inline use
 */
export function ErrorFallback({ 
  error, 
  resetError 
}: { 
  error?: Error | AppError
  resetError?: () => void 
}) {
  const appError = error instanceof AppError ? error : error ? createErrorFromUnknown(error) : null

  return (
    <div className="p-4 bg-danger-500/10 border border-danger-500/30 rounded-xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-danger-600 dark:text-danger-400">
            Unable to load this section
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {appError?.userMessage || 'An error occurred. Please try again.'}
          </p>
          {resetError && (
            <button
              onClick={resetError}
              className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for error handling in functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<AppError | null>(null)

  const handleError = React.useCallback((err: unknown) => {
    const appError = createErrorFromUnknown(err)
    errorLogger.log(appError)
    setError(appError)
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  const throwError = React.useCallback((err: unknown) => {
    throw createErrorFromUnknown(err)
  }, [])

  return {
    error,
    handleError,
    clearError,
    throwError,
    hasError: error !== null,
  }
}

export default ErrorBoundary
