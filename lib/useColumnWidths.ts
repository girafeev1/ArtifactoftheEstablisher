import { useState, useEffect, useCallback, useRef } from 'react'

interface ColumnDef {
  key: string
  width: number
}

export function useColumnWidths(
  tableId: string,
  columns: readonly ColumnDef[],
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
          const next = Math.max(24, Math.min(1000, startWidth + delta))
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

  const measurerRef = useRef<HTMLDivElement | null>(null)

  const autoSize = useCallback(
    (key: string, root: HTMLElement) => {
      if (!measurerRef.current && typeof document !== 'undefined') {
        const m = document.createElement('div')
        m.style.position = 'absolute'
        m.style.visibility = 'hidden'
        m.style.height = 'auto'
        m.style.whiteSpace = 'nowrap'
        m.style.top = '-9999px'
        m.style.left = '-9999px'
        document.body.appendChild(m)
        measurerRef.current = m
      }
      const measurer = measurerRef.current
      if (!measurer) return
      let max = 0
      const cells = root.querySelectorAll<HTMLElement>(`[data-col="${key}"]`)
      cells.forEach((el) => {
        const style = getComputedStyle(el)
        measurer.style.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        measurer.textContent = el.textContent || ''
        const w = measurer.offsetWidth
        if (w > max) max = w
      })
      const next = Math.max(24, Math.min(600, max + 20))
      setWidths((prev) => ({ ...prev, [key]: next }))
    },
    [],
  )

  const dblClickResize = useCallback(
    (key: string, rootEl?: HTMLElement) => {
      if (rootEl) autoSize(key, rootEl)
    },
    [autoSize],
  )

  const keyResize = useCallback(
    (key: string, dir: 'left' | 'right') => {
      setWidths((prev) => {
        const delta = dir === 'left' ? -8 : 8
        const next = Math.max(24, Math.min(1000, (prev[key] || 0) + delta))
        return { ...prev, [key]: next }
      })
    },
    [],
  )

  return { widths, startResize, dblClickResize, keyResize }
}

