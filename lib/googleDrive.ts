import { google } from 'googleapis'

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file']

function getServiceAccount() {
  const json = process.env.ACCOUNT_SERVICE_PRIVATE_KEY
  if (!json) throw new Error('ACCOUNT_SERVICE_PRIVATE_KEY missing')
  try {
    const parsed = JSON.parse(json)
    const client_email = parsed.client_email as string
    let private_key = parsed.private_key as string
    if (!client_email || !private_key) throw new Error('Invalid service account JSON')
    // Normalize escaped newlines
    private_key = private_key.replace(/\\n/g, '\n')
    return { client_email, private_key }
  } catch (e) {
    throw new Error('Failed to parse ACCOUNT_SERVICE_PRIVATE_KEY JSON')
  }
}

export async function getDriveClient() {
  const { client_email, private_key } = getServiceAccount()
  const jwt = new google.auth.JWT({ email: client_email, key: private_key, scopes: DRIVE_SCOPES })
  await jwt.authorize()
  return google.drive({ version: 'v3', auth: jwt })
}

export async function ensureYearFolder(rootFolderId: string, year: string): Promise<string> {
  const drive = await getDriveClient()
  // Try to find child folder with this name
  const q = `mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and name = '${year.replace(/'/g, "\\'")}' and trashed = false`
  const res = await drive.files.list({ q, fields: 'files(id, name)' })
  const existing = res.data.files?.[0]
  if (existing?.id) return existing.id
  const created = await drive.files.create({ requestBody: { name: year, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] }, fields: 'id' })
  if (!created.data.id) throw new Error('Failed to create year folder')
  return created.data.id
}

export async function uploadPdfBuffer(folderId: string, filename: string, buf: Buffer): Promise<{ fileId: string; webViewLink?: string }> {
  const drive = await getDriveClient()
  const file = await drive.files.create({
    requestBody: { name: filename, parents: [folderId], mimeType: 'application/pdf' },
    media: { mimeType: 'application/pdf', body: Buffer.from(buf) as any },
    fields: 'id, webViewLink',
  } as any)
  return { fileId: file.data.id as string, webViewLink: file.data.webViewLink || undefined }
}

