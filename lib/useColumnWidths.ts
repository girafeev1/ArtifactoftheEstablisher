import { useState, useEffect, useCallback } from 'react'

interface ColumnDef {
  key: string
  width: number
}

export function useColumnWidths(
  tableId: string,
  columns: ColumnDef[],
  userId: string,
) {
  const storageKey = `tableWidth:${tableId}:${userId}`

  const getInitial = () => {
    const base: Record<string, number> = {}
    columns.forEach((c) => {
      base[c.key] = c.width
    })
    if (typeof window === 'undefined') return base
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach((k) => {
            if (typeof parsed[k] === 'number') base[k] = parsed[k]
          })
        }
      }
    } catch {
      // ignore
    }
    return base
  }

  const [widths, setWidths] = useState<Record<string, number>>(getInitial)

  useEffect(() => {
    setWidths(getInitial())
  }, [storageKey])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(widths))
    }
  }, [storageKey, widths])

  const startResize = useCallback(
    (key: string, e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widths[key]
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX
        setWidths((prev) => {
          const next = Math.max(60, Math.min(1000, startWidth + delta))
          return { ...prev, [key]: next }
        })
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [widths],
  )

  return { widths, startResize }
}

