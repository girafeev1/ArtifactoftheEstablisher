jest.mock('../../lib/firebase', () => ({
  projectsDb: {},
  PROJECTS_FIRESTORE_DATABASE_ID: '(default)',
}))

const projectsDatabase = require('../../lib/projectsDatabase') as typeof import('../../lib/projectsDatabase')

const { __projectsDatabaseInternals, isProjectOverdue } = projectsDatabase
const { toBooleanValue, resolvePaymentStatusFlag } = __projectsDatabaseInternals
type ProjectRecord = import('../../lib/projectsDatabase').ProjectRecord

describe('projectsDatabase payment helpers', () => {
  it('normalizes string tokens into booleans', () => {
    expect(toBooleanValue('Cleared')).toBe(true)
    expect(toBooleanValue('due')).toBe(false)
    expect(toBooleanValue('1')).toBe(true)
    expect(toBooleanValue('0')).toBe(false)
  })

  it('interprets descriptive payment statuses', () => {
    expect(resolvePaymentStatusFlag('No Payment Due')).toBe(true)
    expect(resolvePaymentStatusFlag('Past Due')).toBe(false)
    expect(resolvePaymentStatusFlag('Awaiting Payment')).toBe(false)
    expect(resolvePaymentStatusFlag(undefined)).toBeNull()
  })

  it('detects overdue projects using paid flag and payment status', () => {
    const baseProject: ProjectRecord = {
      id: 'p1',
      year: '2025',
      amount: null,
      clientCompany: 'Watch Music Limited',
      invoice: null,
      onDateDisplay: null,
      onDateIso: null,
      paid: null,
      paidTo: null,
      paymentStatus: null,
      presenterWorkType: null,
      projectDateDisplay: null,
      projectDateIso: null,
      projectNature: null,
      projectNumber: '2025-001',
      projectTitle: null,
      subsidiary: null,
      workStatus: 'active',
    }

    expect(isProjectOverdue({ ...baseProject, paid: true })).toBe(false)
    expect(isProjectOverdue({ ...baseProject, paid: false })).toBe(true)
    expect(isProjectOverdue({ ...baseProject, paymentStatus: 'Pending Payment' })).toBe(true)
    expect(isProjectOverdue({ ...baseProject, paymentStatus: 'No Payment Due', paid: null })).toBe(false)
  })
})
