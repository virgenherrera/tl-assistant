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
    await writeFile(outputFiles[4], renderDailyBriefPrompt(), 'utf8');
    await writeFile(outputFiles[5], renderRiskReviewPrompt(), 'utf8');

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
    '7. Usá refs `jira://...` y `foundation://local/...`; no pegues dumps crudos.',
    '',
    '## Artifacts',
    '',
    ...artifactLines,
    '',
    '## Prompts operativos',
    '',
    '- `prompts/sprint-status.md` — status ejecutivo del sprint.',
    '- `prompts/planning-refinement.md` — preparación para planning/refinement.',
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
