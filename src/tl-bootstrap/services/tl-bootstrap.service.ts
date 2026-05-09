import { Inject, Injectable } from '@nestjs/common';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TL_BOOTSTRAP_OUTPUT_DIR } from '#tl-bootstrap/providers';

interface ContextArtifact {
  readonly id: string;
  readonly path: string;
  readonly required: boolean;
  readonly purpose: string;
}

interface BootstrapResult {
  readonly generatedAt: string;
  readonly outputDir: string;
  readonly outputFiles: readonly string[];
  readonly artifacts: readonly ContextArtifact[];
  readonly availableArtifacts: readonly string[];
  readonly missingRequiredArtifacts: readonly string[];
}

const contextArtifacts = [
  {
    id: 'jira.bootstrap',
    path: '.tl-assistant/jira/AGENT_JIRA_CONTEXT.md',
    required: true,
    purpose: 'Runbook Jira read-only y reglas de refs jira://.',
  },
  {
    id: 'jira.brief',
    path: '.tl-assistant/jira/tl-brief.md',
    required: true,
    purpose: 'Resumen accionable TL del snapshot Jira.',
  },
  {
    id: 'jira.issues',
    path: '.tl-assistant/jira/issues-map.json',
    required: true,
    purpose: 'Drill-down local de issues del sprint.',
  },
  {
    id: 'jira.dependencies',
    path: '.tl-assistant/jira/dependency-map.json',
    required: true,
    purpose: 'Árbol local de dependencias del sprint.',
  },
  {
    id: 'jira.sprints',
    path: '.tl-assistant/jira/sprint-map.json',
    required: true,
    purpose: 'Mapa local de sprints visibles.',
  },
  {
    id: 'foundation.bootstrap',
    path: '.tl-assistant/foundation/AGENT_FOUNDATION_CONTEXT.md',
    required: false,
    purpose: 'Runbook foundation context.',
  },
  {
    id: 'foundation.brief',
    path: '.tl-assistant/foundation/foundation-brief.md',
    required: false,
    purpose: 'Brief semántico foundation para decisiones del proyecto.',
  },
  {
    id: 'refinement.workspace',
    path: '.tl-assistant/refinement',
    required: false,
    purpose: 'Workspace local descartable para drafts de refinamiento, fuentes y handoff entre agentes.',
  },
] as const satisfies readonly ContextArtifact[];

@Injectable()
export class TlBootstrapService {
  constructor(@Inject(TL_BOOTSTRAP_OUTPUT_DIR) private readonly defaultOutputDir: string) {}

  async generate(outputDir = this.defaultOutputDir): Promise<BootstrapResult> {
    await mkdir(join(outputDir, 'prompts'), { recursive: true });
    const generatedAt = new Date().toISOString();
    const availableArtifacts = await availablePaths(contextArtifacts);
    const missingRequiredArtifacts = contextArtifacts
      .filter((artifact) => artifact.required && !availableArtifacts.includes(artifact.path))
      .map((artifact) => artifact.path);

    const outputFiles = [
      join(outputDir, 'OPERATING_CONTEXT.md'),
      join(outputDir, 'context-index.json'),
      join(outputDir, 'prompts', 'sprint-status.md'),
      join(outputDir, 'prompts', 'planning-refinement.md'),
      join(outputDir, 'prompts', 'story-refinement.md'),
      join(outputDir, 'prompts', 'daily-brief.md'),
      join(outputDir, 'prompts', 'risk-review.md'),
    ] as const;

    const result: BootstrapResult = {
      generatedAt,
      outputDir,
      outputFiles,
      artifacts: contextArtifacts,
      availableArtifacts,
      missingRequiredArtifacts,
    };

    await writeFile(outputFiles[0], renderOperatingContext(result), 'utf8');
    await writeFile(outputFiles[1], `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await writeFile(outputFiles[2], renderSprintStatusPrompt(), 'utf8');
    await writeFile(outputFiles[3], renderPlanningRefinementPrompt(), 'utf8');
    await writeFile(outputFiles[4], renderStoryRefinementPrompt(), 'utf8');
    await writeFile(outputFiles[5], renderDailyBriefPrompt(), 'utf8');
    await writeFile(outputFiles[6], renderRiskReviewPrompt(), 'utf8');

    return result;
  }
}

async function availablePaths(artifacts: readonly ContextArtifact[]): Promise<readonly string[]> {
  const result: string[] = [];
  for (const artifact of artifacts) {
    try {
      await access(artifact.path);
      result.push(artifact.path);
    } catch {
      // Missing files are represented in context-index.json; do not fail bootstrap generation.
    }
  }
  return result;
}

function renderOperatingContext(result: BootstrapResult): string {
  const artifactLines = result.artifacts.map((artifact) => {
    const status = result.availableArtifacts.includes(artifact.path) ? 'available' : artifact.required ? 'missing-required' : 'missing-optional';
    return `- ${status}: \`${artifact.path}\` — ${artifact.purpose}`;
  });

  return [
    '# TL Assistant Operating Context',
    '',
    `Generado en: ${result.generatedAt}`,
    '',
    '## Reglas antes de responder',
    '',
    '1. Leé este archivo completo.',
    '2. Leé `context-index.json` para confirmar artifacts disponibles.',
    '3. Para estado de sprint, planning o refinamiento, usá primero los artifacts Jira listados abajo.',
    '4. Si un artifact requerido falta o no puede leerse, decilo explícitamente y NO inventes.',
    '5. NO uses memoria de sesión, historial del repo ni cambios del proyecto `tl-assistant` como sustituto del snapshot Jira.',
    '6. NO hables del proyecto `tl-assistant` salvo que el usuario lo pida explícitamente.',
    '7. NO conviertas preguntas sobre sprint, carry-over, planning, refinement, daily o riesgos en propuestas de implementación del CLI. Respondé sobre el trabajo Jira/foundation, no sobre modificar este repo.',
    '8. Sólo propongas cambios al proyecto `tl-assistant` cuando el usuario pida explícitamente implementar/mejorar el CLI, comandos, prompts o artifacts.',
    '9. Usá refs `jira://...` y `foundation://local/...`; no pegues dumps crudos.',
    '',
    '## Routing de intención',
    '',
    '- Si el usuario pregunta por historias, sprint, carry-over, planning, refinement o daily → tratá la consulta como análisis TL sobre los artifacts locales.',
    '- Si el usuario pide “implementá”, “agregá feature al CLI”, “modificá el repo” o similar → recién ahí hablá de cambios en `tl-assistant`.',
    '- Si hay ambigüedad entre analizar Jira o cambiar el CLI, preguntá una sola aclaración y frená.',
    '',
    '## Artifacts',
    '',
    ...artifactLines,
    '',
    '## Prompts operativos',
    '',
    '- `prompts/sprint-status.md` — status ejecutivo del sprint.',
    '- `prompts/planning-refinement.md` — preparación para planning/refinement.',
    '- `prompts/story-refinement.md` — transformar un issue subdefinido en historia accionable con evidencia.',
    '- `prompts/daily-brief.md` — brief para daily.',
    '- `prompts/risk-review.md` — revisión de riesgos/dependencias.',
    '',
    '## Instrucción corta para pegar en cualquier agente',
    '',
    '```txt',
    'Lee `.tl-assistant/agent/OPERATING_CONTEXT.md` y ejecuta el prompt operativo que corresponda. Si no puedes leer los artifacts requeridos, dilo explícitamente y no inventes.',
    '```',
  ].join('\n').trimEnd() + '\n';
}

function renderSprintStatusPrompt(): string {
  return promptMarkdown('Sprint status', [
    'Leé `.tl-assistant/jira/tl-brief.md`, `issues-map.json`, `dependency-map.json` y `sprint-map.json`.',
    'Dame resumen ejecutivo del sprint actual.',
    'Lista riesgos reales con refs `jira://...`.',
    'Detecta issues bloqueados, con dependencias, stale o sin assignee.',
    'Dame acciones TL recomendadas para las próximas 24 horas.',
  ]);
}

function renderPlanningRefinementPrompt(): string {
  return promptMarkdown('Planning / refinement', [
    'Leé los artifacts Jira requeridos y foundation brief si existe.',
    'Detecta issues que no están listos para planning/refinement.',
    'Marca ambigüedad, falta de acceptance criteria, dependencias no resueltas y scope riesgoso.',
    'Propón preguntas concretas por issue para llevar a planning.',
    'Prioriza por impacto/riesgo usando refs `jira://...`.',
  ]);
}

function renderStoryRefinementPrompt(): string {
  return [
    '# Story refinement',
    '',
    '## Objetivo',
    '',
    'Transformar un issue Jira subdefinido en una historia accionable usando evidencia disponible. No inventes: juntá señales, reducís incertidumbre y dejás texto claro para Jira/refinement.',
    '',
    '## Fuentes a leer primero',
    '',
    '1. Leé `.tl-assistant/agent/OPERATING_CONTEXT.md` y `context-index.json`.',
    '2. Leé `.tl-assistant/jira/issues-map.json`, `.tl-assistant/jira/dependency-map.json`, `.tl-assistant/jira/tl-brief.md` y `.tl-assistant/jira/sprint-map.json`.',
    '3. Si existe `.tl-assistant/refinement/{ISSUE_KEY}.md`, leelo como draft previo y actualizalo mentalmente; no repitas preguntas ya contestadas.',
    '4. Si existe `.tl-assistant/refinement/sources/` o `.tl-assistant/refinement/{ISSUE_KEY}/sources/`, leé sólo fuentes relevantes al issue: contracts markdown, OpenAPI/Swagger, snippets, notas o research.',
    '5. Si foundation está disponible, usala sólo para reglas de producto/arquitectura; si no está, decilo y seguí con Jira + sources locales.',
    '',
    '## Regla de evidencia',
    '',
    '- Separá siempre **hechos**, **inferencias** y **preguntas abiertas**.',
    '- Cada nueva evidencia debe eliminar preguntas genéricas ya respondidas.',
    '- Si un contract/OpenAPI/Swagger ya define endpoint, request, response o errores, NO preguntes eso de nuevo.',
    '- Convertí lo confirmado en texto listo para Jira.',
    '- Conservá sólo preguntas dirigidas sobre lo que sigue ambiguo.',
    '- No pegues dumps crudos de Jira ni documentos completos; resumí y citá refs/rutas locales.',
    '',
    '## Formato obligatorio de salida',
    '',
    'Respondé en español para guiar al TL, pero los bloques que se pegan en Jira deben ir en inglés cuando el proyecto lo requiera.',
    '',
    'Usá estas secciones exactas:',
    '',
    '````md',
    '# {ISSUE_KEY} — Qué pegar y dónde',
    '',
    '## 0. Resumen para vos',
    '',
    '## 1. Fuentes usadas',
    '',
    '| Fuente | Estado | Qué aportó |',
    '|---|---|---|',
    '',
    '## 2. Qué sabemos',
    '',
    '## 3. Qué ya NO hay que preguntar',
    '',
    '## 4. Qué sigue abierto',
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
    '## 10. Cómo decirlo en refinement',
    '',
    '## 11. Orden recomendado',
    '````',
    '',
    '## Criterio de calidad',
    '',
    '- El output debe decir explícitamente qué va dónde: descripción, AC, subtarea, technical notes o conversación de refinement.',
    '- No abras con “this task has no description” dentro del texto para Jira si estás redactando la descripción.',
    '- No generes enciclopedias: generá handoff accionable.',
    '- Si encontrás una fuente nueva, actualizá el análisis: lo confirmado deja de ser pregunta.',
  ].join('\n').trimEnd() + '\n';
}

function renderDailyBriefPrompt(): string {
  return promptMarkdown('Daily brief', [
    'Leé los artifacts Jira requeridos.',
    'Agrupa por: bloqueos, follow-ups, owners faltantes, stale, decisiones necesarias.',
    'Dame un guion breve para daily con preguntas concretas.',
    'No pegues dumps crudos ni listas gigantes; prioriza señal TL.',
  ]);
}

function renderRiskReviewPrompt(): string {
  return promptMarkdown('Risk review', [
    'Leé `dependency-map.json` e `issues-map.json`.',
    'Detecta cadenas de dependencia y posibles bloqueadores del sprint.',
    'Separa hechos del snapshot, inferencias y preguntas abiertas.',
    'Propón mitigaciones concretas por riesgo.',
  ]);
}

function promptMarkdown(title: string, instructions: readonly string[]): string {
  return [
    `# ${title}`,
    '',
    '## Instrucciones',
    '',
    ...instructions.map((instruction, index) => `${index + 1}. ${instruction}`),
    '',
    '## Reglas',
    '',
    '- Usá sólo artifacts locales disponibles como fuente de verdad.',
    '- Si falta un artifact requerido, reportalo y no inventes.',
    '- Usá español neutral.',
    '- Citá refs `jira://...` y `foundation://local/...` cuando corresponda.',
  ].join('\n').trimEnd() + '\n';
}
