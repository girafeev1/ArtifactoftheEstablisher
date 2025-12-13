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

