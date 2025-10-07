import type { GetServerSidePropsContext } from 'next'
import { getSession } from 'next-auth/react'

import { getServerSideProps } from '../../../../pages/dashboard/new-ui/client-accounts'

jest.mock('@refinedev/antd', () => ({
  List: () => null,
  FilterDropdown: () => null,
  useTable: () => ({
    tableProps: {},
    sorters: [],
    filters: [],
    setFilters: jest.fn(),
    setSorters: jest.fn(),
    setCurrentPage: jest.fn(),
    tableQuery: { isFetching: false, data: undefined, refetch: jest.fn() },
    searchFormProps: {},
  }),
}), { virtual: true })

jest.mock('@refinedev/core', () => ({
  Refine: ({ children }: any) => children,
  useMenu: () => ({ menuItems: [], selectedKey: undefined }),
}))

jest.mock('@refinedev/nextjs-router', () => ({}))

jest.mock('antd', () => ({
  App: ({ children }: any) => children,
  Avatar: () => null,
  Badge: () => null,
  Button: () => null,
  ConfigProvider: ({ children }: any) => children,
  Dropdown: ({ children }: any) => children,
  Divider: () => null,
  Drawer: () => null,
  Form: Object.assign(() => null, {
    Item: () => null,
    useForm: () => [{}, { resetFields: jest.fn(), setFieldsValue: jest.fn() }],
  }),
  Grid: { useBreakpoint: () => ({}) },
  Input: Object.assign(() => null, { Search: () => null }),
  Layout: {
    Header: ({ children }: any) => children,
    Content: ({ children }: any) => children,
    Sider: ({ children }: any) => children,
  },
  Menu: Object.assign(() => null, { Item: () => null }),
  Modal: ({ children }: any) => children,
  Pagination: () => null,
  Radio: Object.assign(() => null, {
    Group: ({ children }: any) => children,
    Button: ({ children }: any) => children,
  }),
  Select: () => null,
  Space: ({ children }: any) => children,
  Spin: () => null,
  Table: () => null,
  Tag: () => null,
  Tooltip: ({ children }: any) => children,
  Typography: { Text: ({ children }: any) => children, Title: ({ children }: any) => children },
}), { virtual: true })

jest.mock('@ant-design/icons', () => new Proxy({}, { get: () => () => null }), { virtual: true })

jest.mock('lodash.debounce', () => (fn: any) => fn, { virtual: true })

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
