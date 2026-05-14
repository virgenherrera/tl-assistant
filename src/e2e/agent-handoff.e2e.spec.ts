import { Test } from '@nestjs/testing';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { AgentHandoffModule } from '#agent-handoff';
import { AGENT_HANDOFF_OUTPUT_DIR } from '#agent-handoff/providers';
import { AgentHandoffService } from '#agent-handoff/services';

const execFileAsync = promisify(execFile);

describe('Agent handoff sandbox e2e integration', () => {
  it('creates a disposable sandbox with file-first prompts and passes audit for allowed changes', async () => {
    // Arrange
    const tempDir = await mkdtemp(join(tmpdir(), 'tl-assistant-agent-handoff-e2e-'));
    const repoPath = await createDummyRepo(tempDir);
    const outputDir = join(tempDir, '.tl-assistant', 'agent-runs');
    const moduleRef = await Test.createTestingModule({ imports: [AgentHandoffModule] })
      .overrideProvider(AGENT_HANDOFF_OUTPUT_DIR)
      .useValue(outputDir)
      .compile();
    const handoff = moduleRef.get(AgentHandoffService);

    // Act
    const result = await handoff.createHandoff({
      runId: 'TL-1',
      repoPath,
      allowedPaths: ['src/**'],
      maxFilesChanged: 2,
      maxLinesChanged: 20,
      task: 'Change the greeting implementation only.',
    });
    await writeFile(join(result.sandboxPath, 'src', 'hello.ts'), 'export const hello = () => "hola";\n', 'utf8');
    await writeFile(join(result.sandboxPath, 'AGENT_OUTPUT.md'), '# Agent output\n\n## What changed\nUpdated greeting.\n', 'utf8');
    const report = await handoff.audit({ runPath: result.runDir });

    // Assert
    const task = await readFile(join(result.sandboxPath, '.agent-handoff', 'TASK.md'), 'utf8');
    const baseline = await readFile(result.baselinePath, 'utf8');
    const auditReport = await readFile(report.reportPath, 'utf8');

    expect(result.sandboxPath).not.toBe(repoPath);
    expect(task).toContain('Trabajá file-first');
    expect(task).toContain('Change the greeting implementation only.');
    expect(baseline).toContain('tl-assistant.agent-handoff-baseline.v1');
    expect(report.result).toBe('PASS');
    expect(report.changedFiles).toEqual(['src/hello.ts']);
    expect(auditReport).toContain('## Result: PASS');
  });

  it('fails audit when the agent edits forbidden or outside-allowlist files', async () => {
    // Arrange
    const tempDir = await mkdtemp(join(tmpdir(), 'tl-assistant-agent-handoff-fail-e2e-'));
    const repoPath = await createDummyRepo(tempDir);
    const outputDir = join(tempDir, '.tl-assistant', 'agent-runs');
    const moduleRef = await Test.createTestingModule({ imports: [AgentHandoffModule] })
      .overrideProvider(AGENT_HANDOFF_OUTPUT_DIR)
      .useValue(outputDir)
      .compile();
    const handoff = moduleRef.get(AgentHandoffService);

    // Act
    const result = await handoff.createHandoff({ runId: 'TL-2', repoPath, allowedPaths: ['src/**'] });
    await writeFile(join(result.sandboxPath, 'package.json'), '{"scripts":{"build":"nope"}}\n', 'utf8');
    await writeFile(join(result.sandboxPath, 'AGENT_OUTPUT.md'), '# Agent output\n', 'utf8');
    const report = await handoff.audit({ runPath: result.runDir });

    // Assert
    expect(report.result).toBe('FAIL');
    expect(report.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'Changed files outside allowed paths.', files: ['package.json'] }),
      expect.objectContaining({ message: 'Changed forbidden files.', files: ['package.json'] }),
    ]));
  });
});

async function createDummyRepo(tempDir: string): Promise<string> {
  const repoPath = join(tempDir, 'dummy-repo');
  await mkdir(join(repoPath, 'src'), { recursive: true });
  await writeFile(join(repoPath, 'src', 'hello.ts'), 'export const hello = () => "hello";\n', 'utf8');
  await writeFile(join(repoPath, 'package.json'), '{"name":"dummy"}\n', 'utf8');
  await git(['init'], repoPath);
  await git(['add', '.'], repoPath);
  await git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'chore: initial'], repoPath);
  return repoPath;
}

async function git(args: readonly string[], cwd: string): Promise<void> {
  await execFileAsync('git', [...args], { cwd });
}
