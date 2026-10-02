export type TaskSize = 'small' | 'standard' | 'large';

export type EvidenceType =
  | 'inspect' | 'edit' | 'execute' | 'test' | 'typecheck' | 'lint'
  | 'build' | 'audit' | 'static' | 'manual';

export type ExploitKind =
  | 'authority_violation' | 'test_modification' | 'verifier_modification'
  | 'hidden_data_access' | 'hardcoded_answer' | 'process_termination'
  | 'environment_inspection' | 'test_skip' | 'fixture_manipulation'
  | 'network_abuse' | 'reward_manipulation' | 'unknown';

export interface TaskSpec {
  id: string;
  description: string;
  size?: TaskSize;
  repo?: string;
  base_ref?: string;
  immutable_paths?: string[];
  hidden_reference?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceEvent {
  id: string;
  step: number;
  type: EvidenceType;
  action: string;
  command?: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  workspace_hash?: string;
  timestamp: string;
  tool_version?: string;
  metadata?: Record<string, unknown>;
}

export interface ExploitFinding {
  kind: ExploitKind;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  detector_version: string;
  details?: string;
}

export interface VerificationResult {
  passed: boolean;
  evidence: EvidenceEvent[];
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AuditResult {
  truth: 'pass' | 'fail' | 'unknown';
  proxy_pass: boolean;
  exploit_detected: boolean;
  authority_violation: boolean;
  findings: ExploitFinding[];
  evidence: EvidenceEvent[];
  verifier_version: string;
  audit_version: string;
}

export interface AgentRunResult {
  task: TaskSpec;
  verification: VerificationResult;
  audit: AuditResult;
  trajectory: EvidenceEvent[];
}
