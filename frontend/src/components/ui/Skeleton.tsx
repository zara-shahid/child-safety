'use client'

import { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const baseClasses = 'bg-surface-200 dark:bg-surface-700'
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton',
    none: '',
  }

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl',
  }

  const defaultHeight = variant === 'text' ? '1em' : undefined

  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={{
        width: width,
        height: height || defaultHeight,
        ...style,
      }}
      {...props}
    />
  )
}

// Pre-built skeleton components for common use cases
export function SkeletonCard() {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1">
          <Skeleton width="60%" height={20} className="mb-2" />
          <Skeleton width="40%" height={16} />
        </div>
      </div>
      <Skeleton width="100%" height={12} className="mb-2" />
      <Skeleton width="80%" height={12} className="mb-2" />
      <Skeleton width="60%" height={12} />
    </div>
  )
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-800">
      <Skeleton variant="rounded" width={48} height={48} />
      <div className="flex-1">
        <Skeleton width="70%" height={18} className="mb-2" />
        <Skeleton width="50%" height={14} />
      </div>
      <Skeleton variant="rounded" width={80} height={32} />
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-4 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-3">
            <Skeleton variant="rounded" width={40} height={40} />
            <div>
              <Skeleton width={60} height={24} className="mb-1" />
              <Skeleton width={40} height={14} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
      <div className="flex items-center justify-between mb-6">
        <Skeleton width={150} height={24} />
        <Skeleton variant="rounded" width={100} height={32} />
      </div>
      <Skeleton variant="rounded" width="100%" height={200} />
    </div>
  )
}

export default Skeleton
