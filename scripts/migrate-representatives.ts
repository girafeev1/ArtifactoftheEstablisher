import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { FieldValue } from '@google-cloud/firestore'

import {
  normalizeRepresentative,
  parseRepresentativeString,
  representativeToDisplay,
  type RepresentativeInfo,
} from '../lib/representative'

let getAdminFirestore: ((databaseId?: string) => any) | null = null

type CliOptions = {
  apply: boolean
  includeClients: boolean
  includeInvoices: boolean
  limit: number | null
  outFile: string
}

const DEFAULT_OUT_FILE = path.resolve(process.cwd(), 'tmp/representative-migration-plan.json')

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2)
  const has = (flag: string) => args.includes(flag)
  const get = (flag: string) => {
    const idx = args.indexOf(flag)
    if (idx === -1) return null
    return args[idx + 1] ?? null
  }

  const limitRaw = get('--limit')
  const limit =
    typeof limitRaw === 'string' && limitRaw.trim().length > 0 ? Number(limitRaw) : null

  const outFile = get('--out') ? path.resolve(process.cwd(), String(get('--out'))) : DEFAULT_OUT_FILE

  const includeClients = has('--clients') || (!has('--clients') && !has('--invoices'))
  const includeInvoices = has('--invoices') || (!has('--clients') && !has('--invoices'))

  return {
    apply: has('--apply'),
    includeClients,
    includeInvoices,
    limit: Number.isFinite(limit) ? (limit as number) : null,
    outFile,
  }
}

const stableStringify = (value: unknown): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value ?? null)
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const normalized: Record<string, unknown> = {}
  keys.forEach((k) => {
    normalized[k] = record[k]
  })
  return JSON.stringify(normalized)
}

const buildRepresentativeFromLegacy = (legacyTitle: string | null, legacyName: string | null): RepresentativeInfo | null => {
  if (!legacyTitle && !legacyName) return null
  const combined = `${legacyTitle ? `${legacyTitle} ` : ''}${legacyName ?? ''}`.trim()
  if (!combined) return null
  return parseRepresentativeString(combined)
}

const normalizeOrLegacyRepresentative = (
  data: Record<string, unknown>,
): { rep: RepresentativeInfo | null; legacyString: string | null; legacyTitle: string | null } => {
  const legacyTitle =
    typeof (data as any).title === 'string' ? ((data as any).title as string).trim() || null : null
  const legacyString =
    typeof (data as any).representative === 'string'
      ? ((data as any).representative as string).trim() || null
      : null

  let rep = normalizeRepresentative(data.representative) ?? null
  // If the legacy schema stored `title` separately, preserve it in the new map
  // even when `representative` already contains a valid name.
  if (rep && !rep.title && legacyTitle) {
    rep = { ...rep, title: legacyTitle }
  }
  if (rep) return { rep, legacyString, legacyTitle }

  let nameWithoutDupedTitle = legacyString
  if (legacyTitle && nameWithoutDupedTitle) {
    const normalizedTitle = legacyTitle.toLowerCase()
    if (nameWithoutDupedTitle.toLowerCase().startsWith(normalizedTitle)) {
      nameWithoutDupedTitle = nameWithoutDupedTitle.slice(legacyTitle.length).trimStart()
    }
  }

  const derived = buildRepresentativeFromLegacy(legacyTitle, nameWithoutDupedTitle)
  return { rep: derived, legacyString, legacyTitle }
}

const writePlanFile = (outFile: string, plan: unknown) => {
  const dir = path.dirname(outFile)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(plan, null, 2), 'utf8')
}

const migrateClients = async (opts: CliOptions, plan: any[]) => {
  if (!getAdminFirestore) {
    throw new Error('getAdminFirestore is not initialized')
  }
  const fsClient = getAdminFirestore('epl-directory')
  const snap = await fsClient.collection('clients').get()

  let batch = fsClient.batch()
  let batchCount = 0
  let touched = 0

  for (const docSnap of snap.docs as any[]) {
    if (opts.limit != null && touched >= opts.limit) break

    const data = (docSnap.data() ?? {}) as Record<string, unknown>
    const { rep, legacyString, legacyTitle } = normalizeOrLegacyRepresentative(data)

    const before = {
      title: legacyTitle ?? null,
      representative: legacyString ?? data.representative ?? null,
    }

    if (!rep) {
      continue
    }

    const currentRep = normalizeRepresentative(data.representative)
    const repStoredAsString = typeof data.representative === 'string'
    const repChanged = repStoredAsString || stableStringify(currentRep) !== stableStringify(rep)
    const hasLegacyTitle = Object.prototype.hasOwnProperty.call(data, 'title')

    if (!repChanged && !hasLegacyTitle) {
      continue
    }

    const after = {
      representative: rep,
      deleteTitle: hasLegacyTitle,
      display: representativeToDisplay(rep),
    }

    plan.push({
      kind: 'client',
      path: docSnap.ref.path,
      before,
      after,
    })

    if (opts.apply) {
      const update: Record<string, unknown> = {
        representative: rep,
      }
      if (hasLegacyTitle) {
        update.title = FieldValue.delete()
      }
      batch.update(docSnap.ref, update)
      batchCount += 1
      if (batchCount >= 400) {
        await batch.commit()
        batch = fsClient.batch()
        batchCount = 0
      }
    }

    touched += 1
  }

  if (opts.apply && batchCount > 0) {
    await batch.commit()
  }

  return { scanned: snap.size, planned: plan.filter((p) => p.kind === 'client').length }
}

const listProjectRefs = async (fsProjects: ReturnType<NonNullable<typeof getAdminFirestore>>) => {
  const refs: any[] = []

  // Nested projects: projects/{year}/projects/{projectId}
  const yearDocs = await fsProjects.collection('projects').listDocuments()
  for (const yearDoc of yearDocs) {
    const projectDocs = await yearDoc.collection('projects').listDocuments()
    refs.push(...projectDocs)
  }

  // Legacy projects: {year}/{projectId}
  for (const yearDoc of yearDocs) {
    try {
      const legacyDocs = await fsProjects.collection(yearDoc.id).listDocuments()
      refs.push(...legacyDocs)
    } catch {
      // ignore
    }
  }

  // De-dupe by path
  const byPath = new Map<string, any>()
  refs.forEach((ref) => byPath.set(ref.path, ref))
  return Array.from(byPath.values())
}

const isInvoiceCollectionId = (id: string) => {
  if (id === 'invoice' || id === 'Invoice') return true
  return /^invoice-[a-z]+$/i.test(id)
}

const migrateInvoices = async (opts: CliOptions, plan: any[]) => {
  if (!getAdminFirestore) {
    throw new Error('getAdminFirestore is not initialized')
  }
  const dbId = process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || 'tebs-erl'
  const fsProjects = getAdminFirestore(dbId)

  const projects = await listProjectRefs(fsProjects)

  let touched = 0
  let scanned = 0

  let batch = fsProjects.batch()
  let batchCount = 0

  for (const projectRef of projects) {
    let cols: any[] = []
    try {
      cols = await projectRef.listCollections()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[migrate-representatives] failed to list collections for project', {
        projectPath: projectRef.path,
        error: err instanceof Error ? { message: err.message } : err,
      })
      continue
    }
    const invoiceCols = cols.filter((c: any) => isInvoiceCollectionId(c.id))

    for (const col of invoiceCols) {
      let snap: any
      try {
        snap = await col.get()
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[migrate-representatives] failed to scan invoice collection', {
          collectionPath: col.path,
          error: err instanceof Error ? { message: err.message } : err,
        })
        continue
      }

      scanned += snap.size
      for (const docSnap of snap.docs as any[]) {
        if (opts.limit != null && touched >= opts.limit) break

        const data = (docSnap.data() ?? {}) as Record<string, unknown>
        const { rep, legacyString, legacyTitle } = normalizeOrLegacyRepresentative(data)
        if (!rep) continue

        const currentRep = normalizeRepresentative(data.representative)
        const repStoredAsString = typeof data.representative === 'string'
        const repChanged = repStoredAsString || stableStringify(currentRep) !== stableStringify(rep)
        const hasLegacyTitle = Object.prototype.hasOwnProperty.call(data, 'title')

        if (!repChanged && !hasLegacyTitle) continue

        plan.push({
          kind: 'invoice',
          path: docSnap.ref.path,
          before: {
            title: legacyTitle ?? null,
            representative: legacyString ?? data.representative ?? null,
          },
          after: {
            representative: rep,
            deleteTitle: hasLegacyTitle,
            display: representativeToDisplay(rep),
          },
        })

        if (opts.apply) {
          const update: Record<string, unknown> = {
            representative: rep,
          }
          if (hasLegacyTitle) {
            update.title = FieldValue.delete()
          }
          batch.update(docSnap.ref, update)
          batchCount += 1
          if (batchCount >= 400) {
            await batch.commit()
            batch = fsProjects.batch()
            batchCount = 0
          }
        }

        touched += 1
      }
    }

    if (opts.limit != null && touched >= opts.limit) break
  }

  if (opts.apply && batchCount > 0) {
    await batch.commit()
  }

  return { scanned, planned: plan.filter((p) => p.kind === 'invoice').length }
}

const main = async () => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

  // firebaseAdmin reads env vars during module initialization, so we must load
  // dotenv *before* requiring it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const firebaseAdmin = require('../lib/firebaseAdmin') as { getAdminFirestore: (databaseId?: string) => any }
  getAdminFirestore = firebaseAdmin.getAdminFirestore

  const opts = parseArgs()

  const plan: any[] = []
  const startedAt = new Date().toISOString()

  const summary: Record<string, unknown> = {
    startedAt,
    apply: opts.apply,
    limit: opts.limit,
    targets: {
      clients: opts.includeClients,
      invoices: opts.includeInvoices,
    },
  }

  if (opts.includeClients) {
    // eslint-disable-next-line no-console
    console.log('[migrate-representatives] scanning clients…')
    summary.clients = await migrateClients(opts, plan)
  }

  if (opts.includeInvoices) {
    // eslint-disable-next-line no-console
    console.log('[migrate-representatives] scanning invoices…')
    summary.invoices = await migrateInvoices(opts, plan)
  }

  summary.plannedChanges = plan.length
  summary.finishedAt = new Date().toISOString()

  writePlanFile(opts.outFile, { summary, plan })

  // eslint-disable-next-line no-console
  console.log('[migrate-representatives] done', {
    outFile: opts.outFile,
    planned: plan.length,
    apply: opts.apply,
  })
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate-representatives] failed', err)
  process.exit(1)
})
