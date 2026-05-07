import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import { AppConfigService } from '#config/services/app-config/app-config.service';

export const DOGMA_OUTPUT_DIR = Symbol('DOGMA_OUTPUT_DIR') as InjectionToken<string>;

export const dogmaOutputDirProvider: FactoryProvider<string> = {
  provide: DOGMA_OUTPUT_DIR,
  inject: [AppConfigService],
  useFactory: (appConfig: AppConfigService) => appConfig.value.dogma.outputDir,
};
