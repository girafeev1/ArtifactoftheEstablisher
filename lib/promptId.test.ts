import { latestPromptIdFromList } from './promptId'

describe('latestPromptIdFromList', () => {
  test('parses and sorts prompt filenames', () => {
    const id = latestPromptIdFromList([
      'p-001.md',
      'p-027.md',
      'p-027-04r.md',
      'p-027-05r.md',
      'p-026-02r.md',
      'notes.txt',
    ])
    expect(id).toBe('P-027-05r')
  })
})
