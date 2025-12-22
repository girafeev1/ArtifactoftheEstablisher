/**
 * Navigation utilities with modifier key support
 *
 * Provides standard web behavior:
 * - Normal click: Navigate in same tab
 * - Ctrl+Click (Windows/Linux) or Cmd+Click (Mac): Open in new tab
 */

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

type RouterLike = {
  push: (url: string) => void | Promise<boolean>
}

/**
 * Navigate to a URL with modifier key support.
 *
 * If Ctrl (Windows/Linux) or Cmd (Mac) is held, opens in a new tab.
 * Otherwise, navigates in the same tab using the provided router or window.location.
 *
 * @param event - The mouse event (to detect modifier keys)
 * @param url - The URL to navigate to
 * @param router - Optional Next.js router for client-side navigation
 */
export function navigateWithModifier(
  event: React.MouseEvent | MouseEvent | { metaKey?: boolean; ctrlKey?: boolean },
  url: string,
  router?: RouterLike | null
): void {
  const isModifierKey = event.metaKey || event.ctrlKey

  if (isModifierKey) {
    // Open in new tab
    window.open(url, '_blank')
  } else if (router) {
    // Client-side navigation
    router.push(url)
  } else {
    // Full page navigation
    window.location.href = url
  }
}

/**
 * Check if a modifier key (Ctrl/Cmd) is pressed
 */
export function isModifierKeyPressed(
  event: React.MouseEvent | MouseEvent | { metaKey?: boolean; ctrlKey?: boolean }
): boolean {
  return Boolean(event.metaKey || event.ctrlKey)
}
