import { sha256 } from './evidence.js';
import type { AgentRunResult, EvidenceEvent } from './types.js';

export interface RunMetrics {
  readonly steps: number;
  readonly tool_calls: number;
  readonly failures: number;
  readonly retries: number;
  readonly verification_events: number;
  readonly exploit_findings: number;
  readonly total_duration_ms: number;
  readonly trajectory_hash: string;
}

export function measureRun(
  result: AgentRunResult,
  evidence: readonly EvidenceEvent[],
  started_at_ms: number,
): RunMetrics {
  const verification_events = evidence.filter(event =>
    event.type === 'test' || event.type === 'typecheck' || event.type === 'lint' || event.type === 'build',
  ).length;
  const failures = evidence.filter(event => typeof event.exit_code === 'number' && event.exit_code !== 0).length;
  const tool_calls = evidence.filter(event => event.action.startsWith('tool:')).length;
  const steps = evidence.filter(event => event.type === 'manual').length;

  return {
    steps,
    tool_calls,
    failures,
    retries: 0,
    verification_events,
    exploit_findings: result.audit.findings.length,
    total_duration_ms: Math.max(0, Date.now() - started_at_ms),
    trajectory_hash: result.trajectory.length
      ? sha256(JSON.stringify(result.trajectory))
      : 'empty',
  };
}
