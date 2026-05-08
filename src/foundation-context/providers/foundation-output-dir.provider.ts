import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import { AppConfigModule, FoundationOutputConfig } from '#config';

export const FOUNDATION_OUTPUT_DIR = Symbol('FOUNDATION_OUTPUT_DIR') as InjectionToken<string>;

export const foundationOutputDirProvider: FactoryProvider<string> = {
  provide: FOUNDATION_OUTPUT_DIR,
  inject: [AppConfigModule.getToken(FoundationOutputConfig)],
  useFactory: (foundationOutputConfig: FoundationOutputConfig) => foundationOutputConfig.outputDir,
};
