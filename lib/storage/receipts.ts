/**
 * Firebase Storage Utilities for Receipts
 *
 * Server-side utilities for uploading, downloading, and managing receipt files
 * in Firebase Storage using the Admin SDK.
 */

import { getStorage } from 'firebase-admin/storage'
import { ensureAdminApp } from '../firebaseAdmin'
import { v4 as uuidv4 } from 'uuid'

// Ensure admin app is initialized
ensureAdminApp()

const storage = getStorage()
const bucket = storage.bucket()

/**
 * Sanitize filename for storage
 * Removes special characters and limits length
 */
function sanitizeFilename(filename: string): string {
  // Get extension
  const lastDot = filename.lastIndexOf('.')
  const ext = lastDot > 0 ? filename.slice(lastDot) : ''
  const name = lastDot > 0 ? filename.slice(0, lastDot) : filename

  // Sanitize name: keep alphanumeric, dashes, underscores
  const sanitized = name
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)

  return `${sanitized}${ext}`.toLowerCase()
}

/**
 * Generate storage path for a receipt
 * Format: receipts/{subsidiaryId}/{year}/{month}/{uuid}-{filename}
 */
function generateStoragePath(
  subsidiaryId: string,
  originalFilename: string
): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const uuid = uuidv4().slice(0, 8)
  const sanitizedName = sanitizeFilename(originalFilename)

  return `receipts/${subsidiaryId}/${year}/${month}/${uuid}-${sanitizedName}`
}

/**
 * Upload a receipt file to Firebase Storage
 *
 * @param file - File buffer to upload
 * @param originalFilename - Original filename
 * @param mimeType - MIME type of the file
 * @param subsidiaryId - Subsidiary ID for organizing files
 * @returns Storage path and signed URL
 */
export async function uploadReceiptToStorage(
  file: Buffer,
  originalFilename: string,
  mimeType: string,
  subsidiaryId: string
): Promise<{ storagePath: string; downloadUrl: string }> {
  const storagePath = generateStoragePath(subsidiaryId, originalFilename)
  const fileRef = bucket.file(storagePath)

  // Upload the file
  await fileRef.save(file, {
    metadata: {
      contentType: mimeType,
      metadata: {
        originalFilename,
        subsidiaryId,
        uploadedAt: new Date().toISOString(),
      },
    },
  })

  // Generate a signed URL valid for 7 days
  const [signedUrl] = await fileRef.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  })

  return {
    storagePath,
    downloadUrl: signedUrl,
  }
}

/**
 * Get a signed download URL for a receipt
 *
 * @param storagePath - Storage path of the file
 * @param expiresInHours - URL expiration time in hours (default: 1 hour)
 * @returns Signed download URL
 */
export async function getReceiptDownloadUrl(
  storagePath: string,
  expiresInHours: number = 1
): Promise<string> {
  const fileRef = bucket.file(storagePath)

  // Check if file exists
  const [exists] = await fileRef.exists()
  if (!exists) {
    throw new Error(`Receipt file not found: ${storagePath}`)
  }

  const [signedUrl] = await fileRef.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInHours * 60 * 60 * 1000,
  })

  return signedUrl
}

/**
 * Delete a receipt file from storage
 *
 * @param storagePath - Storage path of the file to delete
 */
export async function deleteReceiptFromStorage(
  storagePath: string
): Promise<void> {
  const fileRef = bucket.file(storagePath)

  // Check if file exists before deleting
  const [exists] = await fileRef.exists()
  if (exists) {
    await fileRef.delete()
  }
}

/**
 * Get file metadata from storage
 *
 * @param storagePath - Storage path of the file
 * @returns File metadata or null if not found
 */
export async function getReceiptFileMetadata(
  storagePath: string
): Promise<{
  size: number
  contentType: string
  created: Date
  updated: Date
} | null> {
  const fileRef = bucket.file(storagePath)

  const [exists] = await fileRef.exists()
  if (!exists) {
    return null
  }

  const [metadata] = await fileRef.getMetadata()

  return {
    size: parseInt(metadata.size as string, 10),
    contentType: metadata.contentType || 'application/octet-stream',
    created: new Date(metadata.timeCreated as string),
    updated: new Date(metadata.updated as string),
  }
}

/**
 * Copy a receipt file to a new location (for backup/archiving)
 *
 * @param sourcePath - Source storage path
 * @param destinationPath - Destination storage path
 */
export async function copyReceiptFile(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  const sourceRef = bucket.file(sourcePath)
  const destRef = bucket.file(destinationPath)

  await sourceRef.copy(destRef)
}

/**
 * Upload a receipt from a URL (e.g., Telegram file URL)
 *
 * @param fileUrl - URL to download the file from
 * @param originalFilename - Filename to use
 * @param mimeType - MIME type
 * @param subsidiaryId - Subsidiary ID
 * @returns Storage path and download URL
 */
export async function uploadReceiptFromUrl(
  fileUrl: string,
  originalFilename: string,
  mimeType: string,
  subsidiaryId: string
): Promise<{ storagePath: string; downloadUrl: string }> {
  // Download the file
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`Failed to download file from URL: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  // Upload to storage
  return uploadReceiptToStorage(buffer, originalFilename, mimeType, subsidiaryId)
}
