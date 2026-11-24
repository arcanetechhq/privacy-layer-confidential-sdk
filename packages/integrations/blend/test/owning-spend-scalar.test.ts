import { describe, expect, it } from 'vitest';
import { owningSpendScalar } from '../src/owning-spend-scalar.js';

const OWNER = new Uint8Array(32).fill(1);
const DECOY = new Uint8Array(32).fill(2);
const ACCOUNT = 'GBRS2YFQI36FCWICQNEJPB7D6EJWQL62ME7GHBNSFK2TIQWQPE6A6IUT';

describe('owning spend scalar', () => {
  it('returns the scalar that owns the chain index', async () => {
    const scalar = await owningSpendScalar({
      spendScalars: [DECOY, OWNER],
      account: ACCOUNT,
      blendPoolContractId: new Uint8Array(32).fill(2),
      tokenContractId: new Uint8Array(32).fill(3),
      chainIndex: 0,
    });

    expect(Buffer.from(scalar).toString('hex')).toBe('01'.repeat(32));
  });
});
