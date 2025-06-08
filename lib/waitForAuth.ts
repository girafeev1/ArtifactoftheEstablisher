// lib/waitForAuth.ts
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

export function waitForAuth(): Promise<void> {
  return new Promise(resolve => {
    if (auth.currentUser) {
      resolve()
      return
    }
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        unsub()
        resolve()
      }
    })
  })
}
