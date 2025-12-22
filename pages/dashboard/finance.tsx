import Head from "next/head"
import dynamic from "next/dynamic"
import type { GetServerSideProps } from "next"
import { getSession } from "next-auth/react"

const FinanceApp = dynamic(
  () => import("../../components/finance/NewUIFinanceApp"),
  { ssr: false },
)

export default function FinancePage() {
  return (
    <>
      <Head>
        <title>Finance · AOTE PMS</title>
      </Head>
      <FinanceApp />
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

  console.info("[finance] getServerSideProps invoked", requestContext)

  try {
    const session = await getSession(ctx)

    if (!session?.user) {
      console.warn("[finance] No authenticated session, redirecting", requestContext)
      return {
        redirect: {
          destination: "/api/auth/signin",
          permanent: false,
        },
      }
    }

    const identity = session.user.email ?? session.user.name ?? "unknown"
    console.info("[finance] Authenticated session detected", {
      ...requestContext,
      user: identity,
    })

    return { props: {} }
  } catch (error) {
    console.error("[finance] getServerSideProps failed", {
      ...requestContext,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: "Unknown error", raw: error },
    })
    throw error
  }
}
