/**
 * Unified Loading Components
 *
 * Consistent loading states across the application.
 * Includes spinner, skeleton, dots, and async content wrapper.
 */

import React from 'react'
import { Spin, Skeleton, Typography, Space } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'

const { Text } = Typography

// ============================================================================
// Loading Spinner
// ============================================================================

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'small' | 'default' | 'large'
  /** Optional loading text */
  tip?: string
  /** Center in parent container */
  centered?: boolean
  /** Full page overlay */
  fullPage?: boolean
}

/**
 * Standard loading spinner
 */
export function LoadingSpinner({
  size = 'default',
  tip,
  centered = true,
  fullPage = false,
}: LoadingSpinnerProps) {
  const antIcon = <LoadingOutlined style={{ fontSize: size === 'large' ? 48 : size === 'small' ? 16 : 24 }} spin />

  if (fullPage) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          zIndex: 9999,
        }}
      >
        <Space direction="vertical" align="center">
          <Spin indicator={antIcon} size={size} />
          {tip && <Text type="secondary">{tip}</Text>}
        </Space>
      </div>
    )
  }

  if (centered) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          gap: 16,
        }}
      >
        <Spin indicator={antIcon} size={size} />
        {tip && <Text type="secondary">{tip}</Text>}
      </div>
    )
  }

  return <Spin indicator={antIcon} size={size} tip={tip} />
}

// ============================================================================
// Loading Dots
// ============================================================================

export interface LoadingDotsProps {
  /** Color of the dots */
  color?: string
  /** Size of the dots */
  size?: 'small' | 'default' | 'large'
}

/**
 * Animated loading dots (...)
 */
export function LoadingDots({ color = '#1890ff', size = 'default' }: LoadingDotsProps) {
  const dotSize = size === 'large' ? 12 : size === 'small' ? 6 : 8
  const gap = size === 'large' ? 8 : size === 'small' ? 4 : 6

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: color,
            animation: `loadingDotPulse 1.4s ease-in-out ${i * 0.16}s infinite both`,
          }}
        />
      ))}
      <style>{`
        @keyframes loadingDotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </span>
  )
}

// ============================================================================
// Card Skeleton
// ============================================================================

export interface CardSkeletonProps {
  /** Number of skeleton cards to show */
  count?: number
  /** Show avatar in skeleton */
  avatar?: boolean
  /** Number of paragraph rows */
  rows?: number
}

/**
 * Skeleton loading state for cards
 */
export function CardSkeleton({ count = 1, avatar = false, rows = 3 }: CardSkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
          }}
        >
          <Skeleton avatar={avatar} active paragraph={{ rows }} />
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Table Skeleton
// ============================================================================

export interface TableSkeletonProps {
  /** Number of rows */
  rows?: number
  /** Number of columns */
  columns?: number
}

/**
 * Skeleton loading state for tables
 */
export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 16,
          padding: '12px 16px',
          background: '#fafafa',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton.Input key={i} active size="small" style={{ width: '80%' }} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 16,
            padding: '16px',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton.Input
              key={colIndex}
              active
              size="small"
              style={{ width: colIndex === 0 ? '90%' : '70%' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Form Skeleton
// ============================================================================

export interface FormSkeletonProps {
  /** Number of form fields */
  fields?: number
  /** Show labels */
  labels?: boolean
}

/**
 * Skeleton loading state for forms
 */
export function FormSkeleton({ fields = 4, labels = true }: FormSkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          {labels && (
            <Skeleton.Input active size="small" style={{ width: 100, marginBottom: 8 }} />
          )}
          <Skeleton.Input active style={{ width: '100%' }} />
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Inline Loading
// ============================================================================

export interface InlineLoadingProps {
  /** Loading text */
  text?: string
  /** Size of the spinner */
  size?: 'small' | 'default'
}

/**
 * Inline loading indicator for buttons or text
 */
export function InlineLoading({ text = 'Loading', size = 'small' }: InlineLoadingProps) {
  return (
    <Space size={8}>
      <Spin size={size} />
      <Text type="secondary">{text}</Text>
    </Space>
  )
}

// ============================================================================
// Async Content Wrapper
// ============================================================================

export interface AsyncContentProps {
  /** Whether content is loading */
  loading: boolean
  /** Error message if any */
  error?: string | null
  /** Loading component to show */
  loadingComponent?: React.ReactNode
  /** Error component to show */
  errorComponent?: React.ReactNode
  /** Content to render when loaded */
  children: React.ReactNode
  /** Retry function for errors */
  onRetry?: () => void
}

/**
 * Wrapper for async content with loading and error states
 */
export function AsyncContent({
  loading,
  error,
  loadingComponent,
  errorComponent,
  children,
  onRetry,
}: AsyncContentProps) {
  if (loading) {
    return <>{loadingComponent || <LoadingSpinner />}</>
  }

  if (error) {
    return (
      <>
        {errorComponent || (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
              gap: 16,
            }}
          >
            <Text type="danger">{error}</Text>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </>
    )
  }

  return <>{children}</>
}

// ============================================================================
// Page Loading
// ============================================================================

export interface PageLoadingProps {
  /** Loading message */
  message?: string
}

/**
 * Full page loading state
 */
export function PageLoading({ message = 'Loading...' }: PageLoadingProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      <Space direction="vertical" align="center" size="large">
        <Spin size="large" />
        <Text type="secondary" style={{ fontSize: 16 }}>
          {message}
        </Text>
      </Space>
    </div>
  )
}

// ============================================================================
// Default Export
// ============================================================================

export default LoadingSpinner
