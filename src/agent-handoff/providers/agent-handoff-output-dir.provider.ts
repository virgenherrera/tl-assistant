import { join } from 'node:path';

export const AGENT_HANDOFF_OUTPUT_DIR = Symbol('AGENT_HANDOFF_OUTPUT_DIR');

export const agentHandoffOutputDirProvider = {
  provide: AGENT_HANDOFF_OUTPUT_DIR,
  useFactory: (): string => join(process.cwd(), '.tl-assistant', 'agent-runs'),
};
