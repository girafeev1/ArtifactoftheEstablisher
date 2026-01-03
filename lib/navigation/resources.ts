/**
 * Shared Navigation Resources
 *
 * Centralized definition of all navigation resources for AppShell.
 * Import this in all *App.tsx components to ensure consistent navigation.
 */

import type { IResourceItem } from "@refinedev/core"

/**
 * Standard resources for all pages
 */
export const NAVIGATION_RESOURCES: IResourceItem[] = [
  { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
  { name: "projects", list: "/projects", meta: { label: "Projects" } },
  { name: "coaching", list: "/coaching", meta: { label: "Coaching" } },
  { name: "bank", list: "/bank", meta: { label: "Bank Access" } },
  { name: "accounting", list: "/accounting", meta: { label: "Accounting" } },
  { name: "client-directory", list: "/client-accounts", meta: { label: "Client Accounts" } },
  { name: "file-archive", list: "/file-archive", meta: { label: "File Archive" } },
  { name: "gadgets", list: "/gadgets", meta: { label: "Gadget" } },
  { name: "tools", list: "/tools", meta: { label: "Tools" } },
]

/**
 * Standard allowed menu keys
 */
export const ALLOWED_MENU_KEYS = [
  "dashboard",
  "projects",
  "coaching",
  "bank",
  "accounting",
  "client-directory",
  "file-archive",
  "gadgets",
  "tools",
] as const

export type AllowedMenuKey = typeof ALLOWED_MENU_KEYS[number]
