# Research & Design Decisions: additive-only-schema-check

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.
---

## Summary
- **Feature**: `additive-only-schema-check`
- **Discovery Scope**: Extension (light discovery) — new GitHub Actions workflow + new diff-logic script layered on existing `frontend/` TS/vitest stack and existing `directus-schema-sync.yml` conventions.
- **Key Findings**:
  - Existing `directus-schema-sync.yml` only handles `push`(main) with `git diff --name-only HEAD^ HEAD`; no PR base/head comparison pattern exists yet, but the repo already has a workflow-structure-test convention (`frontend/*.workflow.test.ts`) that is reused here even though the workflow is directus-domain, which supports keeping the new logic in `frontend/` too.
  - `pull_request` event's default checkout is a synthetic merge commit; the reliable way to fetch both sides of the diff is `actions/checkout@v4` with `fetch-depth: 0`, then `git show <sha>:directus/schema/snapshot.yaml` using `github.event.pull_request.base.sha` / `head.sha` directly from the event payload (avoids depending on `origin/<base_ref>` remote-tracking refs, which is more robust for fork PRs and force-pushed branches).
  - Directus snapshot `fields[]` entries for alias/relational fields (o2m, m2m, presentation-only) can have `schema: null` (no physical column). This snapshot currently has none, but the differ must not crash on it — such fields are excluded from type/nullable comparison and only participate in field-existence (add/delete) comparison.
  - No `tsx`/`ts-node` exists yet for running standalone TS scripts outside the Next.js build; introducing `tsx` as a new frontend devDependency is the smallest viable addition to run the checker script directly in CI without a compile step.

## Research Log

### PR base/head snapshot acquisition
- **Context**: R1.1 requires comparing base branch snapshot.yaml vs PR branch snapshot.yaml; existing workflow only ever diffed `HEAD^` vs `HEAD` on a linear push history, which does not generalize to PRs (multiple commits, force-pushes, fork branches).
- **Sources Consulted**: `.github/workflows/directus-schema-sync.yml` (existing pattern), `.github/workflows/frontend-ci.yml` (existing PR trigger config), GitHub Actions `pull_request` event payload fields (`github.event.pull_request.base.sha`, `github.event.pull_request.head.sha`).
- **Findings**: The event payload always carries the exact base/head commit SHAs regardless of fork origin. With `actions/checkout@v4` `fetch-depth: 0`, both commits are present in the local object database (the checkout ref is the merge commit whose ancestry includes both), so `git show <sha>:path` reliably extracts either side's file content without needing branch name resolution.
- **Implications**: Workflow extracts both files via `git show` into temp paths before invoking the checker script; no dependency on `origin/main` tracking refs or shallow-history heuristics.

### Directus snapshot field shape for alias/relational fields
- **Context**: R4 compares `type`, `schema.data_type`, `schema.is_nullable`; need to confirm these keys are always present to avoid null-pointer-style failures in the differ.
- **Sources Consulted**: `directus/schema/snapshot.yaml` (current repo snapshot, 3786 lines) — `fields[]` entries inspected directly (grep for `schema: null` returned 0 matches in the current file).
- **Findings**: Every field in the current snapshot has a populated `schema` block. Directus's own snapshot format (outside this repo) allows `schema: null` for presentation/alias/relational fields with no physical column — this repo simply hasn't added one yet.
- **Implications**: The differ's type/nullable comparison must treat `schema: null` on either side as "not a physical column" and skip type/nullable checks for that field (only existence is compared), rather than assuming a non-null shape.

### Running a standalone TypeScript script in CI
- **Context**: The checker logic needs type safety (project convention, `design-principles.md` §1) but the repo has no existing mechanism to execute a `.ts` file outside of Next.js's own build/vitest pipeline.
- **Sources Consulted**: `frontend/package.json` (no `tsx`/`ts-node`), Node 22 (`actions/setup-node` pins `node-version: 22` in `frontend-ci.yml`).
- **Findings**: Node 22's `--experimental-strip-types` is version/flag-sensitive and not guaranteed stable across the exact 22.x patch GitHub Actions resolves; `tsx` is a small, widely-used devDependency with no such risk and matches the "known pattern" bar for new dependencies.
- **Implications**: Add `tsx` to `frontend/devDependencies`; CI step runs `pnpm exec tsx scripts/check-additive-schema.ts <base> <head>`.

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: Extend `frontend/` | New script + tests inside existing `frontend/` package, following existing `*.workflow.test.ts` convention | Reuses `yaml`/`vitest`, reuses precedent that even directus-domain workflow tests live in `frontend/`, no new package.json/lockfile | `pnpm install --frozen-lockfile` cost on every snapshot-only PR | Already the convention for `directus-schema-sync.yml`'s own tests |
| B: Independent Python/Node component | New standalone script + toolchain under `directus/` | Lightweight CI run, strict domain separation | New test framework (Python) or duplicate Node/lockfile setup (independent Node), no precedent in repo | Rejected: adds toolchain surface without matching existing convention |
| C: Hybrid — TS mini-package under `directus/` | Dedicated lightweight `directus/scripts` package.json (yaml + vitest only) | Keeps TS/vitest familiarity, avoids frontend coupling | Second package.json/lockfile to maintain, duplicated Node/pnpm setup step in CI | Rejected: added maintenance cost not justified given Option A precedent already exists |

**Selected**: Option A, per the existing precedent that workflow-related tests (including for the directus-domain `directus-schema-sync.yml`) already live in `frontend/`.

## Design Decisions

### Decision: Base/head snapshot extraction via event-payload SHAs
- **Context**: Need robust base vs head file content across regular and fork PRs, across force-pushes.
- **Alternatives Considered**:
  1. `git diff origin/<base_ref>...HEAD` — depends on remote-tracking ref naming and can be ambiguous for renamed/deleted branches.
  2. `git show <base.sha>` / `git show <head.sha>` from the event payload — exact commit identity, no name resolution.
- **Selected Approach**: (2) — extract both files with `git show ${{ github.event.pull_request.base.sha }}:directus/schema/snapshot.yaml` and the equivalent `head.sha`, after `actions/checkout@v4` with `fetch-depth: 0`.
- **Rationale**: Deterministic regardless of fork origin or branch renames; payload SHAs are always resolvable once full history is fetched.
- **Trade-offs**: `fetch-depth: 0` is heavier than a shallow clone, but this workflow only runs when `directus/schema/snapshot.yaml` changes (path-filtered), so frequency is low.
- **Follow-up**: None.

### Decision: Ignore-list for non-breaking attribute changes
- **Context**: R5.2 requires meta-only changes (e.g. `note`, `display_template`) to not be flagged; R4 requires only `type`, `schema.data_type`, `schema.is_nullable` (true→false) to be flagged.
- **Selected Approach**: The differ compares only three keys per existing `(collection, field)` pair — `type`, `schema.data_type`, and `schema.is_nullable` (only the `true → false` direction). All `meta.*` keys and all other `schema.*` keys (`default_value`, `is_indexed`, `is_unique`, `is_primary_key`, `is_generated`, `generation_expression`, `numeric_precision`, `numeric_scale`, `max_length`, `foreign_key_table`, `foreign_key_column`, `table`, `name`) are ignored entirely.
- **Rationale**: Matches the exact wording of requirements 4.1/4.2/5.2 without inventing additional breaking-change categories not asked for.
- **Trade-offs**: Some arguably-risky changes (e.g. dropping a unique constraint, changing `foreign_key_table`) are intentionally out of scope for this iteration; documented as a Non-Goal in design.md.
- **Follow-up**: Revisit ignore-list scope in a future spec if incidents show these other attributes need coverage.

### Decision: No automated "reviewer approved" bypass signal for R6.3
- **Context**: R6.3 requires the check to not flip to success "until a reviewer confirms the breaking change is sanctioned per the CLAUDE.md notification flow," but does not mandate a specific mechanism.
- **Alternatives Considered**:
  1. Add a PR label (e.g. `schema-breaking-approved`) that the workflow reads to force success.
  2. Do nothing new in CI: keep the check red; rely on branch protection admin-merge override, mirroring the already-established manual checklist pattern in `directus-schema-sync.yml`'s generated infra PR body.
- **Selected Approach**: (2) — this check has no self-override path. It only turns green when a subsequent commit removes the breaking change from the diff.
- **Rationale**: A label-based override reintroduces exactly the human-error surface (forgetting/mis-clicking a label) that this feature exists to remove, and the repo already has a working precedent (infra PR manual checklist + admin bypass) for legitimately-sanctioned breaking changes.
- **Trade-offs**: Legitimate breaking changes require a repo admin to use branch protection's admin override to merge, same as today's implicit process — this feature does not change that operational step, only adds the automatic detection/visualization.
- **Follow-up**: None; documented as a Non-Goal in design.md so it isn't silently expected in review.

## Risks & Mitigations
- Full-history checkout (`fetch-depth: 0`) increases job runtime — mitigated by path-filtering the workflow trigger so it only runs on `snapshot.yaml`-touching PRs.
- `pnpm install --frozen-lockfile` cost on every snapshot-only PR (Option A trade-off) — accepted; consistent with existing `frontend-ci.yml` cost profile and avoids a second toolchain.
- Alias/relational fields with `schema: null` could cause false negatives if a future collection uses them and a physical-column field is silently converted to alias (data-loss-adjacent) — out of scope per current requirements (only `type`/`data_type`/`is_nullable` transitions are in scope); flagged as a Non-Goal, not silently ignored.

## References
- `.github/workflows/directus-schema-sync.yml` — existing push-triggered schema sync pattern.
- `.github/workflows/frontend-ci.yml` — existing PR-triggered workflow with `pull_request: types: [opened, synchronize, reopened]`.
- `frontend/directus-schema-sync.workflow.test.ts` — existing workflow-structure test convention to follow.
- `directus/schema/snapshot.yaml` — current schema snapshot format (collections/fields/relations top-level keys).
