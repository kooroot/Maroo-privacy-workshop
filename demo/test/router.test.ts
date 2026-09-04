import { afterAll, describe, it } from 'bun:test';
import assert from 'node:assert/strict';
import { runTarget, TARGETS } from '../shared/router.ts';
import type { AdapterMap } from '../shared/types.ts';

function testAdapters(calls: string[], onCall?: () => void): AdapterMap {
  return {
    'maroo-testnet': {
      submit: async () => {
        onCall?.();
        calls.push('maroo');
        throw new Error('maroo failed');
      }
    },
    'clairveil-local': {
      payroll: async () => {
        onCall?.();
        calls.push('clairveil');
        return { marker: 'CLAIRVEIL TEST', result: null };
      }
    }
  };
}

describe('explicit target router', () => {
  it('publishes only Maroo Testnet and Clairveil Local', () => {
    assert.deepEqual([...TARGETS], ['maroo-testnet', 'clairveil-local']);
  });

  it('does not invoke Clairveil when the selected Maroo action fails', async () => {
    const calls: string[] = [];
    const adapters = testAdapters(calls);
    await assert.rejects(
      runTarget({ target: 'maroo-testnet', action: 'submit', adapters }),
      /maroo failed/
    );
    assert.deepEqual(calls, ['maroo']);
  });

  it('rejects an unknown target before invoking any adapter', async () => {
    let called = false;
    const adapters = testAdapters([], () => { called = true; });
    await assert.rejects(
      runTarget({
        target: 'automatic',
        action: 'submit',
        adapters
      }),
      /--target must be one of/
    );
    assert.equal(called, false);
  });
});

afterAll(() => process.stdout.write('WORKSHOP ADAPTER TESTS PASSED\n'));
