import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import { toAbsoluteLocalPath } from '#config';

export const TL_BOOTSTRAP_OUTPUT_DIR = Symbol('TL_BOOTSTRAP_OUTPUT_DIR') as InjectionToken<string>;

export const tlBootstrapOutputDirProvider: FactoryProvider<string> = {
  provide: TL_BOOTSTRAP_OUTPUT_DIR,
  useFactory: () => toAbsoluteLocalPath('.tl-assistant/agent'),
};
