import Head from "next/head"
import dynamic from "next/dynamic"
import type { GetServerSideProps } from "next"
import { getSession } from "next-auth/react"

const DashboardApp = dynamic(
  () => import("../../components/dashboard/NewUIDashboardApp"),
  { ssr: false }
)

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Dashboard</title>
      </Head>
      <DashboardApp />
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session?.user) {
    return {
      redirect: {
        destination: "/api/auth/signin",
        permanent: false,
      },
    }
  }

  return { props: {} }
}
