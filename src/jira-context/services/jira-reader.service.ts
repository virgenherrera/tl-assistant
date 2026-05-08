import { Injectable } from '@nestjs/common';
import { JiraConfig, InjectConfig } from '#config';
import { JiraHttpClientService } from '#jira-context/adapters';
import type { JiraBoardBrief, JiraIssueBrief, JiraSprintBrief } from '#jira-context/domain';

@Injectable()
export class JiraReaderService {
  constructor(
    @InjectConfig(JiraConfig) private readonly config: JiraConfig,
    private readonly httpClient: JiraHttpClientService,
  ) {}

  async getBoard(): Promise<JiraBoardBrief> {
    const board = await this.httpClient.get<JiraBoardResponse>(`/rest/agile/1.0/board/${this.config.boardId}`);
    return toBoardBrief(board);
  }

  async getBoardSprints(): Promise<readonly JiraSprintBrief[]> {
    const sprints = await this.httpClient.getPage<JiraSprintResponse>(`/rest/agile/1.0/board/${this.config.boardId}/sprint`, 'values', {
      query: { state: 'active,future,closed' },
    });
    return sprints.map(toSprintBrief);
  }

  async getSprintIssues(sprintId: number): Promise<readonly JiraIssueBrief[]> {
    const issues = await this.httpClient.getPage<JiraIssueResponse>(`/rest/agile/1.0/sprint/${sprintId}/issue`, 'issues', {
      query: { fields: 'summary,status,assignee,issuetype,priority,parent,updated,issuelinks' },
    });
    return issues.map((issue) => toIssueBrief(issue, [sprintId]));
  }
}

interface JiraBoardResponse {
  readonly id: number;
  readonly self?: string;
  readonly name: string;
  readonly type?: string;
}

interface JiraSprintResponse {
  readonly id: number;
  readonly name: string;
  readonly state: string;
  readonly goal?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly completeDate?: string;
}

interface JiraIssueResponse {
  readonly id: string;
  readonly key: string;
  readonly fields?: {
    readonly summary?: string;
    readonly status?: { readonly name?: string };
    readonly assignee?: { readonly displayName?: string } | null;
    readonly issuetype?: { readonly name?: string };
    readonly priority?: { readonly name?: string };
    readonly parent?: { readonly key?: string };
    readonly updated?: string;
    readonly issuelinks?: readonly JiraIssueLinkResponse[];
  };
}

interface JiraIssueLinkResponse {
  readonly type?: { readonly name?: string; readonly inward?: string; readonly outward?: string };
  readonly inwardIssue?: { readonly key?: string };
  readonly outwardIssue?: { readonly key?: string };
}

function toBoardBrief(board: JiraBoardResponse): JiraBoardBrief {
  return {
    id: board.id,
    ref: `jira://board/${board.id}`,
    name: board.name,
    ...(board.type === undefined ? {} : { type: board.type }),
    ...(board.self === undefined ? {} : { self: board.self }),
  };
}

function toSprintBrief(sprint: JiraSprintResponse): JiraSprintBrief {
  return {
    id: sprint.id,
    ref: `jira://sprint/${sprint.id}`,
    name: sprint.name,
    state: sprint.state,
    ...(sprint.goal === undefined ? {} : { goal: sprint.goal }),
    ...(sprint.startDate === undefined ? {} : { startDate: sprint.startDate }),
    ...(sprint.endDate === undefined ? {} : { endDate: sprint.endDate }),
    ...(sprint.completeDate === undefined ? {} : { completeDate: sprint.completeDate }),
  };
}

function toIssueBrief(issue: JiraIssueResponse, sprintIds: readonly number[]): JiraIssueBrief {
  const fields = issue.fields ?? {};
  const issueRef = `jira://issue/${issue.key}`;
  const dependencyRefs = (fields.issuelinks ?? []).flatMap((link) => [link.inwardIssue?.key, link.outwardIssue?.key])
    .filter((key): key is string => key !== undefined)
    .map((key) => `jira://issue/${key}`);

  return {
    id: issue.id,
    key: issue.key,
    ref: issueRef,
    summary: fields.summary ?? '(Sin summary)',
    ...(fields.status?.name === undefined ? {} : { status: fields.status.name }),
    ...(fields.assignee?.displayName === undefined ? {} : { assignee: fields.assignee.displayName }),
    ...(fields.issuetype?.name === undefined ? {} : { issueType: fields.issuetype.name }),
    ...(fields.priority?.name === undefined ? {} : { priority: fields.priority.name }),
    ...(fields.parent?.key === undefined ? {} : { parentKey: fields.parent.key }),
    sprintRefs: sprintIds.map((id) => `jira://sprint/${id}`),
    stale: isStale(fields.updated),
    ...(fields.updated === undefined ? {} : { updated: fields.updated }),
    dependencyRefs,
  };
}

function isStale(updated?: string): boolean {
  if (!updated) return false;
  const updatedAt = new Date(updated).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return Date.now() - updatedAt > 1000 * 60 * 60 * 24 * 5;
}
