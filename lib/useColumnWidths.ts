import { useState, useEffect } from 'react'

export function useColumnWidths(key: string, defaults: number[]) {
  const [widths, setWidths] = useState<number[]>(() => {
    if (typeof window === 'undefined') return defaults
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr)) return arr
      }
    } catch {
      // ignore parse errors
    }
    return defaults
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(widths))
    }
  }, [key, widths])

  const updateWidth = (index: number, width: number) => {
    setWidths((prev) => {
      const next = [...prev]
      next[index] = width
      return next
    })
  }

  return [widths, updateWidth] as const
}
