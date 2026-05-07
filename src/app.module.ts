import { Module } from '@nestjs/common';
import { ConfigModule } from '#config/config.module';
import { DogmaContextModule } from '#dogma-context';

@Module({
  imports: [ConfigModule, DogmaContextModule],
})
export class AppModule {}
