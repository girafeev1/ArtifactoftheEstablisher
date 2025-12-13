// lib/clientDirectoryAdmin.ts

import type { RepresentativeInfo } from './representative'

export interface ClientDirectoryWriteInput {
  companyName?: string | null
  representative?: RepresentativeInfo | string | null
  email?: string | null
  phone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  addressLine3?: string | null
  addressLine4?: string | null
  addressLine5?: string | null
  region?: string | null
}
