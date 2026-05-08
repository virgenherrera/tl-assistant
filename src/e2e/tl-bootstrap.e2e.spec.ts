import { Test } from '@nestjs/testing';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppModule } from '#app/app.module';
import { TL_BOOTSTRAP_OUTPUT_DIR } from '#tl-bootstrap/providers';
import { TlBootstrapService } from '#tl-bootstrap/services';

describe('TL bootstrap e2e integration', () => {
  it('generates operating context and prompts that force agents to use local artifacts', async () => {
    // Arrange
    const tempDir = await mkdtemp(join(tmpdir(), 'tl-assistant-bootstrap-e2e-'));
    const outputDir = join(tempDir, '.tl-assistant', 'agent');
    await createJiraArtifacts(tempDir);
    const cwd = process.cwd();
    process.chdir(tempDir);

    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(TL_BOOTSTRAP_OUTPUT_DIR)
        .useValue(outputDir)
        .compile();
      const bootstrap = moduleRef.get(TlBootstrapService);

      // Act
      const result = await bootstrap.generate();

      // Assert
      const outputFileNames = result.outputFiles.map((file) => basename(file));
      const operatingContext = await readFile(join(outputDir, 'OPERATING_CONTEXT.md'), 'utf8');
      const planningPrompt = await readFile(join(outputDir, 'prompts', 'planning-refinement.md'), 'utf8');
      const contextIndex = await readFile(join(outputDir, 'context-index.json'), 'utf8');

      expect(outputFileNames).toEqual(expect.arrayContaining(['OPERATING_CONTEXT.md', 'context-index.json']));
      expect(result.missingRequiredArtifacts).toEqual([]);
      expect(operatingContext).toContain('NO uses memoria de sesión');
      expect(operatingContext).toContain('.tl-assistant/jira/issues-map.json');
      expect(operatingContext).toContain('NO hables del proyecto `tl-assistant`');
      expect(operatingContext).toContain('prompts/planning-refinement.md');
      expect(planningPrompt).toContain('Detecta issues que no están listos para planning/refinement');
      expect(planningPrompt).toContain('jira://');
      expect(contextIndex).toContain('.tl-assistant/jira/tl-brief.md');
    } finally {
      process.chdir(cwd);
    }
  });

  it('reports missing required Jira artifacts instead of pretending context exists', async () => {
    // Arrange
    const tempDir = await mkdtemp(join(tmpdir(), 'tl-assistant-bootstrap-missing-e2e-'));
    const outputDir = join(tempDir, '.tl-assistant', 'agent');
    const cwd = process.cwd();
    process.chdir(tempDir);

    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(TL_BOOTSTRAP_OUTPUT_DIR)
        .useValue(outputDir)
        .compile();
      const bootstrap = moduleRef.get(TlBootstrapService);

      // Act
      const result = await bootstrap.generate();

      // Assert
      const operatingContext = await readFile(join(outputDir, 'OPERATING_CONTEXT.md'), 'utf8');
      expect(result.missingRequiredArtifacts).toEqual(expect.arrayContaining([
        '.tl-assistant/jira/tl-brief.md',
        '.tl-assistant/jira/issues-map.json',
      ]));
      expect(operatingContext).toContain('missing-required');
      expect(operatingContext).toContain('Si un artifact requerido falta');
    } finally {
      process.chdir(cwd);
    }
  });
});

async function createJiraArtifacts(root: string): Promise<void> {
  const jiraDir = join(root, '.tl-assistant', 'jira');
  await mkdir(jiraDir, { recursive: true });
  await writeFile(join(jiraDir, 'AGENT_JIRA_CONTEXT.md'), '# Jira context\n', 'utf8');
  await writeFile(join(jiraDir, 'tl-brief.md'), '# Sprint brief\n', 'utf8');
  await writeFile(join(jiraDir, 'issues-map.json'), '[]\n', 'utf8');
  await writeFile(join(jiraDir, 'dependency-map.json'), '{"edges":[]}\n', 'utf8');
  await writeFile(join(jiraDir, 'sprint-map.json'), '[]\n', 'utf8');
}
