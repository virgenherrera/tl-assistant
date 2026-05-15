import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { AgentCapabilityRegistry } from '#capabilities';

@Injectable()
export class ConfluenceCapabilityRegistrarService implements OnModuleInit {
  constructor(@Inject(AgentCapabilityRegistry) private readonly capabilityRegistry: AgentCapabilityRegistry) {}

  onModuleInit(): void {
    this.capabilityRegistry.register({
      id: 'confluence.read',
      description: 'Leer páginas y buscar contenido de Confluence en modo read-only.',
      status: 'configured-unverified',
    });
  }
}
