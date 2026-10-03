import { spawn } from 'node:child_process';
import type { EvidenceLedger } from './evidence.js';

export interface ExecutionPolicy {
  readonly cwd: string;
  readonly timeout_ms?: number;
  readonly env?: Record<string, string>;
}

export interface ExecutionResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly duration_ms: number;
}

export class ProcessCommandRunner {
  constructor(private readonly policy: ExecutionPolicy) {}

  run(command: string, ledger?: EvidenceLedger, type: 'execute' | 'test' = 'execute'): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const child = spawn('/bin/sh', ['-lc', command], {
        cwd: this.policy.cwd,
        env: { ...process.env, ...this.policy.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (result: ExecutionResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timer = this.policy.timeout_ms
        ? setTimeout(() => {
            child.kill('SIGKILL');
            finish({
              exitCode: 124,
              stdout,
              stderr: stderr + '\nProcess timed out.',
              duration_ms: Date.now() - started,
            });
          }, this.policy.timeout_ms)
        : undefined;

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });

      child.on('error', error => {
        if (timer) clearTimeout(timer);
        reject(error);
      });

      child.on('close', code => {
        if (timer) clearTimeout(timer);
        const result = {
          exitCode: code ?? 1,
          stdout,
          stderr,
          duration_ms: Date.now() - started,
        };
        if (ledger) {
          ledger.record({
            type,
            action: 'execute',
            command,
            exit_code: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            metadata: { duration_ms: result.duration_ms },
          });
        }
        finish(result);
      });
    });
  }
}
