// lib/hooks/useFirebaseAuth.ts
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from '../firebase'

export function useFirebaseAuth() {
  const { data: session } = useSession()

  useEffect(() => {
    const accessToken = (session as any)?.accessToken as string | undefined
    if (!accessToken) return
    if (auth.currentUser) return
    const credential = GoogleAuthProvider.credential(null, accessToken)
    signInWithCredential(auth, credential)
      .then(userCred => {
        console.log('[useFirebaseAuth] Signed in to Firebase as', userCred.user.email)
      })
      .catch(err => {
        console.error('[useFirebaseAuth] Failed to sign in to Firebase', err)
      })
  }, [session])
}
