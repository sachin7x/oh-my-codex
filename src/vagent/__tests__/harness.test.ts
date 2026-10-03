import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentLoop } from '../agent-loop.js';
import { EvidenceLedger } from '../evidence.js';

describe('agent loop', () => {
  it('respects the step budget and records actions', async () => {
    const ledger = new EvidenceLedger();
    let calls = 0;
    const model = {
      async nextAction() {
        calls += 1;
        return { kind: 'replan' as const, summary: 'continue' };
      },
    };
    const loop = new AgentLoop(model, new Map(), ledger, { max_steps: 3, verify_every: 99 });
    const result = await loop.run(
      { id: 't', description: 'x' },
      async () => ({
        passed: false,
        evidence: [],
        summary: 'not complete',
        confidence: 'high',
      }),
    );
    assert.equal(calls, 3);
    assert.equal(result.steps, 3);
    assert.equal(ledger.all().length, 3);
  });
});

describe('process runner', () => {
  it('captures command output deterministically enough for a smoke test', async () => {
    const ledger = new EvidenceLedger();
    const { ProcessCommandRunner } = await import('../execution.js');
    const runner = new ProcessCommandRunner({ cwd: process.cwd() });
    const result = await runner.run('printf VAGENT_OK', ledger);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, 'VAGENT_OK');
    assert.equal(ledger.all().length, 1);
  });
});
