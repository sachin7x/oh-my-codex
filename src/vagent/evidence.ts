import { createHash, randomUUID } from 'node:crypto';
import type { EvidenceEvent } from './types.js';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class EvidenceLedger {
  private readonly events: EvidenceEvent[] = [];

  record(event: Omit<EvidenceEvent, 'id' | 'timestamp' | 'step'>): EvidenceEvent {
    const next: EvidenceEvent = {
      ...event,
      id: randomUUID(),
      step: this.events.length + 1,
      timestamp: new Date().toISOString(),
    };
    this.events.push(next);
    return next;
  }

  all(): EvidenceEvent[] {
    return [...this.events];
  }

  hash(): string {
    return sha256(JSON.stringify(this.events));
  }
}
