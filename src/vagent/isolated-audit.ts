import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_VERIFIER_CONTRACT,
  validateContract,
  type AuditCase,
  type AuditResult,
  type CandidateFileSet,
  type IsolationPolicy,
  type VerifierContract,
  type WorkerRequest,
  type WorkerResponse,
} from './verifier-contract.js';

export interface ProcessAuditWorkerPolicy {
  readonly command: readonly string[];
  readonly timeout_ms?: number;
  readonly use_namespaces?: boolean;
  readonly env?: Readonly<Record<string, string>>;
}

export interface AuditWorker {
  run(workspace: string, requests: readonly WorkerRequest[], policy: IsolationPolicy): Promise<WorkerResponse[]>;
}

function isDenied(path: string, denied: readonly string[]): boolean {
  return denied.some(prefix => path === prefix || path.startsWith(prefix));
}

function safeRelativePath(path: string): string {
  const normalized = normalize(path);
  if (isAbsolute(path) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Unsafe candidate path: ${path}`);
  }
  return normalized;
}

async function materializeWorkspace(
  candidate: CandidateFileSet,
  contract: VerifierContract,
): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'vagent-audit-'));
  const files = { ...candidate.base_files, ...candidate.submitted_files };

  for (const [rawPath, content] of Object.entries(files)) {
    const path = safeRelativePath(rawPath);
    if (isDenied(path, contract.candidate_denied_prefixes)) continue;
    const target = join(workspace, path);
    await writeFile(target, content, { encoding: 'utf8', flag: 'w' }).catch(async error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await import('node:fs/promises').then(fs => fs.mkdir(dirname(target), { recursive: true }));
      await writeFile(target, content, 'utf8');
    });
  }
  return workspace;
}

export class ProcessAuditWorker implements AuditWorker {
  constructor(private readonly worker: ProcessAuditWorkerPolicy) {}

  async run(workspace: string, requests: readonly WorkerRequest[], policy: IsolationPolicy): Promise<WorkerResponse[]> {
    const timeout = this.worker.timeout_ms ?? policy.timeout_ms;
    const nonce = randomUUID();
    const baseEnv = this.worker.env ?? { PATH: '/usr/bin:/bin' };
    const command = this.worker.use_namespaces
      ? ['unshare', '-Urmn', '--', ...this.worker.command]
      : [...this.worker.command];

    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        cwd: workspace,
        env: baseEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new Error('Audit worker timeout; verdict is UNKNOWN.'));
      }, timeout);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });

      child.on('error', error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', code => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`Audit worker exited with code ${code}: ${stderr.trim()}`));
          return;
        }

        const lines = stdout.split('\n').filter(Boolean);
        const responses: WorkerResponse[] = [];
        for (const line of lines) {
          if (!line.startsWith(nonce)) {
            reject(new Error('Audit protocol violation; verdict is UNKNOWN.'));
            return;
          }
          responses.push(JSON.parse(line.slice(nonce.length)) as WorkerResponse);
        }
        if (responses.length !== requests.length) {
          reject(new Error('Audit worker returned an incomplete response set.'));
          return;
        }
        resolve(responses);
      });

      child.stdin.write(nonce + '\n');
      for (const request of requests) {
        child.stdin.write(JSON.stringify(request) + '\n');
      }
      child.stdin.end();
    });
  }
}

export class IsolatedAuditBoundary {
  constructor(
    private readonly contract: VerifierContract = DEFAULT_VERIFIER_CONTRACT,
    private readonly worker: AuditWorker,
  ) {
    validateContract(contract);
  }

  async audit(candidate: CandidateFileSet, cases: readonly AuditCase[]): Promise<AuditResult> {
    if (cases.length === 0) {
      throw new Error('Independent audit requires at least one hidden or held-out case.');
    }

    const workspace = await materializeWorkspace(candidate, this.contract);
    try {
      const requests = cases.map(({ id, method, body }) => ({ id, method, body }));
      const responses = await this.worker.run(workspace, requests, this.contract.isolation);
      const results = responses.map((response, index) => {
        const expected = cases[index].expected;
        if (response.ok && response.body === expected) {
          return { id: response.id, verdict: 'PASS' as const };
        }
        return {
          id: response.id,
          verdict: 'FAIL' as const,
          detail: response.error ?? 'Wrong answer.',
        };
      });

      const passed = results.filter(result => result.verdict === 'PASS').length;
      return {
        verdict: passed === cases.length ? 'PASS' : 'FAIL',
        passed,
        total: cases.length,
        results,
        contract_version: this.contract.version,
      };
    } catch {
      return {
        verdict: 'UNKNOWN',
        passed: 0,
        total: cases.length,
        results: [],
        contract_version: this.contract.version,
      };
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }
}
