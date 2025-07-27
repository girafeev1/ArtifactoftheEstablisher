// lib/hooks/useStudents.ts

import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, limit, getCountFromServer, where } from 'firebase/firestore'
import { db } from '../firebase'

export function useStudents() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      console.log('📥 useStudents: loading students')
      const snap = await getDocs(collection(db, 'Students'))
      console.log(`   got ${snap.size} students`)
      const today = new Date()
      const list = await Promise.all(
        snap.docs.map(async d => {
          const { account } = d.data() as any
          // ... the rest of your per-student load logic here ...
          return { account, /* sex, balanceDue, total, upcoming */ }
        })
      )
      if (!cancelled) {
        setStudents(list)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { students, loading }
}
