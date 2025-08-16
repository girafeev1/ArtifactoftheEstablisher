import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'

async function backfill() {
  const snap = await getDocs(collection(db, 'Students'))
  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as any
      const legacy = data.billingSummary
      const cached = data.cached?.billingSummary
      if (legacy && !cached) {
        await updateDoc(doc(db, 'Students', d.id), {
          cached: { billingSummary: legacy },
        })
      }
    }),
  )
}

backfill()
  .then(() => {
    console.log('Backfill complete')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
