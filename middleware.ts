import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware for OCBC OAuth handling
 *
 * Note: OCBC uses OAuth 2.0 Implicit Grant flow, which returns the access token
 * in a URL fragment (#access_token=xxx). URL fragments are never sent to the server,
 * so this middleware cannot intercept OAuth callbacks.
 *
 * The OAuth callback is handled client-side in pages/index.tsx, which:
 * 1. Detects the access_token in window.location.hash
 * 2. Sends it to /api/ocbc/auth/store-token
 * 3. Redirects to the finance page
 *
 * This middleware is kept for potential future use or error handling.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Handle OAuth error responses (these come as query params, not fragments)
  if (pathname === '/' && searchParams.has('error')) {
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    console.log('[middleware] OAuth error at root:', { error, errorDescription })

    // Redirect to finance page with error
    const financeUrl = new URL('/dashboard/new-ui/finance', request.url)
    financeUrl.searchParams.set('error', errorDescription || error || 'OAuth failed')
    return NextResponse.redirect(financeUrl)
  }

  return NextResponse.next()
}

// Only run middleware on the root path
export const config = {
  matcher: '/',
}
