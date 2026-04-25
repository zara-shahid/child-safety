/**
 * Centralized Error Handling for EPCID
 * 
 * Provides:
 * - Typed error classes
 * - User-friendly error messages
 * - Error logging utilities
 * - Toast notification integration
 */

// Error codes for the application
export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  OFFLINE = 'OFFLINE',
  
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  
  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  
  // Clinical errors (special handling)
  CLINICAL_WARNING = 'CLINICAL_WARNING',
  EMERGENCY_DETECTED = 'EMERGENCY_DETECTED',
  
  // Generic
  UNKNOWN = 'UNKNOWN',
}

// User-friendly messages for each error code
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Unable to connect. Please check your internet connection.',
  [ErrorCode.TIMEOUT]: 'The request timed out. Please try again.',
  [ErrorCode.OFFLINE]: 'You appear to be offline. Some features may be unavailable.',
  
  [ErrorCode.UNAUTHORIZED]: 'Please log in to continue.',
  [ErrorCode.FORBIDDEN]: 'You don\'t have permission to perform this action.',
  [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.INVALID_INPUT]: 'The information provided is invalid.',
  [ErrorCode.MISSING_REQUIRED]: 'Please fill in all required fields.',
  
  [ErrorCode.SERVER_ERROR]: 'Something went wrong on our end. Please try again.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.CONFLICT]: 'This action conflicts with existing data.',
  
  [ErrorCode.CLINICAL_WARNING]: 'Important health information requires your attention.',
  [ErrorCode.EMERGENCY_DETECTED]: 'Emergency symptoms detected. Please seek immediate medical care.',
  
  [ErrorCode.UNKNOWN]: 'An unexpected error occurred. Please try again.',
}

// Custom error class with additional context
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode?: number
  public readonly isRetryable: boolean
  public readonly userMessage: string
  public readonly context?: Record<string, unknown>
  public readonly timestamp: string

  constructor(
    code: ErrorCode,
    options?: {
      message?: string
      statusCode?: number
      isRetryable?: boolean
      context?: Record<string, unknown>
    }
  ) {
    const userMessage = options?.message || ERROR_MESSAGES[code]
    super(userMessage)
    
    this.name = 'AppError'
    this.code = code
    this.statusCode = options?.statusCode
    this.isRetryable = options?.isRetryable ?? this.determineRetryable(code)
    this.userMessage = userMessage
    this.context = options?.context
    this.timestamp = new Date().toISOString()

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  private determineRetryable(code: ErrorCode): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.SERVER_ERROR,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.RATE_LIMITED,
    ]
    return retryableCodes.includes(code)
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.userMessage,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp,
    }
  }
}

// Map HTTP status codes to error codes
export function httpStatusToErrorCode(status: number): ErrorCode {
  const statusMap: Record<number, ErrorCode> = {
    400: ErrorCode.VALIDATION_ERROR,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    429: ErrorCode.RATE_LIMITED,
    500: ErrorCode.SERVER_ERROR,
    502: ErrorCode.SERVICE_UNAVAILABLE,
    503: ErrorCode.SERVICE_UNAVAILABLE,
    504: ErrorCode.TIMEOUT,
  }
  return statusMap[status] || ErrorCode.UNKNOWN
}

// Create AppError from HTTP response
export async function createErrorFromResponse(response: Response): Promise<AppError> {
  const code = httpStatusToErrorCode(response.status)
  
  let serverMessage: string | undefined
  try {
    const data = await response.json()
    serverMessage = data.message || data.error || data.detail
  } catch {
    // Response body not JSON, use default message
  }

  return new AppError(code, {
    message: serverMessage,
    statusCode: response.status,
    context: {
      url: response.url,
      headers: Object.fromEntries(response.headers.entries()),
    },
  })
}

// Create AppError from generic error
export function createErrorFromUnknown(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new AppError(ErrorCode.NETWORK_ERROR, {
      context: { originalError: String(error) },
    })
  }

  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return new AppError(ErrorCode.TIMEOUT, { message: error.message })
    }
    
    if (error.message.includes('network') || error.message.includes('Network')) {
      return new AppError(ErrorCode.NETWORK_ERROR, { message: error.message })
    }

    return new AppError(ErrorCode.UNKNOWN, {
      message: error.message,
      context: { stack: error.stack },
    })
  }

  return new AppError(ErrorCode.UNKNOWN, {
    context: { originalError: String(error) },
  })
}

// Logger for errors (can be extended to send to monitoring service)
export interface ErrorLogger {
  log(error: AppError, additionalContext?: Record<string, unknown>): void
  logWarning(message: string, context?: Record<string, unknown>): void
  logInfo(message: string, context?: Record<string, unknown>): void
}

class ConsoleErrorLogger implements ErrorLogger {
  log(error: AppError, additionalContext?: Record<string, unknown>): void {
    console.error('[EPCID Error]', {
      ...error.toJSON(),
      ...additionalContext,
    })

    // In production, send to monitoring service like Sentry
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(error, { extra: additionalContext })
    // }
  }

  logWarning(message: string, context?: Record<string, unknown>): void {
    console.warn('[EPCID Warning]', message, context)
  }

  logInfo(message: string, context?: Record<string, unknown>): void {
    console.info('[EPCID Info]', message, context)
  }
}

export const errorLogger = new ConsoleErrorLogger()

// Toast notification types (to be used with a toast library)
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  type: ToastType
  title: string
  message: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

// Generate toast message from error
export function errorToToast(error: AppError): ToastMessage {
  const isEmergency = error.code === ErrorCode.EMERGENCY_DETECTED

  return {
    type: isEmergency ? 'error' : 'warning',
    title: isEmergency ? '🚨 Emergency' : 'Error',
    message: error.userMessage,
    duration: isEmergency ? undefined : 5000, // Emergency stays until dismissed
    action: error.isRetryable ? {
      label: 'Retry',
      onClick: () => window.location.reload(), // Basic retry - can be customized
    } : undefined,
  }
}

// Check if error should trigger logout
export function shouldLogout(error: AppError): boolean {
  return error.code === ErrorCode.UNAUTHORIZED || 
         error.code === ErrorCode.SESSION_EXPIRED
}

// Check if online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

// Utility to wrap async functions with error handling
export function withErrorHandling<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  fn: T,
  options?: {
    onError?: (error: AppError) => void
    fallback?: ReturnType<T> extends Promise<infer R> ? R : never
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      const appError = createErrorFromUnknown(error)
      errorLogger.log(appError)
      
      if (options?.onError) {
        options.onError(appError)
      }
      
      if (options?.fallback !== undefined) {
        return options.fallback
      }
      
      throw appError
    }
  }) as T
}

export default {
  AppError,
  ErrorCode,
  createErrorFromResponse,
  createErrorFromUnknown,
  errorLogger,
  errorToToast,
  shouldLogout,
  isOnline,
  withErrorHandling,
}
