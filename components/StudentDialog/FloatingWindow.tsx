import React from 'react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import { Typography, Button } from 'antd'
import { CloseOutlined } from '@ant-design/icons'

const { Title } = Typography

interface FloatingWindowProps {
  title?: string
  children: React.ReactNode
  onClose: () => void
  actions?: React.ReactNode | null
}

// FloatingWindow renders detachable content using react-rnd. On small screens
// (<600px) it falls back to a full-screen overlay without drag/resize.
export default function FloatingWindow({ title, children, onClose, actions }: FloatingWindowProps) {
  const body =
    typeof document !== 'undefined' ? document.body : undefined

  const content = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 600) {
      return (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#fff',
            zIndex: 1500,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingLeft: 40,
              paddingRight: 40,
              paddingTop: 8,
              paddingBottom: 8,
            }}
          >
            {title && (
              <Title
                level={5}
                className="floating-title"
                aria-live="polite"
                style={{ margin: 0 }}
              >
                {title}
              </Title>
            )}
            <div>
              {actions}
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={onClose}
                aria-label="close window"
              />
            </div>
          </div>
          <div style={{ flexGrow: 1, overflow: 'auto', padding: 32 }}>{children}</div>
        </div>
      )
    }

    const HANDLE_CLASS = 'floating-window-handle'
    return (
      <Rnd
        default={{ x: 120, y: 80, width: 900, height: 600 }}
        minWidth={300}
        minHeight={200}
        bounds="window"
        style={{ zIndex: 1500 }}
        dragHandleClassName={HANDLE_CLASS}
      >
        <div
          style={{
            backgroundColor: '#fff',
            height: '100%',
            width: '100%',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            className={HANDLE_CLASS}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingLeft: 40,
              paddingRight: 40,
              paddingTop: 8,
              paddingBottom: 8,
              borderBottom: '1px solid #f0f0f0',
              cursor: 'move',
              touchAction: 'none',
            }}
          >
            {title && (
              <Title
                level={5}
                className="floating-title"
                aria-live="polite"
                style={{ margin: 0 }}
              >
                {title}
              </Title>
            )}
            <div>
              {actions}
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={onClose}
                aria-label="close window"
              />
            </div>
          </div>
          <div style={{ flexGrow: 1, overflow: 'auto', padding: 32 }}>{children}</div>
        </div>
      </Rnd>
    )
  }

  const node = content()
  return body ? createPortal(node, body) : node
}
