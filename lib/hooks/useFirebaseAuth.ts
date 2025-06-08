// lib/hooks/useFirebaseAuth.ts
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '../firebase'

export function useFirebaseAuth() {
  const { data: session } = useSession()

  useEffect(() => {
    const idToken = (session as any)?.idToken as string | undefined
    if (!idToken) return
    if (auth.currentUser) return
    fetch('/api/firebase/custom-token')
      .then(res => res.json())
      .then(data => {
        return signInWithCustomToken(auth, data.customToken)
      })
      .then(userCred => {
        console.log('[useFirebaseAuth] Signed in to Firebase as', userCred.user.email)
      })
      .catch(err => {
        console.error('[useFirebaseAuth] Failed to sign in to Firebase', err)
      })
  }, [session])
}
