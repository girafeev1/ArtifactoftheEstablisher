import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from '../../../lib/firebase'

type ResponseData = { updated: number; year: string } | { error: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { confirm, year } = (req.query || {}) as { confirm?: string; year?: string }
  const y = (year || '').trim()
  if (!y || !/^\d{4}$/.test(y)) {
    return res.status(400).json({ error: 'Invalid or missing year' })
  }
  if (confirm !== 'rename-erl') {
    return res.status(400).json({ error: "Missing confirm=rename-erl" })
  }

  try {
    const parent = collection(projectsDb, 'projects', y, 'projects')
    const snap = await getDocs(parent)
    let count = 0
    for (const d of snap.docs) {
      const ref = doc(projectsDb, 'projects', y, 'projects', d.id)
      await updateDoc(ref, { subsidiary: 'ERL' }).catch(() => {})
      count += 1
    }
    return res.status(200).json({ updated: count, year: y })
  } catch (e) {
    return res.status(500).json({ error: 'Rename failed' })
  }
}

