import { Test } from '@nestjs/testing';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppModule } from '#app/app.module';
import { AppConfigModule, FoundationDocsConfig } from '#config';
import { RefreshDogmaService } from '#dogma-context/services';
import { DOGMA_OUTPUT_DIR } from '#dogma-context/providers';
import type { DogmaRefreshEvent } from '#dogma-context/domain';
import { ConfigurationError, appErrorCodes } from '#shared/errors';

describe('Dogma refresh e2e integration', () => {
  it('fails with a typed error code when FOUNDATION_DOCS_PATH is empty', async () => {
    // Arrange
    const previousFoundationDocsPath = process.env['FOUNDATION_DOCS_PATH'];
    process.env['FOUNDATION_DOCS_PATH'] = '';

    try {
      // Act
      const compileApp = Test.createTestingModule({ imports: [AppModule] }).compile();

      // Assert
      await expect(compileApp).rejects.toMatchObject({
        name: 'ConfigurationError',
        code: appErrorCodes.configurationInvalid,
        message: expect.stringContaining('FOUNDATION_DOCS_PATH cannot be empty'),
      } satisfies Partial<ConfigurationError>);
    } finally {
      if (previousFoundationDocsPath === undefined) delete process.env['FOUNDATION_DOCS_PATH'];
      else process.env['FOUNDATION_DOCS_PATH'] = previousFoundationDocsPath;
    }
  });

  it('generates source map, extractions, dogma brief and bootstrap context from mocked env/path', async () => {
    // Arrange
    const tempDir = await mkdtemp(join(tmpdir(), 'tl-assistant-e2e-'));
    const discoveryRoot = join(tempDir, 'OneDrive - Enterprise', 'Foundation Docs', 'deep', 'deeper');
    const outputDir = join(tempDir, '.tl-assistant', 'dogma');
    await mkdir(discoveryRoot, { recursive: true });

    const markdownPath = join(discoveryRoot, 'Team Lead Dogma.md');
    const videoPath = join(discoveryRoot, 'townhall.mp4');
    const imagePath = join(discoveryRoot, 'whiteboard.png');
    const rawDogma = 'Explain technical tradeoffs before deciding. Include architecture reasoning and delivery constraints.';
    await writeFile(markdownPath, `# Delivery\n\n${rawDogma}\n`, 'utf8');
    await writeFile(videoPath, 'fake video', 'utf8');
    await writeFile(imagePath, 'fake image', 'utf8');
    await writeFile(join(discoveryRoot, 'desktop.ini'), '[ViewState]', 'utf8');

    const previousFoundationDocsPath = process.env['FOUNDATION_DOCS_PATH'];
    process.env['FOUNDATION_DOCS_PATH'] = sep === '\\' ? discoveryRoot : discoveryRoot.replace(/ /g, '\\ ');

    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DOGMA_OUTPUT_DIR)
        .useValue(outputDir)
        .compile();
      const foundationDocsConfig = moduleRef.get<FoundationDocsConfig>(AppConfigModule.getToken(FoundationDocsConfig));
      const refreshDogma = moduleRef.get(RefreshDogmaService);
      const events: DogmaRefreshEvent[] = [];

      // Act
      const result = await refreshDogma.execute({
        rootPaths: [foundationDocsConfig.discoveryRootPath],
        concurrency: 2,
        onProgress: (event) => events.push(event),
      });

      // Assert
      const outputFileNames = result.outputFiles.map((file) => basename(file));
      const sourceMapText = await readFile(join(outputDir, 'source-map.json'), 'utf8');
      const extractionsText = await readFile(join(outputDir, 'extractions.json'), 'utf8');
      const briefMarkdown = await readFile(join(outputDir, 'dogma-brief.md'), 'utf8');
      const agentContext = await readFile(join(outputDir, 'AGENT_CONTEXT.md'), 'utf8');

      expect(foundationDocsConfig.discoveryRootPath).toBe(discoveryRoot);
      expect(outputFileNames).toEqual([
        'source-map.json',
        'extractions.json',
        'dogma-brief.json',
        'dogma-brief.md',
        'agent-context.json',
        'AGENT_CONTEXT.md',
      ]);
      expect(result.sourceMap.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ ref: 'foundation://Team Lead Dogma.md', relativePath: 'Team Lead Dogma.md', status: 'extracted' }),
        expect.objectContaining({ ref: 'foundation://townhall.mp4', relativePath: 'townhall.mp4', status: 'skipped' }),
        expect.objectContaining({ ref: 'foundation://whiteboard.png', relativePath: 'whiteboard.png', status: 'failed' }),
      ]));
      expect(result.brief.items).toHaveLength(1);
      expect(result.brief.items[0]).toMatchObject({
        title: 'Delivery',
        sourceRefs: ['foundation://Team Lead Dogma.md'],
      });
      expect(events.find((event) => event.type === 'refresh.completed')).toMatchObject({
        type: 'refresh.completed',
        stats: { discovered: 3, processed: 1, skipped: 1, failed: 1, briefItems: 1 },
      });
      expect(sourceMapText).toContain('foundation://Team Lead Dogma.md');
      expect(sourceMapText).not.toContain(tempDir);
      expect(briefMarkdown).toContain('foundation://Team Lead Dogma.md');
      expect(briefMarkdown).not.toContain(tempDir);
      expect(agentContext).toContain('dogma-brief.md');
      expect(agentContext).toContain('source-map.json');
      expect(agentContext).toContain('foundation://ruta/relativa.ext');
      expect(agentContext).not.toContain(rawDogma);
      expect(agentContext).not.toContain(tempDir);
      expect(extractionsText).toContain(rawDogma);
    } finally {
      if (previousFoundationDocsPath === undefined) delete process.env['FOUNDATION_DOCS_PATH'];
      else process.env['FOUNDATION_DOCS_PATH'] = previousFoundationDocsPath;
    }
  });
});
