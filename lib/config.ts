// lib/config.ts
// DEPRECATED: Use @/lib/config instead for centralized configuration
// This file is kept for backwards compatibility

import { googleConfig } from './config/integrations'

/**
 * @deprecated Use `import { googleConfig } from '@/lib/config'` instead
 */
export const serviceAccountCredentials = googleConfig.credentials
