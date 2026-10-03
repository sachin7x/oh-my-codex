import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceLedger } from '../evidence.js';
import { KnownExploitDetector } from '../exploit.js';

describe('vagent evidence ledger', () => {
  it('assigns monotonically increasing steps and hashes the trajectory', () => {
    const ledger = new EvidenceLedger();
    const a = ledger.record({ type: 'inspect', action: 'list' });
    const b = ledger.record({ type: 'execute', action: 'run', command: 'echo ok' });
    assert.equal(a.step, 1);
    assert.equal(b.step, 2);
    assert.equal(ledger.all().length, 2);
    assert.equal(ledger.hash().length, 64);
  });
});

describe('vagent exploit detector', () => {
  it('detects test skipping', () => {
    const detector = new KnownExploitDetector();
    const findings = detector.detect(
      { id: 't', description: 'x' },
      { 'tests/example.ts': 'pytest.skip("x")' },
      [],
    );
    assert.equal(findings.some(f => f.kind === 'test_skip'), true);
  });
});
