// next-auth.d.ts
// @ts-nocheck
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken?: string
  }
}
