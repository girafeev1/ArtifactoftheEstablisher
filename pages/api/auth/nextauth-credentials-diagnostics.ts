import type { NextApiRequest, NextApiResponse } from 'next'

import { getAuthOptions } from './[...nextauth]'

interface DiagnosticsSuccessResponse {
  ok: true
}

interface DiagnosticsFailureResponse {
  ok: false
  message?: string
  name?: string
}

type DiagnosticsResponse = DiagnosticsSuccessResponse | DiagnosticsFailureResponse

type AuthorizeContext = {
  query: NextApiRequest['query']
  body: unknown
  headers: NextApiRequest['headers']
  method: NextApiRequest['method']
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiagnosticsResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({ ok: false, message: 'Method Not Allowed', name: 'MethodNotAllowed' })
    return
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const idToken = typeof (body as Record<string, unknown>).idToken === 'string'
    ? ((body as Record<string, unknown>).idToken as string)
    : ''

  if (!idToken.trim()) {
    res.status(400).json({ ok: false, message: 'Missing Firebase ID token', name: 'MissingTokenError' })
    return
  }

  try {
    const options = await getAuthOptions()
    const credentialsProvider = options.providers.find(
      (provider: any) => provider.id === 'credentials' && provider.type === 'credentials'
    ) as { authorize?: (credentials: Record<string, string>, ctx: AuthorizeContext) => Promise<unknown> } | undefined

    if (!credentialsProvider?.authorize) {
      res.status(200).json({
        ok: false,
        message: 'NextAuth credentials provider is not configured.',
        name: 'CredentialsProviderMissing',
      })
      return
    }

    const authorizeContext: AuthorizeContext = {
      query: req.query,
      body,
      headers: req.headers,
      method: req.method,
    }

    const normalizedCredentials: Record<string, string> = {
      idToken,
    }

    const accessToken = (body as Record<string, unknown>).accessToken
    if (typeof accessToken === 'string' && accessToken.trim()) {
      normalizedCredentials.accessToken = accessToken
    }

    const refreshToken = (body as Record<string, unknown>).refreshToken
    if (typeof refreshToken === 'string' && refreshToken.trim()) {
      normalizedCredentials.refreshToken = refreshToken
    }

    try {
      const user = await credentialsProvider.authorize(normalizedCredentials, authorizeContext)

      if (!user) {
        res.status(200).json({
          ok: false,
          message: 'NextAuth authorize returned null for the supplied credentials.',
          name: 'CredentialsAuthorizeReturnedNull',
        })
        return
      }

      res.status(200).json({ ok: true })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'NextAuth authorize threw an unknown error while verifying the credentials.'
      const name = error instanceof Error && error.name ? error.name : 'UnknownAuthorizeError'
      console.error('[auth] NextAuth credentials diagnostics failed', error)
      res.status(200).json({ ok: false, message, name })
    }
  } catch (error) {
    console.error('[auth] Unable to load NextAuth options for diagnostics', error)
    res.status(200).json({
      ok: false,
      message: 'Failed to load NextAuth configuration for diagnostics.',
      name: 'NextAuthOptionsError',
    })
  }
}
