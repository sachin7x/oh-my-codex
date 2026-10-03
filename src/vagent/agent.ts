import type { AgentRunResult, TaskSpec } from './types.js';
import { EvidenceLedger } from './evidence.js';
import { CommandVisibleVerifier, SnapshotIndependentAuditor, type CommandRunner, type IndependentAuditor, type WorkspaceSnapshot } from './verifier.js';
import { AuthorityBoundaryDetector, KnownExploitDetector } from './exploit.js';

export interface AgentWorkspace {
  snapshot(): Promise<WorkspaceSnapshot>;
  inspect(): Promise<Record<string, string>>;
}

export interface AgentPolicy {
  max_steps?: number;
  verify_every?: number;
}

export class VAgent {
  private readonly ledger = new EvidenceLedger();
  private readonly verifier = new CommandVisibleVerifier();
  private readonly auditor: IndependentAuditor = new SnapshotIndependentAuditor();
  private readonly detectors = [new AuthorityBoundaryDetector(), new KnownExploitDetector()];
  private readonly policy: Required<AgentPolicy>;

  constructor(
    private readonly workspace: AgentWorkspace,
    private readonly runner: CommandRunner,
    policy: AgentPolicy = {},
  ) {
    this.policy = {
      max_steps: policy.max_steps ?? 32,
      verify_every: policy.verify_every ?? 1,
    };
  }

  async run(task: TaskSpec): Promise<AgentRunResult> {
    const baseline = await this.workspace.snapshot();
    const verification = await this.verifier.verify(task, this.runner, this.ledger);
    const candidate = await this.workspace.snapshot();

    const findings = this.detectors.flatMap(detector =>
      detector.detect(task, candidate.files, this.ledger.all()),
    );
    const audit = await this.auditor.audit(
      task,
      baseline,
      candidate,
      verification,
      this.ledger,
    );

    const mergedAudit = {
      ...audit,
      findings: [...audit.findings, ...findings],
      exploit_detected: audit.exploit_detected || findings.length > 0,
      truth: audit.truth === 'pass' && findings.length === 0 ? 'pass' as const : 'fail' as const,
    };

    return {
      task,
      verification,
      audit: mergedAudit,
      trajectory: this.ledger.all(),
    };
  }
}

export function defaultTask(description: string, repo: string): TaskSpec {
  return {
    id: `task-${Date.now()}`,
    description,
    repo,
    size: 'standard',
    immutable_paths: ['.github/workflows', 'tests'],
  };
}
