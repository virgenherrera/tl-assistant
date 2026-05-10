export const auditResultStatuses = ['PASS', 'WARN', 'FAIL'] as const;
export type AuditResultStatus = typeof auditResultStatuses[number];

export interface AgentHandoffRequest {
  readonly runId: string;
  readonly repoPath: string;
  readonly task?: string;
  readonly allowedPaths: readonly string[];
  readonly forbiddenPaths?: readonly string[];
  readonly maxFilesChanged?: number;
  readonly maxLinesChanged?: number;
  readonly outputDir?: string;
  readonly strict?: boolean;
}

export interface AgentHandoffBaseline {
  readonly schemaVersion: 'tl-assistant.agent-handoff-baseline.v1';
  readonly generatedAt: string;
  readonly runId: string;
  readonly sourceRepoPath: string;
  readonly runDir: string;
  readonly sandboxPath: string;
  readonly branch: string;
  readonly head: string;
  readonly status: 'clean' | 'dirty';
  readonly allowedPaths: readonly string[];
  readonly forbiddenPaths: readonly string[];
  readonly maxFilesChanged: number;
  readonly maxLinesChanged: number;
  readonly strict: boolean;
  readonly ignoredAuditPaths: readonly string[];
}

export interface AgentHandoffResult {
  readonly runId: string;
  readonly runDir: string;
  readonly sandboxPath: string;
  readonly baselinePath: string;
  readonly outputFiles: readonly string[];
  readonly baseline: AgentHandoffBaseline;
  readonly linkedRefinementFile?: string;
}


export interface AgentAuditRequest {
  readonly runPath: string;
  readonly strict?: boolean;
}

export interface AgentAuditViolation {
  readonly level: 'WARN' | 'FAIL';
  readonly message: string;
  readonly files?: readonly string[];
}

export interface AgentAuditReport {
  readonly schemaVersion: 'tl-assistant.agent-audit-report.v1';
  readonly generatedAt: string;
  readonly runId: string;
  readonly result: AuditResultStatus;
  readonly changedFiles: readonly string[];
  readonly changedFileCount: number;
  readonly addedLines: number;
  readonly deletedLines: number;
  readonly totalChangedLines: number;
  readonly violations: readonly AgentAuditViolation[];
  readonly recommendation: string;
  readonly reportPath: string;
}
