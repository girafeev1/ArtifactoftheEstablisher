import { google } from 'googleapis';
import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { pdf } from '@react-pdf/renderer'
import { doc, getDoc } from 'firebase/firestore'
import { fetchInvoicesForProject } from '../../../../../../lib/projectInvoices'
import { buildClassicInvoiceDocument, type ClassicInvoiceVariant } from '../../../../../../lib/pdfTemplates/classicInvoice'
import { FONT_DATA } from '../../../../../../lib/pdfTemplates/fontData'
import { projectsDb } from '../../../../../../lib/firebase'
import { fetchSubsidiaryById } from '../../../../../../lib/subsidiaries'
import { resolveBankAccountIdentifier } from '../../../../../../lib/erlDirectory'

const VARIANTS: ClassicInvoiceVariant[] = ['bundle', 'A', 'A2', 'B', 'B2']

const computeHash = (obj: any): string =>
  crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')

const parseVariant = (raw: string | undefined | null): ClassicInvoiceVariant => {
  if (!raw) return 'bundle'
  const normalized = raw.trim()
  return (VARIANTS.includes(normalized as ClassicInvoiceVariant) ? normalized : 'bundle') as ClassicInvoiceVariant
}



const toStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const formatDisplayDate = (value: unknown): string | null => {
  if (!value) return null
  const fromString = toStringValue(value)
  if (!fromString) return null
  const parsed = new Date(fromString)
  if (Number.isNaN(parsed.getTime())) return fromString
  return parsed.toLocaleDateString('en-HK', { month: 'short', day: '2-digit', year: 'numeric' })
}

const fallbackSubsidiaryProfile = {
  englishName: 'Establish Records Limited',
  chineseName: '別樹唱片有限公司',
  addressLines: [
    '1/F 18 Wang Toi Shan Leung Uk Tsuen',
    'Yuen Long Pat Heung',
    'N.T.',
    'Hong Kong',
  ],
  phone: '+(852) 6694 9527',
  email: 'account@establishrecords.com',
}

const fetchProjectSnapshot = async (year: string, projectId: string) => {
  try {
    const nested = doc(projectsDb, 'projects', year, 'projects', projectId)
    const nestedSnap = await getDoc(nested)
    if (nestedSnap.exists()) {
      return nestedSnap
    }
  } catch {
    // ignore nested errors and fall back
  }
  try {
    const legacy = doc(projectsDb, year, projectId)
    const legacySnap = await getDoc(legacy)
    if (legacySnap.exists()) {
      return legacySnap
    }
  } catch {
    // ignore
  }
  return null
}



  const bufferFromStream = (stream: any): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', (err: any) => reject(err))
    })

  const bufferFromWebStream = async (webStream: any): Promise<Buffer> => {
    try {
      const reader = webStream.getReader()
      const chunks: Buffer[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(Buffer.from(value))
      }
      return Buffer.concat(chunks)
    } catch (err) {
      throw err
    }
  }

  

export const config = { api: { bodyParser: false } }
