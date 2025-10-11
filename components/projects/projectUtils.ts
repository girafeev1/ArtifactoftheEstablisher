import type { ClientDirectoryRecord } from "../../lib/clientDirectory"
import type { ProjectRecord } from "../../lib/projectsDatabase"

export type NormalizedProject = ProjectRecord & {
  projectNumber: string
  projectTitle: string | null
  clientCompany: string | null
  subsidiary: string | null
  searchIndex: string
}

export type NormalizedClient = {
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: string | null
}

const trimOrNull = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const stringOrNA = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return "N/A"
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : "N/A"
}

export const amountText = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-"
  }
  return `HK$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export const paidStatusText = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return "N/A"
  }
  return value ? "Paid" : "Unpaid"
}

export const paidStatusColor = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return "default"
  }
  return value ? "green" : "red"
}

export const paidDateText = (
  paid: boolean | null | undefined,
  date: string | null | undefined,
) => {
  if (!paid) {
    return "-"
  }
  if (!date) {
    return "-"
  }
  const trimmed = date.trim()
  return trimmed.length > 0 ? trimmed : "-"
}

export const paymentChipLabel = (paid: boolean | null | undefined) => {
  if (paid === null || paid === undefined) {
    return "N/A"
  }
  return paid ? "Cleared" : "Due"
}

export const paymentChipColor = (paid: boolean | null | undefined) => {
  if (paid === null || paid === undefined) {
    return "default"
  }
  return paid ? "green" : "red"
}

export const normalizeProject = (record: ProjectRecord): NormalizedProject => {
  const projectNumber = record.projectNumber?.trim() ?? record.id
  const projectTitle = record.projectTitle ? record.projectTitle.trim() || null : null
  const clientCompany = record.clientCompany ? record.clientCompany.trim() || null : null
  const subsidiary = record.subsidiary ? record.subsidiary.trim() || null : null
  const searchIndex = [
    projectNumber,
    projectTitle ?? "",
    clientCompany ?? "",
    subsidiary ?? "",
    record.invoice ?? "",
    record.projectNature ?? "",
    record.presenterWorkType ?? "",
  ]
    .join(" ")
    .toLowerCase()

  return {
    ...record,
    projectNumber,
    projectTitle,
    clientCompany,
    subsidiary,
    searchIndex,
  }
}

export const normalizeClient = (record: ClientDirectoryRecord): NormalizedClient => {
  const companyName = trimOrNull(record.companyName)
  const representative = trimOrNull(record.nameAddressed) ?? trimOrNull(record.name)

  return {
    companyName,
    addressLine1: trimOrNull(record.addressLine1),
    addressLine2: trimOrNull(record.addressLine2),
    addressLine3: trimOrNull(record.addressLine3),
    region: trimOrNull(record.region ?? record.addressLine5 ?? null),
    representative,
  }
}

export const mergeLineWithRegion = (
  line: string | null | undefined,
  region: string | null | undefined,
): string | null => {
  const normalizedLine = trimOrNull(line)
  const normalizedRegion = trimOrNull(region)

  if (!normalizedLine && !normalizedRegion) {
    return null
  }
  if (!normalizedLine) {
    return normalizedRegion
  }
  if (!normalizedRegion) {
    return normalizedLine
  }
  return `${normalizedLine}, ${normalizedRegion}`
}
