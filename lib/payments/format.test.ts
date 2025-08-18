import assert from 'node:assert'
import { buildIdentifier } from './format'

assert.strictEqual(buildIdentifier(), undefined)
assert.strictEqual(buildIdentifier('ABC'), undefined)
assert.strictEqual(buildIdentifier(undefined, '123'), undefined)
assert.strictEqual(buildIdentifier('ABC', '123'), 'ABC/123')
assert.ok(/^[0-9A-Za-z]+\/[0-9A-Za-z_-]+$/.test(buildIdentifier('HK', 'acc_1')!))
