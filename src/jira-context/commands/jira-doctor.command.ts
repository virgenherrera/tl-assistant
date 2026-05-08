import { Command, CommandRunner } from 'nest-commander';
import { JiraDoctorService } from '#jira-context/services';

@Command({
  name: 'jira:doctor',
  description: 'Valida conexión read-only contra Jira y visibilidad del board configurado.',
})
export class JiraDoctorCommand extends CommandRunner {
  constructor(private readonly doctor: JiraDoctorService) {
    super();
  }

  async run(): Promise<void> {
    const snapshot = await this.doctor.handshake();
    console.log(JSON.stringify({
      status: snapshot.status,
      siteUrl: snapshot.siteUrl,
      apiBaseUrl: snapshot.apiBaseUrl,
      board: snapshot.board,
      activeSprint: snapshot.activeSprint,
      visibleIssueCount: snapshot.visibleIssueCount,
      capability: snapshot.capability,
    }, null, 2));
  }
}
