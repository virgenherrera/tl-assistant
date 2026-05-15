import { Inject } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { ConfluenceReaderService } from '#confluence-context/services';

@Command({
  name: 'confluence:doctor',
  description: 'Valida conexión read-only contra Confluence.',
})
export class ConfluenceDoctorCommand extends CommandRunner {
  constructor(@Inject(ConfluenceReaderService) private readonly reader: ConfluenceReaderService) {
    super();
  }

  async run(): Promise<void> {
    const snapshot = await this.reader.handshake();
    console.log(JSON.stringify(snapshot, null, 2));
  }
}
