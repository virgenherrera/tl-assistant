import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import { toAbsoluteLocalPath } from '#config';

export const JIRA_OUTPUT_DIR = Symbol('JIRA_OUTPUT_DIR') as InjectionToken<string>;

export const jiraOutputDirProvider: FactoryProvider<string> = {
  provide: JIRA_OUTPUT_DIR,
  useFactory: () => toAbsoluteLocalPath('.tl-assistant/jira'),
};
