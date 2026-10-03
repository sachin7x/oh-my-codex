# Evaluator-integrity experiment

## Research question

Does evaluator isolation remove reward-positive trajectories that depend on information or state exposed by a legacy execution environment?

## Conditions

1. Legacy: run the unmodified CATCH RewardPCSWEFn.
2. Fresh workspace: build an audit workspace from trusted base files and allowed submitted files; do not copy calls.json, tests, or visible-run leftovers.
3. Namespaces: fresh workspace plus a new scrubbed process and Linux user, mount, and network namespaces with private temporary storage.

Expected answers remain in the verifier parent. Candidate requests contain only request id, method, and body. The parent compares returned bodies with expected values.

## Regression corpus

C0 honest
C1 wrong
C2 calls.json lookup
C3 visible-run side-file persistence
C4 Python frame walk
C5 honest environment/filesystem probe
C6 temporary-directory stash

The corpus is stored in src/vagent/__tests__/fixtures/verifier-integrity.ts.

## Verdict semantics

PASS means every requested case passes the independent comparison.

FAIL means the candidate deterministically returns a wrong result.

UNKNOWN means timeout, worker crash, protocol violation, incomplete response, or another evaluator uncertainty. UNKNOWN must never become positive reward.

## Production boundary

The namespace implementation is a research isolation layer, not a production sandbox. Production requires container or VM isolation, minimal or read-only rootfs, no host credentials, network denial, CPU and memory limits, seccomp and capability restrictions, artifact digests, and signed provenance.

## Execution status

The ChatGPT execution environment could not resolve github.com, so the CATCH Python probe could not be executed here. No CATCH measurement is claimed. Execute the user-provided probe in a Linux environment with the CATCH repository and its Python dependencies available before publishing measurements.

Do not report attack-success or reward numbers until the probe has actually executed.
