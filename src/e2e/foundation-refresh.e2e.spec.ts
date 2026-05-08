import { Test } from '@nestjs/testing';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppModule } from '#app/app.module';
import { AppConfigModule, FoundationDocsConfig } from '#config';
import { RefreshFoundationService } from '#foundation-context/services';
import { FoundationRefreshCommand } from '#foundation-context/commands/foundation-refresh/foundation-refresh';
import { FOUNDATION_OUTPUT_DIR } from '#foundation-context/providers';
import type { FoundationRefreshEvent } from '#foundation-context/domain';
import { ConfigurationError, appErrorCodes } from '#shared/errors';

describe('Foundation refresh e2e integration', () => {
  it('starts without FOUNDATION_DOCS_PATH but foundation refresh command fails with a typed source error', async () => {
    // Arrange
    const previousFoundationDocsPath = process.env['FOUNDATION_DOCS_PATH'];
    delete process.env['FOUNDATION_DOCS_PATH'];

    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const command = moduleRef.get(FoundationRefreshCommand);

      // Act / Assert
      await expect(command.run([], {})).rejects.toMatchObject({
        name: 'ConfigurationError',
        code: appErrorCodes.foundationSourceNotConfigured,
        message: expect.stringContaining('FOUNDATION_DOCS_PATH'),
      } satisfies Partial<ConfigurationError>);
    } finally {
      if (previousFoundationDocsPath === undefined) delete process.env['FOUNDATION_DOCS_PATH'];
      else process.env['FOUNDATION_DOCS_PATH'] = previousFoundationDocsPath;
    }
  });

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

  it('generates source map, extractions, foundation brief and bootstrap context from mocked env/path', async () => {
    // Arrange
    const tempDir = await mkdtemp(join(tmpdir(), 'tl-assistant-e2e-'));
    const discoveryRoot = join(tempDir, 'OneDrive - Enterprise', 'Foundation Docs', 'deep', 'deeper');
    const outputDir = join(tempDir, '.tl-assistant', 'foundation');
    await mkdir(discoveryRoot, { recursive: true });

    const markdownPath = join(discoveryRoot, 'Team Lead Foundation.md');
    const videoPath = join(discoveryRoot, 'townhall.mp4');
    const imagePath = join(discoveryRoot, 'whiteboard.png');
    const rawFoundation = 'Explain technical tradeoffs before deciding. Include architecture reasoning and delivery constraints.';
    await writeFile(markdownPath, `# Delivery\n\n${rawFoundation}\n`, 'utf8');
    await writeFile(videoPath, 'fake video', 'utf8');
    await writeFile(imagePath, 'fake image', 'utf8');
    await writeFile(join(discoveryRoot, 'desktop.ini'), '[ViewState]', 'utf8');

    const previousFoundationDocsPath = process.env['FOUNDATION_DOCS_PATH'];
    process.env['FOUNDATION_DOCS_PATH'] = sep === '\\' ? discoveryRoot : discoveryRoot.replace(/ /g, '\\ ');

    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(FOUNDATION_OUTPUT_DIR)
        .useValue(outputDir)
        .compile();
      const foundationDocsConfig = moduleRef.get<FoundationDocsConfig>(AppConfigModule.getToken(FoundationDocsConfig));
      const refreshFoundation = moduleRef.get(RefreshFoundationService);
      const events: FoundationRefreshEvent[] = [];

      // Act
      const result = await refreshFoundation.execute({
        rootPaths: [foundationDocsConfig.discoveryRootPath ?? expect.fail('FOUNDATION_DOCS_PATH should be configured for this test')],
        concurrency: 2,
        onProgress: (event) => events.push(event),
      });

      // Assert
      const outputFileNames = result.outputFiles.map((file) => basename(file));
      const sourceMapText = await readFile(join(outputDir, 'source-map.json'), 'utf8');
      const extractionsText = await readFile(join(outputDir, 'extractions.json'), 'utf8');
      const briefMarkdown = await readFile(join(outputDir, 'foundation-brief.md'), 'utf8');
      const agentContext = await readFile(join(outputDir, 'AGENT_FOUNDATION_CONTEXT.md'), 'utf8');

      expect(foundationDocsConfig).toMatchObject({ configured: true, discoveryRootPath: discoveryRoot });
      expect(foundationDocsConfig.discoveryRootPath).toBe(discoveryRoot);
      expect(outputFileNames).toEqual([
        'source-map.json',
        'extractions.json',
        'foundation-brief.json',
        'foundation-brief.md',
        'agent-context.json',
        'AGENT_FOUNDATION_CONTEXT.md',
      ]);
      expect(result.sourceMap.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ ref: 'foundation://local/Team Lead Foundation.md', relativePath: 'Team Lead Foundation.md', status: 'extracted' }),
        expect.objectContaining({ ref: 'foundation://local/townhall.mp4', relativePath: 'townhall.mp4', status: 'skipped' }),
        expect.objectContaining({ ref: 'foundation://local/whiteboard.png', relativePath: 'whiteboard.png', status: 'failed' }),
      ]));
      expect(result.brief.items).toHaveLength(1);
      expect(result.brief.items[0]).toMatchObject({
        title: 'Delivery',
        sourceRefs: ['foundation://local/Team Lead Foundation.md'],
      });
      expect(events.find((event) => event.type === 'refresh.completed')).toMatchObject({
        type: 'refresh.completed',
        stats: { discovered: 3, processed: 1, skipped: 1, failed: 1, briefItems: 1 },
      });
      expect(sourceMapText).toContain('foundation://local/Team Lead Foundation.md');
      expect(sourceMapText).not.toContain(tempDir);
      expect(briefMarkdown).toContain('foundation://local/Team Lead Foundation.md');
      expect(briefMarkdown).not.toContain(tempDir);
      expect(agentContext).toContain('foundation-brief.md');
      expect(agentContext).toContain('source-map.json');
      expect(agentContext).toContain('foundation://local/ruta/relativa.ext');
      expect(agentContext).not.toContain(rawFoundation);
      expect(agentContext).not.toContain(tempDir);
      expect(extractionsText).toContain(rawFoundation);
    } finally {
      if (previousFoundationDocsPath === undefined) delete process.env['FOUNDATION_DOCS_PATH'];
      else process.env['FOUNDATION_DOCS_PATH'] = previousFoundationDocsPath;
    }
  });
});
