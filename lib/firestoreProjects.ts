import { collection, doc, getDocs } from 'firebase/firestore'
import { db } from './firebase'

export interface FSProject {
  projectNumber: string
  projectDate: string
  subsidiary: string
  clientCompany: string
  PresenterWorkType: string
  projectTitle: string
  projectNature: string
  amount: number
  paid: boolean
  paidTo: string
  invoice: string
}

export async function fetchReferenceMapping(): Promise<Record<string,string>> {
  const refSnap = await getDocs(collection(db, 'aote-ref'))
  const map: Record<string,string> = {}
  refSnap.forEach(doc => {
    const data = doc.data() as any
    if (data && data.englishName) {
      map[doc.id] = data.englishName
    }
  })
  return map
}

export async function listCompanyYears(companyId: string): Promise<string[]> {
  const yearSnap = await getDocs(collection(db, `${companyId}-projects`))
  return yearSnap.docs.map(d => d.id)
}

export async function fetchProjects(companyId: string, year: string): Promise<FSProject[]> {
  const col = collection(db, `${companyId}-projects`, year, 'projects')
  const snap = await getDocs(col)
  return snap.docs.map(d => d.data() as FSProject)
}
