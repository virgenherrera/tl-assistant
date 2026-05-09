import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import { toAbsoluteLocalPath } from '#config';

export const JIRA_REFINEMENT_OUTPUT_DIR = Symbol('JIRA_REFINEMENT_OUTPUT_DIR') as InjectionToken<string>;

export const jiraRefinementOutputDirProvider: FactoryProvider<string> = {
  provide: JIRA_REFINEMENT_OUTPUT_DIR,
  useFactory: () => toAbsoluteLocalPath('.tl-assistant/refinement'),
};
