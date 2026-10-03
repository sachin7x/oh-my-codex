# Why this research harness matters

V-Agent is intentionally being evolved around problems common to agent infrastructure:

- agent/action loops instead of one-shot calls
- execution boundaries rather than model self-report
- evidence and provenance rather than unstructured logs
- proxy verification plus independent audit
- adversarial evaluator-integrity checks
- measurable trajectory efficiency

The project is model-agnostic. Compact local models are a useful experimental target because runtime design becomes measurable rather than hidden behind very large model capability.

## Suggested experiment matrix

| Dimension | Examples |
| --- | --- |
| Model | compact local model / hosted model |
| Verification | proxy only / proxy + audit |
| Verification cadence | 1 / 4 / 8 / terminal |
| Recovery | disabled / enabled |
| Task class | coding / debugging / repository exploration |
| Metrics | success / steps / tokens / latency / failures / exploits |

The goal is to produce reproducible evidence, not marketing claims.
