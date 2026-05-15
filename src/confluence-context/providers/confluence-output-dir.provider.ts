import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import { join } from 'node:path';

export const CONFLUENCE_OUTPUT_DIR = Symbol('CONFLUENCE_OUTPUT_DIR') as InjectionToken<string>;

export const confluenceOutputDirProvider: FactoryProvider<string> = {
  provide: CONFLUENCE_OUTPUT_DIR,
  useFactory: () => join(process.cwd(), '.tl-assistant', 'confluence'),
};
