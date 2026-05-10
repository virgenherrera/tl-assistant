import { Inject, Injectable } from '@nestjs/common';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { toAbsoluteLocalPath } from '#config';
import { AGENT_HANDOFF_OUTPUT_DIR } from '#agent-handoff/providers';
import type {
  AgentAuditReport,
  AgentAuditRequest,
  AgentAuditViolation,
  AgentHandoffBaseline,
  AgentHandoffRequest,
  AgentHandoffResult,
  AuditResultStatus,
} from '#agent-handoff/domain';

const execFileAsync = promisify(execFile);
const defaultForbiddenPaths = ['.env', '.env.*', 'node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];
const ignoredAuditPaths = ['.agent-handoff/**', 'AGENT_OUTPUT.md'];

@Injectable()
export class AgentHandoffService {
  constructor(@Inject(AGENT_HANDOFF_OUTPUT_DIR) private readonly defaultOutputDir: string) {}

  async createHandoff(request: AgentHandoffRequest): Promise<AgentHandoffResult> {
    const generatedAt = new Date().toISOString();
    const runId = normalizeRunId(request.runId);
    const sourceRepoPath = toAbsoluteLocalPath(request.repoPath);
    await assertGitRepo(sourceRepoPath);
    if (request.allowedPaths.length === 0) throw new TypeError('agent:handoff requires at least one --allow path. Open-ended workspaces are not allowed.');

    const outputRoot = request.outputDir === undefined ? this.defaultOutputDir : toAbsoluteLocalPath(request.outputDir);
    const runDir = join(outputRoot, runId);
    const sandboxPath = join(runDir, 'sandbox');
    await mkdir(runDir, { recursive: true });
    await git(['clone', '--local', '--no-hardlinks', sourceRepoPath, sandboxPath], process.cwd());

    const branch = await gitText(['branch', '--show-current'], sandboxPath);
    const head = await gitText(['rev-parse', 'HEAD'], sandboxPath);
    const statusBeforeHandoff = await gitText(['status', '--porcelain'], sandboxPath);
    const status = statusBeforeHandoff.trim() === '' ? 'clean' : 'dirty';
    const strict = request.strict ?? true;
    if (strict && status === 'dirty') throw new TypeError(`Sandbox started dirty and strict mode is enabled: ${sandboxPath}`);

    const baseline: AgentHandoffBaseline = {
      schemaVersion: 'tl-assistant.agent-handoff-baseline.v1',
      generatedAt,
      runId,
      sourceRepoPath,
      runDir,
      sandboxPath,
      branch: branch || '(detached)',
      head,
      status,
      allowedPaths: request.allowedPaths.map(normalizeRepoPath),
      forbiddenPaths: [...new Set([...defaultForbiddenPaths, ...(request.forbiddenPaths ?? [])].map(normalizeRepoPath))],
      maxFilesChanged: request.maxFilesChanged ?? 8,
      maxLinesChanged: request.maxLinesChanged ?? 400,
      strict,
      ignoredAuditPaths,
    };

    const handoffDir = join(sandboxPath, '.agent-handoff');
    await mkdir(handoffDir, { recursive: true });
    const files = new Map<string, string>([
      ['TASK.md', renderTask(baseline, request.task)],
      ['CONTEXT.md', renderContext(baseline)],
      ['ALLOWED_PATHS.md', renderPathList('Allowed paths', baseline.allowedPaths)],
      ['FORBIDDEN_ACTIONS.md', renderPathList('Forbidden paths/actions', baseline.forbiddenPaths, forbiddenActions())],
      ['ACCEPTANCE_CHECKLIST.md', renderAcceptanceChecklist()],
      ['EXPECTED_OUTPUT.md', renderExpectedOutput()],
      ['AUDIT_BASELINE.json', `${JSON.stringify(baseline, null, 2)}\n`],
    ]);

    const outputFiles: string[] = [];
    for (const [fileName, content] of files) {
      const sandboxFile = join(handoffDir, fileName);
      const runFile = join(runDir, fileName);
      await writeFile(sandboxFile, content, 'utf8');
      await writeFile(runFile, content, 'utf8');
      outputFiles.push(sandboxFile, runFile);
    }

    const linkedRefinementFile = await maybeWriteRefinementLink(baseline);
    if (linkedRefinementFile !== undefined) outputFiles.push(linkedRefinementFile);

    return {
      runId,
      runDir,
      sandboxPath,
      baselinePath: join(runDir, 'AUDIT_BASELINE.json'),
      outputFiles,
      baseline,
      ...(linkedRefinementFile === undefined ? {} : { linkedRefinementFile }),
    };
  }

  async audit(request: AgentAuditRequest): Promise<AgentAuditReport> {
    const generatedAt = new Date().toISOString();
    const { baseline, baselinePath } = await readBaseline(request.runPath);
    await assertGitRepo(baseline.sandboxPath);
    const strict = request.strict ?? baseline.strict;
    const statusEntries = parsePorcelain(await gitRaw(['status', '--porcelain'], baseline.sandboxPath))
      .filter((file) => !matchesAny(file, baseline.ignoredAuditPaths));
    const changedFiles = [...new Set(statusEntries)].sort();
    const numstat = await collectNumstat(baseline.sandboxPath, changedFiles);
    const addedLines = numstat.reduce((total, item) => total + item.added, 0);
    const deletedLines = numstat.reduce((total, item) => total + item.deleted, 0);
    const totalChangedLines = addedLines + deletedLines;
    const violations: AgentAuditViolation[] = [];

    const outsideAllowed = changedFiles.filter((file) => !matchesAny(file, baseline.allowedPaths));
    if (outsideAllowed.length > 0) violations.push({ level: 'FAIL', message: 'Changed files outside allowed paths.', files: outsideAllowed });

    const forbidden = changedFiles.filter((file) => matchesAny(file, baseline.forbiddenPaths));
    if (forbidden.length > 0) violations.push({ level: 'FAIL', message: 'Changed forbidden files.', files: forbidden });

    if (changedFiles.length > baseline.maxFilesChanged) violations.push({ level: strict ? 'FAIL' : 'WARN', message: `Changed ${changedFiles.length} files; max allowed is ${baseline.maxFilesChanged}.` });
    if (totalChangedLines > baseline.maxLinesChanged) violations.push({ level: strict ? 'FAIL' : 'WARN', message: `Changed ${totalChangedLines} lines; max allowed is ${baseline.maxLinesChanged}.` });

    const diffCheck = await gitCheck(['diff', '--check'], baseline.sandboxPath);
    if (!diffCheck.ok) violations.push({ level: 'FAIL', message: 'git diff --check reported whitespace or conflict-marker issues.' });

    const hasAgentOutput = await fileExists(join(baseline.sandboxPath, 'AGENT_OUTPUT.md')) || await fileExists(join(baseline.sandboxPath, '.agent-handoff', 'AGENT_OUTPUT.md'));
    if (!hasAgentOutput) violations.push({ level: strict ? 'FAIL' : 'WARN', message: 'Missing required AGENT_OUTPUT.md summary.' });

    const result = resolveStatus(violations);
    const reportPath = join(baseline.runDir, 'AUDIT_REPORT.md');
    const report: AgentAuditReport = {
      schemaVersion: 'tl-assistant.agent-audit-report.v1',
      generatedAt,
      runId: baseline.runId,
      result,
      changedFiles,
      changedFileCount: changedFiles.length,
      addedLines,
      deletedLines,
      totalChangedLines,
      violations,
      recommendation: recommendationFor(result),
      reportPath,
    };
    await writeFile(reportPath, renderAuditReport(report, baseline, baselinePath), 'utf8');
    return report;
  }
}


async function maybeWriteRefinementLink(baseline: AgentHandoffBaseline): Promise<string | undefined> {
  const refinementDir = join(process.cwd(), '.tl-assistant', 'refinement', baseline.runId);
  const exists = await stat(refinementDir).then((value) => value.isDirectory()).catch(() => false);
  if (!exists) return undefined;

  const linkPath = join(refinementDir, 'agent-handoff.md');
  await writeFile(linkPath, renderRefinementLink(baseline), 'utf8');
  return linkPath;
}

function renderRefinementLink(baseline: AgentHandoffBaseline): string {
  return [
    `# Agent handoff — ${baseline.runId}`,
    '',
    '## Sandbox',
    '',
    `- Run dir: ${baseline.runDir}`,
    `- Sandbox: ${baseline.sandboxPath}`,
    `- Baseline: ${join(baseline.runDir, 'AUDIT_BASELINE.json')}`,
    `- Expected audit report: ${join(baseline.runDir, 'AUDIT_REPORT.md')}`,
    '',
    '## Guardrails',
    '',
    `- Allowed paths: ${baseline.allowedPaths.join(', ')}`,
    `- Forbidden paths: ${baseline.forbiddenPaths.join(', ')}`,
    `- Max files changed: ${baseline.maxFilesChanged}`,
    `- Max lines changed: ${baseline.maxLinesChanged}`,
    '',
    'Run `agent:audit` before using any agent output.',
  ].join('\n').trimEnd() + '\n';
}

async function assertGitRepo(path: string): Promise<void> {
  const stats = await stat(path).catch(() => undefined);
  if (!stats?.isDirectory()) throw new TypeError(`Repo path must be an existing directory: ${path}`);
  const result = await gitCheck(['rev-parse', '--is-inside-work-tree'], path);
  if (!result.ok || result.stdout.trim() !== 'true') throw new TypeError(`Path is not a git repo: ${path}`);
}

async function git(args: readonly string[], cwd: string): Promise<void> {
  await execFileAsync('git', [...args], { cwd });
}

async function gitText(args: readonly string[], cwd: string): Promise<string> {
  return (await gitRaw(args, cwd)).trim();
}

async function gitRaw(args: readonly string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', [...args], { cwd });
  return stdout;
}

async function gitCheck(args: readonly string[], cwd: string): Promise<{ readonly ok: boolean; readonly stdout: string; readonly stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', [...args], { cwd });
    return { ok: true, stdout, stderr };
  } catch (error) {
    const maybe = error as { stdout?: string; stderr?: string };
    return { ok: false, stdout: maybe.stdout ?? '', stderr: maybe.stderr ?? '' };
  }
}

async function readBaseline(runPath: string): Promise<{ readonly baseline: AgentHandoffBaseline; readonly baselinePath: string }> {
  const absolute = resolve(runPath);
  const candidates = [
    join(absolute, 'AUDIT_BASELINE.json'),
    join(absolute, '.agent-handoff', 'AUDIT_BASELINE.json'),
    absolute.endsWith('AUDIT_BASELINE.json') ? absolute : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return { baseline: JSON.parse(await readFile(candidate, 'utf8')) as AgentHandoffBaseline, baselinePath: candidate };
    }
  }

  throw new TypeError(`AUDIT_BASELINE.json not found from path: ${runPath}`);
}

async function fileExists(path: string): Promise<boolean> {
  return (await stat(path).then(() => true).catch(() => false));
}

function parsePorcelain(output: string): string[] {
  return output.split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => normalizeRepoPath(line.slice(3).split(' -> ').at(-1) ?? line.slice(3)));
}

async function collectNumstat(repoPath: string, changedFiles: readonly string[]): Promise<readonly { readonly file: string; readonly added: number; readonly deleted: number }[]> {
  const tracked = await gitText(['diff', '--numstat', 'HEAD', '--'], repoPath).catch(() => '');
  const entries = new Map<string, { file: string; added: number; deleted: number }>();
  for (const line of tracked.split('\n').filter(Boolean)) {
    const [added, deleted, file] = line.split('\t');
    if (file) entries.set(normalizeRepoPath(file), { file: normalizeRepoPath(file), added: parseNumstat(added), deleted: parseNumstat(deleted) });
  }

  for (const file of changedFiles) {
    if (entries.has(file)) continue;
    const fullPath = join(repoPath, file);
    const text = await readFile(fullPath, 'utf8').catch(() => undefined);
    if (text !== undefined) entries.set(file, { file, added: text.split('\n').length, deleted: 0 });
  }

  return [...entries.values()];
}

function parseNumstat(value?: string): number {
  if (!value || value === '-') return 0;
  return Number.parseInt(value, 10) || 0;
}

function resolveStatus(violations: readonly AgentAuditViolation[]): AuditResultStatus {
  if (violations.some((violation) => violation.level === 'FAIL')) return 'FAIL';
  if (violations.some((violation) => violation.level === 'WARN')) return 'WARN';
  return 'PASS';
}

function recommendationFor(status: AuditResultStatus): string {
  if (status === 'PASS') return 'Acceptable for human review. Inspect the diff before copying or merging anything.';
  if (status === 'WARN') return 'Review warnings manually before accepting agent output.';
  return 'Reject or repair agent output before using it.';
}

function normalizeRunId(input: string): string {
  const runId = input.trim().replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-');
  if (!runId) throw new TypeError('Run id is required.');
  return runId;
}

function normalizeRepoPath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '').trim();
}

function matchesAny(file: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPattern(file, pattern));
}

function matchesPattern(file: string, pattern: string): boolean {
  const normalizedFile = normalizeRepoPath(file);
  const normalizedPattern = normalizeRepoPath(pattern);
  if (normalizedPattern.endsWith('/**')) return normalizedFile === normalizedPattern.slice(0, -3) || normalizedFile.startsWith(normalizedPattern.slice(0, -2));
  if (!normalizedPattern.includes('*')) return normalizedFile === normalizedPattern;
  const regex = new RegExp(`^${escapeRegex(normalizedPattern).replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*')}$`);
  return regex.test(normalizedFile);
}

function escapeRegex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function renderTask(baseline: AgentHandoffBaseline, task?: string): string {
  return [
    `# Agent task — ${baseline.runId}`,
    '',
    'Trabajá file-first dentro de este sandbox. No inventes contexto externo.',
    '',
    '## Task',
    '',
    task?.trim() || 'Complete the requested change using only the local context and allowed paths. If context is missing, stop and ask the user.',
    '',
    '## First read order',
    '',
    '1. `.agent-handoff/CONTEXT.md`',
    '2. `.agent-handoff/ALLOWED_PATHS.md`',
    '3. `.agent-handoff/FORBIDDEN_ACTIONS.md`',
    '4. `.agent-handoff/ACCEPTANCE_CHECKLIST.md`',
    '5. `.agent-handoff/EXPECTED_OUTPUT.md`',
  ].join('\n').trimEnd() + '\n';
}

function renderContext(baseline: AgentHandoffBaseline): string {
  return [
    '# Handoff context',
    '',
    `- Run id: ${baseline.runId}`,
    `- Source repo basename: ${basename(baseline.sourceRepoPath)}`,
    `- Sandbox path: ${baseline.sandboxPath}`,
    `- Branch: ${baseline.branch}`,
    `- Baseline HEAD: ${baseline.head}`,
    `- Baseline status: ${baseline.status}`,
    '',
    'This is a disposable sandbox. Do not assume Jira, browser, MCP, terminal, or external tools are available.',
  ].join('\n').trimEnd() + '\n';
}

function renderPathList(title: string, paths: readonly string[], extra: readonly string[] = []): string {
  return [`# ${title}`, '', ...paths.map((path) => `- \`${path}\``), ...extra.map((item) => `- ${item}`)].join('\n').trimEnd() + '\n';
}

function forbiddenActions(): readonly string[] {
  return [
    'Do not modify dependency manifests or lockfiles unless explicitly allowed.',
    'Do not edit secrets or environment files.',
    'Do not run or request build commands.',
    'Do not mass-format unrelated files.',
    'Do not push, commit, tag, or change remotes.',
  ];
}

function renderAcceptanceChecklist(): string {
  return [
    '# Acceptance checklist',
    '',
    '- [ ] Changes stay inside allowed paths.',
    '- [ ] No forbidden files were edited.',
    '- [ ] Diff size stays within budget.',
    '- [ ] No build was run or required.',
    '- [ ] `AGENT_OUTPUT.md` explains what changed, why, risks, and suggested checks.',
  ].join('\n') + '\n';
}

function renderExpectedOutput(): string {
  return [
    '# Expected output',
    '',
    'Create `AGENT_OUTPUT.md` at the sandbox root with:',
    '',
    '```md',
    '# Agent output',
    '',
    '## What changed',
    '',
    '## Files changed',
    '',
    '## Why',
    '',
    '## Evidence used',
    '',
    '## Risks',
    '',
    '## Tests/checks suggested',
    '',
    '## Questions for human reviewer',
    '```',
  ].join('\n').trimEnd() + '\n';
}

function renderAuditReport(report: AgentAuditReport, baseline: AgentHandoffBaseline, baselinePath: string): string {
  const violations = report.violations.length === 0
    ? ['- None']
    : report.violations.flatMap((violation) => [
      `- **${violation.level}**: ${violation.message}`,
      ...(violation.files ?? []).map((file) => `  - ${file}`),
    ]);

  return [
    `# Agent Audit Report — ${report.runId}`,
    '',
    `## Result: ${report.result}`,
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Baseline: ${baselinePath}`,
    `- Sandbox: ${baseline.sandboxPath}`,
    `- Branch: ${baseline.branch}`,
    `- Baseline HEAD: ${baseline.head}`,
    '',
    '## Measurements',
    '',
    `- Changed files: ${report.changedFileCount} / ${baseline.maxFilesChanged}`,
    `- Added lines: ${report.addedLines}`,
    `- Deleted lines: ${report.deletedLines}`,
    `- Total changed lines: ${report.totalChangedLines} / ${baseline.maxLinesChanged}`,
    '',
    '## Changed files',
    '',
    ...(report.changedFiles.length === 0 ? ['- None'] : report.changedFiles.map((file) => `- ${file}`)),
    '',
    '## Violations',
    '',
    ...violations,
    '',
    '## Recommendation',
    '',
    report.recommendation,
  ].join('\n').trimEnd() + '\n';
}
