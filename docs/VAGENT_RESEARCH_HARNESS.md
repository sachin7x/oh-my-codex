# V-Agent Research Harness

This document describes the next research layer on top of the verifier-first foundation.

## Architecture

Task -> Agent Model -> Agent Loop -> Tools/Workspace -> Execution -> Evidence Ledger
-> Visible Verification -> Independent Audit -> Exploit Detection -> Metrics.

The agent controls candidate actions and candidate workspace state. Evaluation authority remains outside the model/action loop.

## Research goals

1. Long-horizon execution with explicit step budgets and periodic verification.
2. Evidence-first trajectories suitable for debugging and future RLVR export.
3. Separate proxy verification from audit/exploit findings.
4. Reproducible execution metrics: steps, tool calls, failures, verification events, findings and duration.
5. Model adapters can later target local and server-backed compact models without coupling the harness to one provider.

## Current boundary

The harness is not a production sandbox. Process isolation, immutable hidden references, and server-side provenance remain future requirements.

## Experimental questions

- Does periodic verification reduce wasted trajectories?
- Does compact-model performance improve when the runtime supplies recovery/checkpoints and concise state?
- How often can a proxy verifier declare success when an independent audit disagrees?
- Which exploit detectors identify evaluator manipulation without increasing false positives excessively?
- How does trajectory length relate to success, latency and cost?

## Reporting rules

Do not report benchmark numbers without executing the benchmark.
Record model, provider, task set, configuration, verifier versions and environment alongside results.
