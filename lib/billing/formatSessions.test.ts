import assert from 'node:assert'
import { formatSessions } from './formatSessions'

assert.strictEqual(formatSessions([]), '—')
assert.strictEqual(formatSessions([1,2,3]), '#1, #2, #3')
assert.strictEqual(formatSessions([1,2,3,4,5,6,7]), '#1, #2, #3, #4, #5, …')
