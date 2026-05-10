# Agent handoff sandbox

`agent:handoff` prepares a disposable local clone for weak/file-first agents such as Frida. The agent gets explicit prompt files and TL Assistant keeps an auditable baseline before any agent work happens.

## Create a handoff

```bash
pnpm dev -- agent:handoff OTPSMT-1422 \
  --repo ../target-repo \
  --allow "src/membership/**" \
  --allow "test/membership/**" \
  --max-files 8 \
  --max-lines 400 \
  --task "Refine/implement only the membership search slice."
```

Generated under `.tl-assistant/agent-runs/{RUN_ID}/`:

- `sandbox/` — disposable clone opened by the external agent.
- `AUDIT_BASELINE.json` — branch, HEAD, allowed paths, forbidden paths, and budgets.
- `TASK.md`, `CONTEXT.md`, `ALLOWED_PATHS.md`, `FORBIDDEN_ACTIONS.md`, `ACCEPTANCE_CHECKLIST.md`, `EXPECTED_OUTPUT.md`.

The sandbox also contains the same files under `.agent-handoff/` for VS Code/Frida file-first usage.

## Agent rules

The agent must stay inside allowed paths and write `AGENT_OUTPUT.md` at the sandbox root. Dependency manifests, lockfiles, `.env*`, generated output, dependency folders, and build artifacts are forbidden by default.

## Audit after agent work

```bash
pnpm dev -- agent:audit .tl-assistant/agent-runs/OTPSMT-1422
```

The audit writes `AUDIT_REPORT.md` and returns `PASS`, `WARN`, or `FAIL` based on:

- changed files outside allowlist;
- forbidden path edits;
- changed file count and line budget;
- `git diff --check` whitespace/conflict-marker failures;
- missing `AGENT_OUTPUT.md`.

No build command is executed by handoff or audit.
