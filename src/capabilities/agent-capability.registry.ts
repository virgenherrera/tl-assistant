import { Injectable } from '@nestjs/common';

export type AgentCapabilityStatus = 'configured-unverified' | 'available' | 'degraded';

export interface AgentCapability {
  readonly id: string;
  readonly description: string;
  readonly status: AgentCapabilityStatus;
  readonly refs?: readonly string[];
}

@Injectable()
export class AgentCapabilityRegistry {
  private readonly capabilities = new Map<string, AgentCapability>();

  register(capability: AgentCapability): void {
    this.capabilities.set(capability.id, capability);
  }

  markAvailable(id: string, refs?: readonly string[]): void {
    const current = this.capabilities.get(id);
    if (!current) return;

    this.capabilities.set(id, { ...current, status: 'available', ...(refs === undefined ? {} : { refs }) });
  }

  markDegraded(id: string): void {
    const current = this.capabilities.get(id);
    if (!current) return;

    this.capabilities.set(id, { ...current, status: 'degraded' });
  }

  list(): readonly AgentCapability[] {
    return [...this.capabilities.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
