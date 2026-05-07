import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import { AppConfigModule, DogmaOutputConfig } from '#config';

export const DOGMA_OUTPUT_DIR = Symbol('DOGMA_OUTPUT_DIR') as InjectionToken<string>;

export const dogmaOutputDirProvider: FactoryProvider<string> = {
  provide: DOGMA_OUTPUT_DIR,
  inject: [AppConfigModule.getToken(DogmaOutputConfig)],
  useFactory: (dogmaOutputConfig: DogmaOutputConfig) => dogmaOutputConfig.outputDir,
};
