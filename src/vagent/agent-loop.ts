import type { EvidenceEvent, TaskSpec, VerificationResult } from './types.js';
import type { EvidenceLedger } from './evidence.js';

export interface AgentAction {
  readonly kind: 'tool' | 'finish' | 'replan';
  readonly tool?: string;
  readonly input?: Record<string, unknown>;
  readonly summary: string;
}

export interface AgentModel {
  nextAction(input: {
    task: TaskSpec;
    context: readonly string[];
    evidence: readonly EvidenceEvent[];
  }): Promise<AgentAction>;
}

export interface AgentTool {
  readonly name: string;
  run(input: Record<string, unknown>): Promise<{ output: string; metadata?: Record<string, unknown> }>;
}

export interface AgentLoopPolicy {
  readonly max_steps: number;
  readonly verify_every: number;
}

export interface AgentLoopResult {
  readonly completed: boolean;
  readonly reason: string;
  readonly verification?: VerificationResult;
  readonly steps: number;
}

export class AgentLoop {
  constructor(
    private readonly model: AgentModel,
    private readonly tools: Map<string, AgentTool>,
    private readonly ledger: EvidenceLedger,
    private readonly policy: AgentLoopPolicy = { max_steps: 32, verify_every: 4 },
  ) {}

  async run(task: TaskSpec, verify: () => Promise<VerificationResult>): Promise<AgentLoopResult> {
    const context: string[] = [];
    for (let step = 1; step <= this.policy.max_steps; step += 1) {
      const action = await this.model.nextAction({
        task,
        context,
        evidence: this.ledger.all(),
      });

      this.ledger.record({
        type: 'manual',
        action: action.summary,
        metadata: { step, kind: action.kind, tool: action.tool },
      });

      if (action.kind === 'finish') {
        const verification = await verify();
        return {
          completed: verification.passed,
          reason: verification.summary,
          verification,
          steps: step,
        };
      }

      if (action.kind === 'replan') {
        context.push(`Replan: ${action.summary}`);
      } else if (action.tool) {
        const tool = this.tools.get(action.tool);
        if (!tool) {
          context.push(`Tool unavailable: ${action.tool}`);
        } else {
          const result = await tool.run(action.input ?? {});
          context.push(result.output);
          this.ledger.record({
            type: 'execute',
            action: `tool:${action.tool}`,
            stdout: result.output,
            metadata: result.metadata,
          });
        }
      }

      if (step % this.policy.verify_every === 0) {
        const verification = await verify();
        if (verification.passed) {
          return {
            completed: true,
            reason: 'Verification passed at checkpoint.',
            verification,
            steps: step,
          };
        }
      }
    }

    const verification = await verify();
    return {
      completed: false,
      reason: 'Maximum agent steps reached.',
      verification,
      steps: this.policy.max_steps,
    };
  }
}
