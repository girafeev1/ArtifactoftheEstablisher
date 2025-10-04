import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { app } from './firebase'

const auth = getAuth(app)

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error('[firebase] failed to set persistence', err)
  })
}

export { auth }
