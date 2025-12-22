import Head from "next/head"
import dynamic from "next/dynamic"
import type { GetServerSideProps } from "next"
import { getSession } from "next-auth/react"

const ToolsApp = dynamic(
  () => import("../../components/tools/NewUIToolsApp"),
  { ssr: false }
)

export default function ToolsPage() {
  return (
    <>
      <Head>
        <title>Tools</title>
      </Head>
      <ToolsApp />
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const headers = (ctx.req?.headers ?? {}) as Record<string, string | string[] | undefined>
  const vercelHeader = headers["x-vercel-id"]
  const hostHeader = headers.host
  const requestContext = {
    method: ctx.req?.method ?? "GET",
    url: ctx.req?.url ?? "",
    host: Array.isArray(hostHeader) ? hostHeader.join(",") : hostHeader ?? null,
    vercelId: Array.isArray(vercelHeader) ? vercelHeader.join(",") : vercelHeader ?? null,
  }

  console.info("[tools] getServerSideProps invoked", requestContext)

  try {
    const session = await getSession(ctx)

    if (!session?.user) {
      console.warn("[tools] No authenticated session, redirecting", requestContext)
      return {
        redirect: {
          destination: "/api/auth/signin",
          permanent: false,
        },
      }
    }

    const identity = session.user.email ?? session.user.name ?? "unknown"
    console.info("[tools] Authenticated session detected", {
      ...requestContext,
      user: identity,
    })

    return { props: {} }
  } catch (error) {
    console.error("[tools] getServerSideProps failed", {
      ...requestContext,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: "Unknown error", raw: error },
    })
    throw error
  }
}
