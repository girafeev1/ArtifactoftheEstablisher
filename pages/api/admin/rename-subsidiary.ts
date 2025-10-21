import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from '../../../lib/firebase'

type ResponseData = { updated: number; year: string } | { error: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData | any>) {
  if (!['POST','GET'].includes(req.method || '')) {
    res.setHeader('Allow', 'POST, GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { confirm, year, list } = (req.query || {}) as { confirm?: string; year?: string; list?: string }
  const y = (year || '').trim()
  if (!y || !/^\d{4}$/.test(y)) {
    return res.status(400).json({ error: 'Invalid or missing year' })
  }
  const doList = String(list || '').toLowerCase() === 'true'
  if (req.method === 'POST' && confirm !== 'rename-erl') {
    return res.status(400).json({ error: "Missing confirm=rename-erl" })
  }

  try {
    let count = 0
    const results: Array<{ id: string; path: string; before?: string; after?: string }> = []
    // Try nested path first: projects/{year}/projects/*
    try {
      const nested = collection(projectsDb, 'projects', y, 'projects')
      const snap = await getDocs(nested)
      for (const d of snap.docs) {
        const ref = doc(projectsDb, 'projects', y, 'projects', d.id)
        const before = (d.data() as any)?.subsidiary
        if (doList) {
          results.push({ id: d.id, path: `projects/${y}/projects/${d.id}`, before })
        } else {
          await updateDoc(ref, { subsidiary: 'ERL' }).catch(() => {})
          count += 1
          results.push({ id: d.id, path: `projects/${y}/projects/${d.id}`, before, after: 'ERL' })
        }
      }
    } catch {}
    // Fallback: legacy root-level year collection: {year}/*
    try {
      const legacy = collection(projectsDb, y)
      const snap2 = await getDocs(legacy)
      for (const d of snap2.docs) {
        const ref = doc(projectsDb, y, d.id)
        const before = (d.data() as any)?.subsidiary
        if (doList) {
          results.push({ id: d.id, path: `${y}/${d.id}`, before })
        } else {
          await updateDoc(ref, { subsidiary: 'ERL' }).catch(() => {})
          count += 1
          results.push({ id: d.id, path: `${y}/${d.id}`, before, after: 'ERL' })
        }
      }
    } catch {}
    if (doList) return res.status(200).json({ year: y, total: results.length, items: results })
    return res.status(200).json({ updated: count, year: y, items: results })
  } catch (e) {
    return res.status(500).json({ error: 'Rename failed' })
  }
}
