import { truncateList } from './truncate'

describe('truncateList', () => {
  test('handles arrays of various lengths', () => {
    expect(truncateList<number>([])).toEqual({ visible: [], hiddenCount: 0 })
    expect(truncateList([1])).toEqual({ visible: [1], hiddenCount: 0 })
    expect(truncateList([1,2,3,4,5])).toEqual({ visible: [1,2,3,4,5], hiddenCount: 0 })
    expect(truncateList([1,2,3,4,5,6])).toEqual({ visible: [1,2,3,4,5], hiddenCount: 1 })
    expect(truncateList([1,2,3,4,5,6,7])).toEqual({ visible: [1,2,3,4,5], hiddenCount: 2 })
  })
})
