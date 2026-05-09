import { Inject, Injectable } from '@nestjs/common';
import { toAbsoluteLocalPath } from '#config';
import { LocalJiraRefinementRepositoryService } from '#jira-context/adapters';
import type { JiraIssueRefinementDetail, JiraRefinementEvidence, JiraRefinementResult } from '#jira-context/domain';
import { JIRA_REFINEMENT_OUTPUT_DIR } from '#jira-context/providers';
import { JiraReaderService } from './jira-reader.service';

export interface JiraRefinementRequest {
  readonly issueKey: string;
  readonly sourcePaths?: readonly string[];
  readonly outputDir?: string;
}

@Injectable()
export class JiraRefinementService {
  constructor(
    @Inject(JiraReaderService) private readonly reader: JiraReaderService,
    @Inject(LocalJiraRefinementRepositoryService) private readonly repository: LocalJiraRefinementRepositoryService,
    @Inject(JIRA_REFINEMENT_OUTPUT_DIR) private readonly defaultOutputDir: string,
  ) {}

  async refine(request: JiraRefinementRequest): Promise<JiraRefinementResult> {
    const generatedAt = new Date().toISOString();
    const issueKey = normalizeIssueKey(request.issueKey);
    const issue = await this.reader.getIssueRefinementDetail(issueKey);
    const linkedIssues = await this.getLinkedIssueDetails(issue);
    const evidence: JiraRefinementEvidence = {
      schemaVersion: 'tl-assistant.jira.refinement-evidence.v1',
      generatedAt,
      issue,
      linkedIssues,
      sources: [],
    };

    return this.repository.save({
      issueKey,
      generatedAt,
      outputRootDir: request.outputDir ?? this.defaultOutputDir,
      evidence,
      sourcePaths: (request.sourcePaths ?? []).map(toAbsoluteLocalPath),
    });
  }

  private async getLinkedIssueDetails(issue: JiraIssueRefinementDetail): Promise<readonly JiraIssueRefinementDetail[]> {
    const linkedKeys = [...new Set(issue.linkedIssues.map((linkedIssue) => linkedIssue.key))]
      .filter((key) => key !== issue.key && key !== 'UNKNOWN');
    const details: JiraIssueRefinementDetail[] = [];

    for (const linkedKey of linkedKeys) {
      details.push(await this.reader.getIssueRefinementDetail(linkedKey));
    }

    return details;
  }
}

function normalizeIssueKey(issueKey: string): string {
  return issueKey.trim().toUpperCase();
}
