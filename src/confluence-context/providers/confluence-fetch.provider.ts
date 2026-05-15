import type { FactoryProvider, InjectionToken } from '@nestjs/common';

export type ConfluenceFetch = typeof fetch;

export const CONFLUENCE_FETCH = Symbol('CONFLUENCE_FETCH') as InjectionToken<ConfluenceFetch>;

export const confluenceFetchProvider: FactoryProvider<ConfluenceFetch> = {
  provide: CONFLUENCE_FETCH,
  useFactory: () => fetch,
};
