import { Inject, Injectable } from '@nestjs/common';
import { JiraConfig, InjectConfig } from '#config';
import { AgentCapabilityRegistry } from '#capabilities';
import type { JiraConnectionSnapshot } from '#jira-context/domain';
import { JiraError, jiraErrorCodes } from '#jira-context/domain';
import { JiraReaderService } from './jira-reader.service';

@Injectable()
export class JiraDoctorService {
  constructor(
    @InjectConfig(JiraConfig) private readonly config: JiraConfig,
    @Inject(JiraReaderService) private readonly reader: JiraReaderService,
    @Inject(AgentCapabilityRegistry) private readonly capabilityRegistry: AgentCapabilityRegistry,
  ) {}

  async handshake(): Promise<JiraConnectionSnapshot> {
    if (!this.config.configured || !this.config.siteUrl || !this.config.apiBaseUrl) {
      throw new JiraError('Jira is not configured.', jiraErrorCodes.notConfigured);
    }

    try {
      const generatedAt = new Date().toISOString();
      const board = await this.reader.getBoard();
      const sprints = await this.reader.getBoardSprints();
      const activeSprint = sprints.find((sprint) => sprint.state.toLowerCase() === 'active');
      const visibleIssues = activeSprint ? await this.reader.getSprintIssues(activeSprint.id) : [];
      const snapshot: JiraConnectionSnapshot = {
        schemaVersion: 'tl-assistant.jira.connection.v1',
        generatedAt,
        siteUrl: this.config.siteUrl,
        apiBaseUrl: this.config.apiBaseUrl,
        board,
        ...(activeSprint === undefined ? {} : { activeSprint }),
        visibleIssueCount: visibleIssues.length,
        capability: 'jira.read',
        status: 'available',
      };
      this.capabilityRegistry.markAvailable('jira.read', [board.ref, ...(activeSprint ? [activeSprint.ref] : [])]);
      return snapshot;
    } catch (error) {
      this.capabilityRegistry.markDegraded('jira.read');
      throw error;
    }
  }
}
