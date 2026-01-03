/**
 * Pending Approval Page
 *
 * Shown to users who have signed in but are awaiting admin approval.
 * When RBAC is disabled, this page is not used.
 */

import React, { useCallback, useState } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, signOut } from 'next-auth/react'
import { Button, Card, Result, Space, Typography, Spin } from 'antd'
import { ClockCircleOutlined, LogoutOutlined, ReloadOutlined } from '@ant-design/icons'

import { RBAC_ENABLED } from '../../lib/rbac/config'

const { Title, Text, Paragraph } = Typography

interface PendingPageProps {
  email: string | null
  name: string | null
}

export default function PendingPage({ email, name }: PendingPageProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    // Force a full page reload to get fresh session
    window.location.reload()
  }, [])

  const handleSignOut = useCallback(async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: 24,
      }}
    >
      <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <Result
          icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
          title="Account Pending Approval"
          subTitle={
            <Space direction="vertical" size={16}>
              <Paragraph>
                Your account has been created but is awaiting administrator approval.
              </Paragraph>
              {email && (
                <Text type="secondary">
                  Signed in as: <strong>{name || email}</strong>
                </Text>
              )}
              <Paragraph type="secondary">
                Once approved, you will be able to access the application.
                Please check back later or contact an administrator.
              </Paragraph>
            </Space>
          }
          extra={
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={refreshing ? <Spin size="small" /> : <ReloadOutlined />}
                onClick={handleRefresh}
                disabled={refreshing}
                block
              >
                {refreshing ? 'Checking...' : 'Check Approval Status'}
              </Button>
              <Button
                icon={<LogoutOutlined />}
                onClick={handleSignOut}
                block
              >
                Sign Out
              </Button>
            </Space>
          }
        />
      </Card>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<PendingPageProps> = async (ctx) => {
  const session = await getSession(ctx)

  // If not signed in, redirect to sign in
  if (!session?.user) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    }
  }

  // If RBAC is disabled, redirect to home (no pending state when disabled)
  if (!RBAC_ENABLED) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  // If user is approved (active status), redirect to home
  if (session.user.status === 'active') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  // If user is suspended, show different message (could create separate page)
  // For now, treat suspended same as pending

  return {
    props: {
      email: session.user.email || null,
      name: session.user.name || null,
    },
  }
}
