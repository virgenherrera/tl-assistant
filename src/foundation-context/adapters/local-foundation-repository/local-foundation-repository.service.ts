import { Injectable } from '@nestjs/common';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FoundationBrief, FoundationRefreshResult, UniversalAgentContext } from '#domain/foundation';
import type { FoundationRepositoryPort } from '#ports';

@Injectable()
export class LocalFoundationRepositoryService implements FoundationRepositoryPort {

  async saveRefreshResult(result: FoundationRefreshResult, outputDir = '.tl-assistant/foundation'): Promise<readonly string[]> {
    await fs.mkdir(outputDir, { recursive: true });
    await removeLegacyArtifacts(outputDir);

    const sourceMapPath = path.join(outputDir, 'source-map.json');
    const extractionsPath = path.join(outputDir, 'extractions.json');
    const briefJsonPath = path.join(outputDir, 'foundation-brief.json');
    const briefMarkdownPath = path.join(outputDir, 'foundation-brief.md');
    const agentContextJsonPath = path.join(outputDir, 'agent-context.json');
    const agentContextMarkdownPath = path.join(outputDir, 'AGENT_FOUNDATION_CONTEXT.md');

    const outputFiles = [
      sourceMapPath,
      extractionsPath,
      briefJsonPath,
      briefMarkdownPath,
      agentContextJsonPath,
      agentContextMarkdownPath,
    ] as const;
    const persistedResult = { ...result, outputFiles };

    await fs.writeFile(sourceMapPath, `${JSON.stringify(persistedResult.sourceMap, null, 2)}\n`, 'utf8');
    await fs.writeFile(extractionsPath, `${JSON.stringify(persistedResult.extractions, null, 2)}\n`, 'utf8');
    await fs.writeFile(briefJsonPath, `${JSON.stringify(persistedResult.brief, null, 2)}\n`, 'utf8');
    await fs.writeFile(briefMarkdownPath, renderFoundationBriefMarkdown(persistedResult.brief), 'utf8');
    await fs.writeFile(agentContextJsonPath, `${JSON.stringify(persistedResult.agentContext, null, 2)}\n`, 'utf8');
    await fs.writeFile(agentContextMarkdownPath, renderUniversalAgentContextMarkdown(persistedResult.agentContext), 'utf8');

    return outputFiles;
  }
}

async function removeLegacyArtifacts(outputDir: string): Promise<void> {
  await Promise.all([
    fs.rm(path.join(outputDir, 'foundation.json'), { force: true }),
    fs.rm(path.join(outputDir, 'foundation.md'), { force: true }),
  ]);
}

function renderFoundationBriefMarkdown(brief: FoundationBrief): string {
  const items = brief.items
    .map((item) => [
      `## ${item.title}`,
      '',
      `Tipo: \`${item.kind}\``,
      `Fuentes: ${item.sourceRefs.map((sourceRef) => `\`${sourceRef}\``).join(', ')}`,
      '',
      item.summary,
    ].join('\n'))
    .join('\n\n');

  return [
    '# Foundation brief — TL Assistant',
    '',
    `Esquema: \`${brief.schemaVersion}\``,
    `Generado en: ${brief.generatedAt}`,
    '',
    '## Resumen',
    brief.summary,
    '',
    items || '_Todavía no se generaron items de brief._',
  ].join('\n').trimEnd() + '\n';
}

function renderUniversalAgentContextMarkdown(context: UniversalAgentContext): string {
  const personaDirectives = context.persona.directives.map((directive) => `- ${directive}`).join('\n');
  const compatibilityInstructions = context.compatibility.instructions.map((instruction) => `- ${instruction}`).join('\n');

  return [
    '# Senku TL Assistant — Agent bootstrap',
    '',
    `Esquema: \`${context.schemaVersion}\``,
    `Generado en: ${context.generatedAt}`,
    '',
    '## Cómo contextualizarte',
    compatibilityInstructions,
    '',
    '## Artifacts locales requeridos',
    `- Source map: \`${context.sourceMapRef}\``,
    `- Foundation brief: \`${context.foundationBriefRef}\``,
    '- Raw extractions: `extractions.json` sólo si el brief no alcanza y siempre en entorno local confiable.',
    '',
    '## Persona invariante',
    `- ID: \`${context.persona.id}\``,
    `- Nombre: ${context.persona.name}`,
    `- Estilo: ${context.persona.style}`,
    '',
    '## Directivas no negociables',
    personaDirectives,
    '',
    '## Reglas de fuentes',
    '- Citar fuentes locales como `foundation://local/ruta/relativa.ext`.',
    '- Futuras fuentes Confluence deberán citarse como `foundation://confluence/{spaceKey}/{pageId}`.',
    '- Nunca exponer full paths locales en outputs externos.',
    '- Nunca pegar contenido crudo de foundation docs si un brief o referencia alcanza.',
  ].join('\n').trimEnd() + '\n';
}
