export interface JiraConnectionSnapshot {
  readonly schemaVersion: 'tl-assistant.jira.connection.v1';
  readonly generatedAt: string;
  readonly siteUrl: string;
  readonly apiBaseUrl: string;
  readonly board: JiraBoardBrief;
  readonly activeSprint?: JiraSprintBrief;
  readonly visibleIssueCount: number;
  readonly capability: 'jira.read';
  readonly status: 'available';
}

export interface JiraBoardBrief {
  readonly id: number;
  readonly ref: string;
  readonly name: string;
  readonly type?: string;
  readonly self?: string;
}

export interface JiraSprintBrief {
  readonly id: number;
  readonly ref: string;
  readonly name: string;
  readonly state: string;
  readonly goal?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly completeDate?: string;
}

export interface JiraIssueBrief {
  readonly id: string;
  readonly key: string;
  readonly ref: string;
  readonly summary: string;
  readonly status?: string;
  readonly assignee?: string;
  readonly issueType?: string;
  readonly priority?: string;
  readonly parentKey?: string;
  readonly sprintRefs: readonly string[];
  readonly stale: boolean;
  readonly updated?: string;
  readonly dependencyRefs: readonly string[];
}

export interface JiraDependencyEdge {
  readonly fromRef: string;
  readonly toRef: string;
  readonly type: string;
  readonly direction: 'inward' | 'outward';
}

export interface JiraDependencyMap {
  readonly schemaVersion: 'tl-assistant.jira.dependencies.v1';
  readonly generatedAt: string;
  readonly edges: readonly JiraDependencyEdge[];
}

export interface JiraTlBrief {
  readonly schemaVersion: 'tl-assistant.jira.tl-brief.v1';
  readonly generatedAt: string;
  readonly summary: string;
  readonly risks: readonly JiraTlBriefItem[];
  readonly refs: readonly string[];
}

export interface JiraTlBriefItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceRefs: readonly string[];
}

export interface JiraRefreshResult {
  readonly generatedAt: string;
  readonly connection: JiraConnectionSnapshot;
  readonly board: JiraBoardBrief;
  readonly sprints: readonly JiraSprintBrief[];
  readonly issues: readonly JiraIssueBrief[];
  readonly dependencies: JiraDependencyMap;
  readonly brief: JiraTlBrief;
  readonly outputFiles: readonly string[];
}
