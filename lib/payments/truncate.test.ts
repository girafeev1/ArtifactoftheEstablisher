import assert from 'node:assert'
import { truncateList } from './truncate'

assert.deepStrictEqual(truncateList<number>([]), { visible: [], hiddenCount: 0 })
assert.deepStrictEqual(truncateList([1]), { visible: [1], hiddenCount: 0 })
assert.deepStrictEqual(truncateList([1,2,3,4,5]), { visible: [1,2,3,4,5], hiddenCount: 0 })
assert.deepStrictEqual(truncateList([1,2,3,4,5,6]), { visible: [1,2,3,4,5], hiddenCount: 1 })
assert.deepStrictEqual(truncateList([1,2,3,4,5,6,7]), { visible: [1,2,3,4,5], hiddenCount: 2 })
