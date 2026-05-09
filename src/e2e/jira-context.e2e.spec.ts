import { Test } from '@nestjs/testing';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CapabilityModule, AgentCapabilityRegistry } from '#capabilities';
import { ConfigModule } from '#config/config.module';
import { JiraContextModule } from '#jira-context';
import { JiraDoctorService, JiraRefinementService, JiraRefreshService } from '#jira-context/services';
import { JIRA_FETCH, JIRA_OUTPUT_DIR, JIRA_REFINEMENT_OUTPUT_DIR, type JiraFetch } from '#jira-context/providers';
import { ConfigurationError, appErrorCodes } from '#shared/errors';
import { jiraErrorCodes } from '#jira-context/domain';

const jiraEnvKeys = ['JIRA_SITE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_BOARD_ID', 'JIRA_CLOUD_ID', 'JIRA_AUTH_MODE'] as const;
const foundationEnvKey = 'FOUNDATION_DOCS_PATH';
const savedEnv = snapshotEnv([...jiraEnvKeys, foundationEnvKey]);

afterEach(() => {
  restoreEnv(savedEnv);
});

describe('Jira context e2e integration', () => {
  it('starts without Jira capability when Jira env is absent', async () => {
    // Arrange
    clearJiraEnv();

    // Act
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, CapabilityModule, JiraContextModule.registerIfConfigured()] }).compile();
    await moduleRef.init();
    const capabilities = moduleRef.get(AgentCapabilityRegistry).list();

    // Assert
    expect(capabilities).toEqual([]);
  });

  it('fails with a typed error when Jira env is partial', async () => {
    // Arrange
    clearJiraEnv();
    process.env['JIRA_SITE_URL'] = 'https://example.atlassian.net';

    // Act
    const compileApp = Test.createTestingModule({ imports: [ConfigModule, CapabilityModule, JiraContextModule.registerIfConfigured()] }).compile();

    // Assert
    await expect(compileApp).rejects.toMatchObject({
      name: 'ConfigurationError',
      code: appErrorCodes.configurationInvalid,
      message: expect.stringContaining('JIRA_EMAIL is required when Jira integration is configured.'),
    } satisfies Partial<ConfigurationError>);
  });

  it('registers configured-unverified Jira capability when Jira env is complete', async () => {
    // Arrange
    await arrangeCompleteEnv();

    // Act
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, CapabilityModule, JiraContextModule.registerIfConfigured()] })
      .overrideProvider(JIRA_FETCH)
      .useValue(createJiraFetchMock())
      .compile();
    await moduleRef.init();
    const capabilities = moduleRef.get(AgentCapabilityRegistry).list();

    // Assert
    expect(capabilities).toEqual([
      expect.objectContaining({ id: 'jira.read', status: 'configured-unverified' }),
    ]);
  });

  it('performs jira doctor handshake and marks capability available', async () => {
    // Arrange
    await arrangeCompleteEnv();
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, CapabilityModule, JiraContextModule.registerIfConfigured()] })
      .overrideProvider(JIRA_FETCH)
      .useValue(createJiraFetchMock())
      .compile();
    await moduleRef.init();
    const doctor = moduleRef.get(JiraDoctorService);
    const registry = moduleRef.get(AgentCapabilityRegistry);

    // Act
    const snapshot = await doctor.handshake();

    // Assert
    expect(snapshot).toMatchObject({
      status: 'available',
      board: { id: 42, ref: 'jira://board/42', name: 'TL Board' },
      activeSprint: { id: 7, ref: 'jira://sprint/7', name: 'Sprint 7' },
      visibleIssueCount: 2,
      capability: 'jira.read',
    });
    expect(registry.list()).toEqual([
      expect.objectContaining({ id: 'jira.read', status: 'available', refs: ['jira://board/42', 'jira://sprint/7'] }),
    ]);
  });

  it.each([
    [401, jiraErrorCodes.authFailed],
    [403, jiraErrorCodes.forbidden],
    [404, jiraErrorCodes.notFound],
    [429, jiraErrorCodes.rateLimited],
  ])('fails jira doctor with typed Jira error for HTTP %s', async (status, expectedCode) => {
    // Arrange
    await arrangeCompleteEnv();
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, CapabilityModule, JiraContextModule.registerIfConfigured()] })
      .overrideProvider(JIRA_FETCH)
      .useValue(createJiraFetchMock({ alwaysResponseStatus: status }))
      .compile();
    await moduleRef.init();
    const doctor = moduleRef.get(JiraDoctorService);

    // Act / Assert
    await expect(doctor.handshake()).rejects.toMatchObject({ name: 'JiraError', code: expectedCode });
  });

  it('refreshes Jira context artifacts with refs and without raw secrets', async () => {
    // Arrange
    await arrangeCompleteEnv();
    const tempDir = await mkdtemp(join(tmpdir(), 'tl-assistant-jira-e2e-'));
    const outputDir = join(tempDir, '.tl-assistant', 'jira');
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, CapabilityModule, JiraContextModule.registerIfConfigured()] })
      .overrideProvider(JIRA_FETCH)
      .useValue(createJiraFetchMock())
      .overrideProvider(JIRA_OUTPUT_DIR)
      .useValue(outputDir)
      .compile();
    await moduleRef.init();
    const refresh = moduleRef.get(JiraRefreshService);

    // Act
    const result = await refresh.refresh();

    // Assert
    const outputFileNames = result.outputFiles.map((file) => basename(file));
    const agentContext = await readFile(join(outputDir, 'AGENT_JIRA_CONTEXT.md'), 'utf8');
    const briefMarkdown = await readFile(join(outputDir, 'tl-brief.md'), 'utf8');
    const issuesMap = await readFile(join(outputDir, 'issues-map.json'), 'utf8');
    const dependencyMap = await readFile(join(outputDir, 'dependency-map.json'), 'utf8');

    expect(outputFileNames).toEqual([
      'connection-snapshot.json',
      'board-map.json',
      'sprint-map.json',
      'issues-map.json',
      'dependency-map.json',
      'tl-brief.json',
      'tl-brief.md',
      'AGENT_JIRA_CONTEXT.md',
    ]);
    expect(result.issues).toHaveLength(2);
    expect(result.dependencies.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromRef: 'jira://issue/TL-1', toRef: 'jira://issue/TL-2' }),
    ]));
    expect(agentContext).toContain('jira://issue/{key}');
    expect(agentContext).not.toContain(process.env['JIRA_API_TOKEN']);
    expect(agentContext).not.toContain('Raw TL issue description');
    expect(briefMarkdown).toContain('jira://issue/TL-1');
    expect(issuesMap).toContain('jira://issue/TL-1');
    expect(dependencyMap).toContain('jira://issue/TL-2');
  });

  it('generates Jira refinement workspace with linked issues and local sources', async () => {
    // Arrange
    await arrangeCompleteEnv();
    const tempDir = await mkdtemp(join(tmpdir(), 'tl-assistant-jira-refine-e2e-'));
    const outputDir = join(tempDir, '.tl-assistant', 'refinement');
    const sourceDir = join(tempDir, 'sources');
    const sourcePath = join(sourceDir, 'search-membership-api-contract.md');
    await mkdir(sourceDir, { recursive: true });
    await writeFile(sourcePath, '# API Contract\n\nGET /api/members/search\n', 'utf8');
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, CapabilityModule, JiraContextModule.registerIfConfigured()] })
      .overrideProvider(JIRA_FETCH)
      .useValue(createJiraFetchMock())
      .overrideProvider(JIRA_REFINEMENT_OUTPUT_DIR)
      .useValue(outputDir)
      .compile();
    await moduleRef.init();
    const refinement = moduleRef.get(JiraRefinementService);

    // Act
    const result = await refinement.refine({ issueKey: 'TL-1', sourcePaths: [sourcePath] });

    // Assert
    const evidence = await readFile(join(outputDir, 'TL-1', 'evidence.json'), 'utf8');
    const refinementMarkdown = await readFile(join(outputDir, 'TL-1', 'refinement.md'), 'utf8');
    const agentPrompt = await readFile(join(outputDir, 'TL-1', 'agent-prompt.md'), 'utf8');
    const copiedSource = await readFile(join(outputDir, 'TL-1', 'sources', 'search-membership-api-contract.md'), 'utf8');

    expect(result.outputDir).toBe(join(outputDir, 'TL-1'));
    expect(result.evidence.linkedIssues).toHaveLength(1);
    expect(result.evidence.sources).toHaveLength(1);
    expect(evidence).toContain('jira://issue/TL-2');
    expect(evidence).toContain('search-membership-api-contract.md');
    expect(refinementMarkdown).toContain('Pegá esto en la DESCRIPCIÓN');
    expect(refinementMarkdown).toContain('Qué ya NO hay que preguntar');
    expect(agentPrompt).toContain('No conviertas esto en implementación del CLI');
    expect(agentPrompt).toContain('Cada evidencia nueva elimina preguntas genéricas ya respondidas');
    expect(copiedSource).toContain('GET /api/members/search');
  });
});

async function arrangeCompleteEnv(): Promise<void> {
  clearJiraEnv();
  delete process.env[foundationEnvKey];
  process.env['JIRA_SITE_URL'] = 'https://example.atlassian.net';
  process.env['JIRA_EMAIL'] = 'tl@example.com';
  process.env['JIRA_API_TOKEN'] = 'secret-token';
  process.env['JIRA_BOARD_ID'] = '42';
}

function clearJiraEnv(): void {
  for (const key of jiraEnvKeys) delete process.env[key];
}


function createJiraFetchMock(options: { readonly firstResponseStatus?: number; readonly alwaysResponseStatus?: number } = {}): JiraFetch {
  let calls = 0;
  return async (input) => {
    calls += 1;
    if (options.alwaysResponseStatus !== undefined) {
      return jsonResponse({ errorMessages: ['mock failure'] }, options.alwaysResponseStatus);
    }
    if (calls === 1 && options.firstResponseStatus !== undefined) {
      return jsonResponse({ errorMessages: ['mock failure'] }, options.firstResponseStatus);
    }

    const url = new URL(input.toString());
    if (url.pathname === '/rest/agile/1.0/board/42') return jsonResponse({ id: 42, name: 'TL Board', type: 'scrum', self: url.toString() });
    if (url.pathname === '/rest/agile/1.0/board/42/sprint') return jsonResponse({ startAt: 0, maxResults: 50, isLast: true, values: [
      { id: 7, name: 'Sprint 7', state: 'active', goal: 'Ship TL flow' },
      { id: 6, name: 'Sprint 6', state: 'closed' },
    ] });
    if (url.pathname === '/rest/agile/1.0/sprint/7/issue') return jsonResponse({ startAt: 0, maxResults: 50, total: 2, issues: [
      {
        id: '10001',
        key: 'TL-1',
        fields: {
          summary: 'Raw TL issue description should stay in local maps only',
          status: { name: 'In Progress' },
          assignee: null,
          issuetype: { name: 'Story' },
          priority: { name: 'High' },
          updated: '2020-01-01T00:00:00.000+0000',
          issuelinks: [{ type: { name: 'Blocks' }, outwardIssue: { key: 'TL-2' } }],
        },
      },
      {
        id: '10002',
        key: 'TL-2',
        fields: {
          summary: 'Dependency target',
          status: { name: 'To Do' },
          assignee: { displayName: 'Senku Ishigami' },
          issuetype: { name: 'Task' },
          updated: new Date().toISOString(),
        },
      },
    ] });
    if (url.pathname === '/rest/api/3/issue/TL-1') return jsonResponse({
      id: '10001',
      key: 'TL-1',
      fields: {
        summary: 'Integrate Membership Search',
        description: jiraDoc('Connect FE to BE contract'),
        status: { name: 'To Do' },
        assignee: { displayName: 'Hugo Virgen' },
        issuetype: { name: 'Task' },
        priority: { name: 'High' },
        created: '2026-05-01T00:00:00.000+0000',
        updated: '2026-05-02T00:00:00.000+0000',
        issuelinks: [{
          type: { name: 'Polaris work item link' },
          outwardIssue: {
            key: 'TL-2',
            fields: {
              summary: 'BE Membership Search',
              status: { name: 'Done' },
              issuetype: { name: 'Story' },
            },
          },
        }],
        subtasks: [],
        comment: { comments: [{ author: { displayName: 'TL' }, created: '2026-05-02T00:00:00.000+0000', body: jiraDoc('Use API contract') }] },
      },
    });
    if (url.pathname === '/rest/api/3/issue/TL-2') return jsonResponse({
      id: '10002',
      key: 'TL-2',
      fields: {
        summary: 'BE Membership Search',
        description: jiraDoc('Backend endpoint exists'),
        status: { name: 'Done' },
        assignee: { displayName: 'Senku Ishigami' },
        issuetype: { name: 'Story' },
        priority: { name: 'High' },
        created: '2026-05-01T00:00:00.000+0000',
        updated: '2026-05-02T00:00:00.000+0000',
        issuelinks: [],
        subtasks: [],
        comment: { comments: [] },
      },
    });

    return jsonResponse({ errorMessages: [`Unexpected mock URL: ${url.pathname}`] }, 404);
  };
}

function jiraDoc(text: string): object {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function snapshotEnv(keys: readonly string[]): Map<string, string | undefined> {
  return new Map(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Map<string, string | undefined>): void {
  for (const [key, value] of snapshot) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
