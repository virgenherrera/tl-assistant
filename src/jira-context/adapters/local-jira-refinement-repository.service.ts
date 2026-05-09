import { Injectable } from '@nestjs/common';
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { JiraRefinementEvidence, JiraRefinementResult, JiraRefinementSourceArtifact } from '#jira-context/domain';

@Injectable()
export class LocalJiraRefinementRepositoryService {
  async save(input: {
    readonly issueKey: string;
    readonly generatedAt: string;
    readonly outputRootDir: string;
    readonly evidence: JiraRefinementEvidence;
    readonly sourcePaths: readonly string[];
  }): Promise<JiraRefinementResult> {
    const outputDir = join(input.outputRootDir, input.issueKey);
    const sourcesDir = join(outputDir, 'sources');
    await mkdir(sourcesDir, { recursive: true });

    const sources = await copySources(input.sourcePaths, sourcesDir);
    const evidence: JiraRefinementEvidence = { ...input.evidence, sources };
    const outputFiles = [
      join(outputDir, 'evidence.json'),
      join(outputDir, 'refinement.md'),
      join(outputDir, 'agent-prompt.md'),
    ] as const;

    await writeFile(outputFiles[0], `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    await writeFile(outputFiles[1], renderRefinementMarkdown(evidence), 'utf8');
    await writeFile(outputFiles[2], renderAgentPromptMarkdown(evidence), 'utf8');

    return {
      generatedAt: input.generatedAt,
      issueKey: input.issueKey,
      outputDir,
      evidence,
      outputFiles: [...outputFiles, ...sources.map((source) => source.copiedPath)],
    };
  }
}

async function copySources(sourcePaths: readonly string[], sourcesDir: string): Promise<readonly JiraRefinementSourceArtifact[]> {
  const artifacts: JiraRefinementSourceArtifact[] = [];
  const usedNames = new Map<string, number>();

  for (const sourcePath of sourcePaths) {
    const stats = await stat(sourcePath);
    if (!stats.isFile()) throw new TypeError(`Refinement source must be a file: ${sourcePath}`);

    const fileName = uniqueFileName(basename(sourcePath), usedNames);
    const copiedPath = join(sourcesDir, fileName);
    await copyFile(sourcePath, copiedPath);
    artifacts.push({
      originalPath: sourcePath,
      copiedPath,
      fileName,
      sizeBytes: stats.size,
      extension: extname(sourcePath),
    });
  }

  return artifacts;
}

function uniqueFileName(fileName: string, usedNames: Map<string, number>): string {
  const count = usedNames.get(fileName) ?? 0;
  usedNames.set(fileName, count + 1);
  if (count === 0) return fileName;

  const extension = extname(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  return `${baseName}-${count + 1}${extension}`;
}

function renderRefinementMarkdown(evidence: JiraRefinementEvidence): string {
  const sourceRows = [
    '| Fuente | Estado | Qué aportó |',
    '|---|---|---|',
    `| ${evidence.issue.ref} | encontrado | Issue principal: ${escapeTable(evidence.issue.summary)} |`,
    ...evidence.linkedIssues.map((issue) => `| ${issue.ref} | encontrado | Linked issue: ${escapeTable(issue.summary)} |`),
    ...evidence.sources.map((source) => `| ${source.fileName} | copiado | Source local en \`${source.copiedPath}\` |`),
  ];

  return [
    `# ${evidence.issue.key} — Qué pegar y dónde`,
    '',
    '> Draft local descartable. Guía para TL en español; bloques para Jira en inglés cuando corresponda.',
    '',
    '## 0. Resumen para vos',
    '',
    `- Issue: ${evidence.issue.ref}`,
    `- Summary: ${evidence.issue.summary}`,
    `- Status: ${evidence.issue.status ?? 'no disponible'}`,
    `- Type: ${evidence.issue.issueType ?? 'no disponible'}`,
    `- Sources locales: ${evidence.sources.length}`,
    `- Linked issues con detalle: ${evidence.linkedIssues.length}`,
    '',
    '## 1. Fuentes usadas',
    '',
    ...sourceRows,
    '',
    '## 2. Qué sabemos',
    '',
    '- Completar con hechos confirmados desde Jira y sources locales.',
    '- Usar `evidence.json` y archivos en `sources/` como fuente de verdad local.',
    '',
    '## 3. Qué ya NO hay que preguntar',
    '',
    '- Si una source local define endpoint, request, response, errores o contrato, convertirlo en texto confirmado y NO volver a preguntarlo.',
    '',
    '## 4. Qué sigue abierto',
    '',
    '- Mantener sólo preguntas dirigidas que la evidencia no conteste.',
    '',
    '## 5. Pegá esto en la DESCRIPCIÓN del ticket',
    '',
    '```txt',
    '{English Jira-ready description}',
    '```',
    '',
    '## 6. Pegá esto como ACCEPTANCE CRITERIA',
    '',
    '```txt',
    '{English Jira-ready acceptance criteria}',
    '```',
    '',
    '## 7. Subtareas sugeridas',
    '',
    '```txt',
    '{English subtask titles/descriptions if needed}',
    '```',
    '',
    '## 8. Preguntas para refinement',
    '',
    '```txt',
    '{Targeted remaining questions only}',
    '```',
    '',
    '## 9. Puntos sugeridos para vos',
    '',
    '- Proponer rango con tradeoffs: qué baja puntos, qué sube puntos.',
    '',
    '## 10. Cómo decirlo en refinement',
    '',
    '- Redactar una versión verbal corta para reunión.',
    '',
    '## 11. Orden recomendado',
    '',
    '1. Leer `agent-prompt.md`.',
    '2. Leer `evidence.json`.',
    '3. Leer sources locales relevantes.',
    '4. Reemplazar placeholders con texto final.',
  ].join('\n').trimEnd() + '\n';
}

function renderAgentPromptMarkdown(evidence: JiraRefinementEvidence): string {
  return [
    `# Agent prompt — refine ${evidence.issue.key}`,
    '',
    'Lee este workspace local y refiná la historia sin inventar.',
    '',
    '## Archivos obligatorios',
    '',
    '1. Leé `evidence.json`.',
    '2. Leé `refinement.md`.',
    '3. Leé los archivos dentro de `sources/` si existen.',
    '',
    '## Reglas anti-Frida',
    '',
    '- No conviertas esto en implementación del CLI.',
    '- No propongas modificar `tl-assistant` salvo que el usuario lo pida explícitamente.',
    '- Cada evidencia nueva elimina preguntas genéricas ya respondidas.',
    '- Separá hechos, inferencias y preguntas abiertas.',
    '- Contenido para TL en español; bloques para Jira en inglés cuando corresponda.',
    '- Respondé qué va dónde: descripción, acceptance criteria, subtareas, preguntas y talking points.',
    '',
    '## Objetivo',
    '',
    `Transformar ${evidence.issue.ref} en una historia más definida y accionable usando Jira read-only + sources locales.`,
  ].join('\n').trimEnd() + '\n';
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, '\\|');
}
