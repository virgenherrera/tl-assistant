import { Injectable, type OnModuleInit } from '@nestjs/common';
import { AgentCapabilityRegistry } from '#capabilities';

@Injectable()
export class JiraCapabilityRegistrarService implements OnModuleInit {
  constructor(private readonly capabilityRegistry: AgentCapabilityRegistry) {}

  onModuleInit(): void {
    this.capabilityRegistry.register({
      id: 'jira.read',
      description: 'Leer board, sprints, issues y dependencias de Jira en modo TL read-only.',
      status: 'configured-unverified',
    });
  }
}
