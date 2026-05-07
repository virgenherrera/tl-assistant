import { Inject, type Type } from '@nestjs/common';
import { getConfigToken } from '@nestjs/config';

export function InjectConfig<T extends Type<unknown>>(configClass: T): ParameterDecorator {
  return Inject(getConfigToken(configClass.name));
}
