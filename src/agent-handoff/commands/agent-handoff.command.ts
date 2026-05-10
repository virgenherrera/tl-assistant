import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { toAbsoluteLocalPath } from '#config';
import { AgentHandoffService } from '#agent-handoff/services';

interface AgentHandoffOptions {
  readonly repo?: string;
  readonly allow?: readonly string[];
  readonly forbid?: readonly string[];
  readonly maxFiles?: number;
  readonly maxLines?: number;
  readonly task?: string;
  readonly outputDir?: string;
  readonly nonStrict?: boolean;
}

@Command({
  name: 'agent:handoff',
  arguments: '<runId>',
  description: 'Prepara un sandbox local con prompts file-first y baseline auditable para agentes externos.',
})
export class AgentHandoffCommand extends CommandRunner {
  constructor(@Inject(AgentHandoffService) private readonly handoff: AgentHandoffService) {
    super();
  }

  async run(passedParams: string[], options: AgentHandoffOptions): Promise<void> {
    const runId = requireRunId(passedParams);
    const repo = options.repo ?? extractScalar(passedParams, '--repo', '-r');
    if (!repo) throw new TypeError('agent:handoff requires --repo <path>.');
    const maxFiles = options.maxFiles ?? parseOptionalPositiveInteger(extractScalar(passedParams, '--max-files'), '--max-files');
    const maxLines = options.maxLines ?? parseOptionalPositiveInteger(extractScalar(passedParams, '--max-lines'), '--max-lines');
    const task = options.task ?? extractScalar(passedParams, '--task', '-t');
    const outputDir = options.outputDir ?? extractScalar(passedParams, '--output-dir', '-o');
    const nonStrict = options.nonStrict === true || passedParams.includes('--non-strict');
    const result = await this.handoff.createHandoff({
      runId,
      repoPath: toAbsoluteLocalPath(repo),
      allowedPaths: extractRepeated(passedParams, options.allow ?? [], '--allow', '-a'),
      forbiddenPaths: extractRepeated(passedParams, options.forbid ?? [], '--forbid', '-f'),
      ...(maxFiles === undefined ? {} : { maxFilesChanged: maxFiles }),
      ...(maxLines === undefined ? {} : { maxLinesChanged: maxLines }),
      ...(task === undefined ? {} : { task }),
      ...(outputDir === undefined ? {} : { outputDir: toAbsoluteLocalPath(outputDir) }),
      strict: !nonStrict,
    });

    console.log(JSON.stringify({
      runId: result.runId,
      runDir: result.runDir,
      sandboxPath: result.sandboxPath,
      baselinePath: result.baselinePath,
      branch: result.baseline.branch,
      head: result.baseline.head,
      allowedPaths: result.baseline.allowedPaths,
      forbiddenPaths: result.baseline.forbiddenPaths,
      maxFilesChanged: result.baseline.maxFilesChanged,
      maxLinesChanged: result.baseline.maxLinesChanged,
      linkedRefinementFile: result.linkedRefinementFile,
      outputFiles: result.outputFiles,
    }, null, 2));
  }

  @Option({ flags: '-r, --repo <path>', description: 'Repo local fuente para clonar a un sandbox descartable.' })
  parseRepo(value: string): string { return value; }

  @Option({ flags: '-a, --allow <path>', description: 'Path/glob repo-relative permitido para cambios; puede repetirse.' })
  parseAllow(value: string, previous: string[] = []): string[] { return [...previous, value]; }

  @Option({ flags: '-f, --forbid <path>', description: 'Path/glob repo-relative prohibido adicional; puede repetirse.' })
  parseForbid(value: string, previous: string[] = []): string[] { return [...previous, value]; }

  @Option({ flags: '--max-files <count>', description: 'Máximo de archivos modificados permitido. Default: 8.' })
  parseMaxFiles(value: string): number { return parsePositiveInteger(value, '--max-files'); }

  @Option({ flags: '--max-lines <count>', description: 'Máximo de líneas cambiadas permitido. Default: 400.' })
  parseMaxLines(value: string): number { return parsePositiveInteger(value, '--max-lines'); }

  @Option({ flags: '-t, --task <text>', description: 'Descripción corta de la tarea para el agente.' })
  parseTask(value: string): string { return value; }

  @Option({ flags: '-o, --output-dir <path>', description: 'Directorio raíz para agent runs. Default: .tl-assistant/agent-runs.' })
  parseOutputDir(value: string): string { return value; }

  @Option({ flags: '--non-strict', description: 'Convierte algunas fallas de presupuesto/output en warnings.' })
  parseNonStrict(): boolean { return true; }
}

function requireRunId(passedParams: readonly string[]): string {
  const runId = passedParams.find((param) => !param.startsWith('-'))?.trim();
  if (!runId) throw new TypeError('agent:handoff requires a run id. Example: agent:handoff OTPSMT-1422 --repo ../repo --allow "src/**"');
  return runId;
}

function extractScalar(passedParams: readonly string[], longFlag: string, shortFlag?: string): string | undefined {
  for (let index = 0; index < passedParams.length; index += 1) {
    const param = passedParams[index];
    if (param === longFlag || (shortFlag !== undefined && param === shortFlag)) return passedParams[index + 1];
    if (param?.startsWith(`${longFlag}=`)) return param.slice(longFlag.length + 1);
  }
  return undefined;
}

function extractRepeated(passedParams: readonly string[], optionValues: readonly string[], longFlag: string, shortFlag: string): readonly string[] {
  const values = [...optionValues];
  for (let index = 0; index < passedParams.length; index += 1) {
    const param = passedParams[index];
    if (param === longFlag || param === shortFlag) {
      const next = passedParams[index + 1];
      if (next !== undefined) values.push(next);
      index += 1;
      continue;
    }
    if (param?.startsWith(`${longFlag}=`)) values.push(param.slice(longFlag.length + 1));
  }
  return [...new Set(values)];
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new TypeError(`${flag} must be a positive integer.`);
  return parsed;
}

function parseOptionalPositiveInteger(value: string | undefined, flag: string): number | undefined {
  return value === undefined ? undefined : parsePositiveInteger(value, flag);
}
