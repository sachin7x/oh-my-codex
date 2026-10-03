import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { isAbsolute, join, normalize, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_VERIFIER_CONTRACT,
  isCandidatePathAllowed,
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
  readonly private_tmp?: boolean;
  readonly env?: Readonly<Record<string, string>>;
}

export interface AuditWorker {
  run(workspace: string, requests: readonly WorkerRequest[], policy: IsolationPolicy): Promise<WorkerResponse[]>;
}

function safeRelativePath(path: string): string {
  const normalized = normalize(path);
  if (isAbsolute(path) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Unsafe candidate path: ${path}`);
  }
  return normalized;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function writeWorkspaceFile(workspace: string, path: string, content: string): Promise<void> {
  const target = join(workspace, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

async function materializeWorkspace(
  candidate: CandidateFileSet,
  contract: VerifierContract,
): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'vagent-audit-'));

  for (const [rawPath, content] of Object.entries(candidate.base_files)) {
    const path = safeRelativePath(rawPath);
    if (contract.candidate_denied_prefixes.some(prefix => path === prefix || path.startsWith(prefix))) {
      continue;
    }
    await writeWorkspaceFile(workspace, path, content);
  }

  for (const [rawPath, content] of Object.entries(candidate.submitted_files)) {
    const path = safeRelativePath(rawPath);
    if (!isCandidatePathAllowed(path, contract)) continue;
    await writeWorkspaceFile(workspace, path, content);
  }

  return workspace;
}

export class ProcessAuditWorker implements AuditWorker {
  constructor(private readonly worker: ProcessAuditWorkerPolicy) {}

  async run(workspace: string, requests: readonly WorkerRequest[], policy: IsolationPolicy): Promise<WorkerResponse[]> {
    const timeout = this.worker.timeout_ms ?? policy.timeout_ms;
    const nonce = randomUUID();
    const baseEnv = this.worker.env ?? { PATH: '/usr/bin:/bin' };

    let command: string[];
    if (this.worker.use_namespaces) {
      const workerCommand = this.worker.command.map(shellQuote).join(' ');
      const namespaceScript = this.worker.private_tmp === true && policy.private_tmp
        ? `mount -t tmpfs tmpfs /tmp && exec ${workerCommand}`
        : `exec ${workerCommand}`;
      command = ['unshare', '-Urmn', '--', 'sh', '-c', namespaceScript];
    } else {
      command = [...this.worker.command];
    }

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
          try {
            responses.push(JSON.parse(line.slice(nonce.length)) as WorkerResponse);
          } catch {
            reject(new Error('Audit protocol JSON violation; verdict is UNKNOWN.'));
            return;
          }
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
