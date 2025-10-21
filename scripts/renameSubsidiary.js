const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const get = (name) => {
  const regex = new RegExp(name + '="([\\s\\S]*?)"')
  const match = env.match(regex)
  return match ? eval('`' + match[1] + '`') : null
}
const privateKey = get('FIREBASE_ADMIN_PRIVATE_KEY')
const clientEmail = get('FIREBASE_ADMIN_CLIENT_EMAIL')
const projectId = get('FIREBASE_ADMIN_PROJECT_ID')
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
}
const db = admin.firestore()

const year = '2025'
async function run() {
  let count = 0
  const nested = await db.collection('projects').doc(year).collection('projects').get()
  nested.forEach((doc) => {
    doc.ref.update({ subsidiary: 'ERL' })
    count += 1
  })
  const legacy = await db.collection(year).get()
  legacy.forEach((doc) => {
    doc.ref.update({ subsidiary: 'ERL' })
    count += 1
  })
  console.log(`Updated ${count} documents to ERL`)
}
run().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
