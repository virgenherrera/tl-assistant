import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JiraRefreshResult, JiraTlBrief } from '#jira-context/domain';

@Injectable()
export class LocalJiraContextRepositoryService {
  async saveRefreshResult(result: JiraRefreshResult, outputDir: string): Promise<readonly string[]> {
    await mkdir(outputDir, { recursive: true });

    const outputFiles = [
      join(outputDir, 'connection-snapshot.json'),
      join(outputDir, 'board-map.json'),
      join(outputDir, 'sprint-map.json'),
      join(outputDir, 'issues-map.json'),
      join(outputDir, 'dependency-map.json'),
      join(outputDir, 'tl-brief.json'),
      join(outputDir, 'tl-brief.md'),
      join(outputDir, 'AGENT_JIRA_CONTEXT.md'),
    ] as const;

    const persisted = { ...result, outputFiles };
    await writeFile(outputFiles[0], `${JSON.stringify(persisted.connection, null, 2)}\n`, 'utf8');
    await writeFile(outputFiles[1], `${JSON.stringify(persisted.board, null, 2)}\n`, 'utf8');
    await writeFile(outputFiles[2], `${JSON.stringify(persisted.sprints, null, 2)}\n`, 'utf8');
    await writeFile(outputFiles[3], `${JSON.stringify(persisted.issues, null, 2)}\n`, 'utf8');
    await writeFile(outputFiles[4], `${JSON.stringify(persisted.dependencies, null, 2)}\n`, 'utf8');
    await writeFile(outputFiles[5], `${JSON.stringify(persisted.brief, null, 2)}\n`, 'utf8');
    await writeFile(outputFiles[6], renderTlBriefMarkdown(persisted.brief), 'utf8');
    await writeFile(outputFiles[7], renderAgentJiraContextMarkdown(), 'utf8');

    return outputFiles;
  }
}

function renderTlBriefMarkdown(brief: JiraTlBrief): string {
  const risks = brief.risks.map((risk) => [
    `## ${risk.title}`,
    '',
    risk.summary,
    '',
    `Refs: ${risk.sourceRefs.map((ref) => `\`${ref}\``).join(', ')}`,
  ].join('\n')).join('\n\n');

  return [
    '# Jira TL Brief',
    '',
    `Generado en: ${brief.generatedAt}`,
    '',
    brief.summary,
    '',
    risks || '_Sin riesgos destacados en el snapshot actual._',
  ].join('\n').trimEnd() + '\n';
}

function renderAgentJiraContextMarkdown(): string {
  return [
    '# Jira TL Context Bootstrap',
    '',
    'Jira está disponible en modo read-only cuando la capability `jira.read` aparezca como `available`.',
    '',
    'Primero leé:',
    '- `tl-brief.md` para el estado TL accionable.',
    '- `dependency-map.json` para dependencias.',
    '- `sprint-map.json` e `issues-map.json` para drill-down local.',
    '',
    'Usá refs estables:',
    '- `jira://board/{id}`',
    '- `jira://sprint/{id}`',
    '- `jira://issue/{key}`',
    '',
    'No pegues dumps crudos de Jira al usuario. Pedí detalle puntual por ref/capability cuando haga falta.',
  ].join('\n').trimEnd() + '\n';
}
