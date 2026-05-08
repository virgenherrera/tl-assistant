import type { FactoryProvider, InjectionToken } from '@nestjs/common';

export type JiraFetch = typeof fetch;

export const JIRA_FETCH = Symbol('JIRA_FETCH') as InjectionToken<JiraFetch>;

export const jiraFetchProvider: FactoryProvider<JiraFetch> = {
  provide: JIRA_FETCH,
  useFactory: () => fetch,
};
