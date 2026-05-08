import { Module } from '@nestjs/common';
import { TlBootstrapCommand } from './commands';
import { tlBootstrapOutputDirProvider } from './providers';
import { TlBootstrapService } from './services';

@Module({
  providers: [tlBootstrapOutputDirProvider, TlBootstrapCommand, TlBootstrapService],
})
export class TlBootstrapModule {}
