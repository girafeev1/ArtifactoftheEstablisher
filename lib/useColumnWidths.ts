import { useState, useEffect } from 'react'

interface Col { key: string; width: number }

export function useColumnWidths(tableId: string, cols: Col[], userId: string) {
  const storageKey = 'tableWidth:' + tableId + ':' + userId
  const initial: any = {}
  cols.forEach(function (c) {
    initial[c.key] = c.width
  })
  const [widths, setWidths] = useState(function () {
    if (typeof window === 'undefined') return initial
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) return JSON.parse(stored)
    } catch (e) {
      // ignore
    }
    return initial
  })
  useEffect(function () {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths))
    } catch (e) {
      // ignore
    }
  }, [widths, storageKey])
  function startResize(key: string, e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = widths[key] || initial[key] || 100
    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX
      const w = Math.max(60, startW + delta)
      setWidths(function (prev: any) {
        const next = { ...prev, [key]: w }
        return next
      })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  return { widths, startResize }
}
