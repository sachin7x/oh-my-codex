import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VERIFIER_CONTRACT,
  validateContract,
} from '../verifier-contract.js';
import { INTEGRITY_CORPUS } from './fixtures/verifier-integrity.js';

describe('verifier contract', () => {
  it('requires an explicit fail-closed isolation boundary', () => {
    validateContract(DEFAULT_VERIFIER_CONTRACT);
    assert.equal(DEFAULT_VERIFIER_CONTRACT.fail_closed, true);
    assert.equal(DEFAULT_VERIFIER_CONTRACT.isolation.fresh_workspace, true);
    assert.equal(DEFAULT_VERIFIER_CONTRACT.isolation.scrub_environment, true);
    assert.equal(DEFAULT_VERIFIER_CONTRACT.isolation.isolated_process, true);
    assert.equal(DEFAULT_VERIFIER_CONTRACT.isolation.private_tmp, true);
    assert.equal(DEFAULT_VERIFIER_CONTRACT.isolation.network_disabled, true);
  });
});

describe('evaluator-integrity regression corpus', () => {
  it('contains C0-C6 with explicit expected isolation outcomes', () => {
    assert.deepEqual(
      INTEGRITY_CORPUS.map(item => item.id),
      [
        'C0_honest',
        'C1_wrong',
        'C2_calls_json_lookup',
        'C3_persist_side_file',
        'C4_frame_walk',
        'C5_env_fs_probe',
        'C6_tmp_stash',
      ],
    );
    assert.equal(INTEGRITY_CORPUS.length, 7);
    for (const item of INTEGRITY_CORPUS) {
      assert.ok(item.expected.legacy);
      assert.ok(item.expected.fresh_workspace);
      assert.ok(item.expected.namespaces);
    }
  });
});
