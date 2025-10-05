import type { GetServerSidePropsContext } from 'next'
import { getSession } from 'next-auth/react'

import { getServerSideProps } from '../../../../pages/dashboard/new-ui/client-accounts'

jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
}))

describe('Client Accounts (Refine preview) getServerSideProps', () => {
  const mockContext = {} as GetServerSidePropsContext
  const getSessionMock = getSession as jest.Mock

  beforeEach(() => {
    getSessionMock.mockReset()
  })

  it('redirects to sign-in when no authenticated user is present', async () => {
    getSessionMock.mockResolvedValue(null)

    const result = await getServerSideProps(mockContext)

    expect(result).toEqual({
      redirect: { destination: '/api/auth/signin', permanent: false },
    })
    expect(getSessionMock).toHaveBeenCalledWith(mockContext)
  })

  it('allows access when the session only includes user information', async () => {
    getSessionMock.mockResolvedValue({
      user: { name: 'Ada Lovelace', email: 'ada@example.com' },
    })

    const result = await getServerSideProps(mockContext)

    expect(result).toEqual({ props: {} })
    expect(getSessionMock).toHaveBeenCalledWith(mockContext)
  })
})
