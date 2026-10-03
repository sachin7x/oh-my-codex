export type AuditVerdict = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface AuditCase {
  readonly id: string;
  readonly method: string;
  readonly body: string;
  readonly expected: string;
}

export interface IsolationPolicy {
  readonly fresh_workspace: boolean;
  readonly scrub_environment: boolean;
  readonly isolated_process: boolean;
  readonly private_tmp: boolean;
  readonly network_disabled: boolean;
  readonly timeout_ms: number;
}

export interface VerifierContract {
  readonly version: string;
  readonly candidate_allowed_prefixes: readonly string[];
  readonly candidate_denied_prefixes: readonly string[];
  readonly verifier_authority: readonly string[];
  readonly isolation: IsolationPolicy;
  readonly fail_closed: true;
}

export interface CandidateFileSet {
  readonly base_files: Readonly<Record<string, string>>;
  readonly submitted_files: Readonly<Record<string, string>>;
}

export interface WorkerRequest {
  readonly id: string;
  readonly method: string;
  readonly body: string;
}

export interface WorkerResponse {
  readonly id: string;
  readonly ok: boolean;
  readonly body?: string;
  readonly error?: string;
}

export interface AuditResult {
  readonly verdict: AuditVerdict;
  readonly passed: number;
  readonly total: number;
  readonly results: readonly {
    readonly id: string;
    readonly verdict: AuditVerdict;
    readonly detail?: string;
  }[];
  readonly contract_version: string;
}

export function validateContract(contract: VerifierContract): void {
  if (!contract.version) throw new Error('Verifier contract requires a version.');
  if (contract.fail_closed !== true) throw new Error('Verifier contract must be fail-closed.');
  if (!contract.isolation.fresh_workspace) throw new Error('Independent audit requires a fresh workspace.');
  if (!contract.isolation.scrub_environment) throw new Error('Independent audit requires a scrubbed environment.');
  if (!contract.isolation.isolated_process) throw new Error('Independent audit requires a new process.');
  if (contract.isolation.timeout_ms <= 0) throw new Error('Audit timeout must be positive.');
  if (contract.verifier_authority.length === 0) throw new Error('Verifier authority must be explicit.');
}

export const DEFAULT_VERIFIER_CONTRACT: VerifierContract = {
  version: 'vagent-verifier-contract-v1',
  candidate_allowed_prefixes: ['planner.py', 'src/'],
  candidate_denied_prefixes: [
    'calls.json',
    'tests/',
    'conftest.py',
    'sitecustomize.py',
    'usercustomize.py',
  ],
  verifier_authority: [
    'expected_answers',
    'hidden_cases',
    'verdict',
    'verifier_version',
    'evidence_hash',
  ],
  isolation: {
    fresh_workspace: true,
    scrub_environment: true,
    isolated_process: true,
    private_tmp: true,
    network_disabled: true,
    timeout_ms: 6000,
  },
  fail_closed: true,
};
