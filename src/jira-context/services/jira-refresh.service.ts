import { Inject, Injectable } from '@nestjs/common';
import { AgentCapabilityRegistry } from '#capabilities';
import type { JiraRefreshResult } from '#jira-context/domain';
import { LocalJiraContextRepositoryService } from '#jira-context/adapters';
import { JIRA_OUTPUT_DIR } from '#jira-context/providers';
import { JiraBriefService } from './jira-brief.service';
import { JiraDependencyMapperService } from './jira-dependency-mapper.service';
import { JiraDoctorService } from './jira-doctor.service';
import { JiraReaderService } from './jira-reader.service';

@Injectable()
export class JiraRefreshService {
  constructor(
    private readonly doctor: JiraDoctorService,
    private readonly reader: JiraReaderService,
    private readonly dependencyMapper: JiraDependencyMapperService,
    private readonly brief: JiraBriefService,
    private readonly repository: LocalJiraContextRepositoryService,
    private readonly capabilityRegistry: AgentCapabilityRegistry,
    @Inject(JIRA_OUTPUT_DIR) private readonly defaultOutputDir: string,
  ) {}

  async refresh(outputDir = this.defaultOutputDir): Promise<JiraRefreshResult> {
    const connection = await this.doctor.handshake();
    const generatedAt = new Date().toISOString();
    const sprints = await this.reader.getBoardSprints();
    const activeSprint = sprints.find((sprint) => sprint.state.toLowerCase() === 'active');
    const issues = activeSprint ? await this.reader.getSprintIssues(activeSprint.id) : [];
    const dependencies = this.dependencyMapper.map(issues, generatedAt);
    const brief = this.brief.create({
      generatedAt,
      board: connection.board,
      ...(activeSprint === undefined ? {} : { activeSprint }),
      issues,
      dependencies,
    });

    const pendingResult: JiraRefreshResult = {
      generatedAt,
      connection,
      board: connection.board,
      sprints,
      issues,
      dependencies,
      brief,
      outputFiles: [],
    };
    const outputFiles = await this.repository.saveRefreshResult(pendingResult, outputDir);
    this.capabilityRegistry.markAvailable('jira.read', ['tl-brief.md', 'AGENT_JIRA_CONTEXT.md']);

    return { ...pendingResult, outputFiles };
  }
}
