# V-Agent: verifier-first agent layer

V-Agent is a small, repository-native agent layer for oh-my-codex.

## Invariants

1. The candidate workspace is evaluated by a verifier outside the agent's planning state.
2. Proxy verification and independent audit results are recorded separately.
3. Authority-protected paths can be declared immutable for the audit boundary.
4. Evidence is append-only within a run and can be hashed for provenance.
5. Exploit detectors produce findings; they do not define functional truth.

## Current scope

The first implementation provides TypeScript contracts, a command-based visible verifier, a snapshot-based independent auditor, an evidence ledger, and a small exploit-detector registry.

This is a foundation layer, not a security sandbox. A production auditor still needs an isolated trusted execution boundary, immutable hidden references, and server-side provenance.
