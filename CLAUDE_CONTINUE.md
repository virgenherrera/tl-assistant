# Claude continuation handoff

## Context

The user is refining API contracts for PriceSmart MOT signup/onboarding. The client rejected a cleaner multi-service architecture and forced a pragmatic monolith approach, so the working contract draft assumes a new logical Nest module inside `membership-service` while preserving internal boundaries.

Current important local artifacts:

- `.tl-assistant/manual/signup-workflow-monolith-api-contract-evidence.md` — local ignored draft with current API contract proposal and repo evidence.
- `.tl-assistant/confluence/pages/1055228426.md` — local ignored Confluence export for business rules.
- `continuar.txt` — local scratch handoff file; do not commit unless the user explicitly asks.

## What was implemented

A read-only Confluence capability was added to TL Assistant:

```bash
pnpm dev -- confluence:doctor
pnpm dev -- confluence:page 1055228426
pnpm dev -- confluence:search "membership business rules"
```

Important constraints:

- Atlassian access must remain read-only.
- Only `GET` requests are allowed for Confluence/Jira capabilities.
- Do not write Confluence comments/pages.
- Do not write Jira comments, transitions, or mutations.
- Do not run build.

## Validation already performed

```bash
pnpm typecheck
pnpm test
```

Both passed before this handoff.

## Next recommended work

1. Read `.tl-assistant/confluence/pages/1055228426.md` locally.
2. Extract business rules relevant to:
   - signup workflow progress/draft persistence;
   - membership activation;
   - primary/secondary cardholders;
   - payment dependency;
   - email/cellphone verification;
   - final SQL commit.
3. Update `.tl-assistant/manual/signup-workflow-monolith-api-contract-evidence.md` with a new section:

   ```md
   ## Business rules from Confluence
   Fuente: `foundation://confluence/900431921/1055228426`
   ```

4. Keep evidence summarized; do not paste huge raw Confluence dumps into user-facing output.
5. If implementing Jira → Confluence discovery later, create a read-only command such as:

   ```bash
   pnpm dev -- confluence:from-jira OTPSMT-1115
   ```

   It should inspect Jira issue description/comments/remote links using `GET` only, extract Confluence URLs/page IDs, then call the existing Confluence reader.

## Relevant tracked files

- `src/confluence-context/**` — new read-only Confluence module.
- `src/config/configurations/confluence.config.ts` — Confluence config with fallback to Jira Atlassian credentials.
- `src/config/configurations/foundation-docs.config.ts` — changed to avoid blocking unrelated commands when optional local foundation path is unreadable.
- `.env.example` — documents optional `CONFLUENCE_*` variables.
- `CLAUDE_CONTINUE.md` — this handoff.

## User style preference

Spanish/Rioplatense, direct, warm, senior TL energy. Validate claims before agreeing. If unsure, inspect code/docs first.
