import { Global, Module } from '@nestjs/common';
import { AgentCapabilityRegistry } from './agent-capability.registry';

@Global()
@Module({
  providers: [AgentCapabilityRegistry],
  exports: [AgentCapabilityRegistry],
})
export class CapabilityModule {}
