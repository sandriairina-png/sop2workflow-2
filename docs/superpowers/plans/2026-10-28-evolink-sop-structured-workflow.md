# EvoLink SOP Structured Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert an anonymous user's ERP SOP into editable, validated structured workflow JSON through EvoLink, render real branches for human review, and compile the approved result into an importable n8n workflow with a lightweight bad-case regression record.

**Architecture:** A dedicated Next.js server route calls EvoLink and validates a versioned intermediate representation with Zod. Pure client-independent compiler code converts only validated analysis JSON into deterministic n8n nodes and connections; the landing-page studio renders the intermediate graph and locks export until review confirmation. Anonymous spend is bounded with durable daily counters stored atomically in the existing Postgres `config` table plus best-effort in-process interval and concurrency guards.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Drizzle/Postgres, EvoLink OpenAI-compatible Chat Completions, Node test runner, existing Tailwind/CSS UI.

**Spec:** `docs/superpowers/specs/2026-10-28-evolink-sop-structured-workflow-design.md`

## Global Constraints

- Default provider route is `https://direct.evolink.ai/v1/chat/completions` with model `gemini-3.8-flash`.
- `EVOLINK_API_KEY` is server-only and must never appear in client code, responses, logs, tests, or commits.
- Anonymous debugging access remains enabled; no login is required.
- Maximum SOP length is 4,000 characters.
- Default limits are 10 seconds between requests, 20 requests per client per UTC day, 200 total requests per UTC day, 6,000 output tokens, 45 seconds provider timeout, and best-effort concurrency 3.
- Raw SOP and raw model output are not persisted or logged.
- Export remains `active: false` and is unavailable until the user confirms review.
- Any edit invalidates confirmation; the edited JSON must pass schema and graph validation again before export.
- Generic control flow must be executable after import; unknown customer endpoints, credentials, channels, and field mappings remain clearly marked configuration items.
- Chinese and English landing workspaces remain functional.

## Review Focus

- A condition that mentions two outcomes in one sentence must produce two distinct connections, not sequential nodes; pinned by Task 2 compiler tests and Task 4 preview tests.
- A threshold exactly on the boundary must use the intended inclusive operator; pinned by Task 1 schema fixtures and Task 2 compiler tests for 4,999/5,000/5,001.
- A notification sentence containing the word “审批” must remain a notification after a rejection branch; pinned by Task 1 validation fixture and Task 2 node mapping test.
- A malformed or disconnected model graph must return a stable validation error and never enable export; pinned by Task 1 graph validation tests and Task 3 route tests.
- Provider timeout, quota exhaustion, and missing API configuration must expose stable safe errors without provider details; pinned by Task 3 route tests.

---

### Task 1: Versioned analysis schema, graph validation, and prompts

**Files:**
- Create: `src/shared/lib/sop-workflow/schema.ts`
- Create: `src/shared/lib/sop-workflow/graph.ts`
- Create: `src/shared/lib/sop-workflow/prompt.ts`
- Create: `src/shared/lib/sop-workflow/schema.test.ts`
- Modify: `src/shared/lib/sop-workflow.ts`

**Interfaces:**
- Produces: `SopAnalysisSchema`, `SopAnalysis`, `SopStep`, `SopConnection`, `TriggerHint`, `validateSopAnalysisGraph(analysis: SopAnalysis): SopAnalysis`, `buildSopAnalysisMessages(input): Array<{role; content}>`.
- Consumes: no new application interfaces.

- [ ] **Step 1: Write failing schema and graph tests**

Add tests named `accepts a branched inventory analysis`, `rejects duplicate and missing step references`, `rejects a condition with fewer than two branches`, `preserves an inclusive 5000 threshold`, `keeps rejection notification semantic`, and `rejects secret-like generated values`. Assert Zod parsing and graph validation behavior against full fixtures.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --import tsx --test src/shared/lib/sop-workflow/schema.test.ts`

Expected: FAIL because the schema and validators do not exist.

- [ ] **Step 3: Implement the versioned Zod schema**

In `schema.ts`, export the exact types and schemas from the design, including typed condition operands/operators, risk levels, trigger schedule, actors, integrations, error handling, deployment checklist, and tests.

- [ ] **Step 4: Implement graph and safety validation**

In `graph.ts`, implement `validateSopAnalysisGraph(analysis: SopAnalysis): SopAnalysis` to reject duplicate IDs, missing targets, invalid branch counts, unreachable nodes, non-terminal dead ends, unlabelled conditions, and secret-like values. Permit explicit retry/rework cycles while still requiring a reachable terminal path.

- [ ] **Step 5: Implement the extraction prompt**

In `prompt.ts`, export `SOP_ANALYSIS_SYSTEM_PROMPT` and `buildSopAnalysisMessages({ sop, locale, triggerHint })`. Require JSON only, semantic step splitting, owners, true branch topology, bad cases, SOP-specific checklist/tests/risks, no credentials or invented endpoints, and n8n-expression-compatible field paths only when grounded by the SOP.

- [ ] **Step 6: Replace the old library entrypoint with compatibility exports**

Keep `src/shared/lib/sop-workflow.ts` as a thin export surface for shared types, prompts, examples, and the compiler added in Task 2; remove browser-only deterministic generation after Task 4 switches callers.

- [ ] **Step 7: Run the focused tests**

Run: `node --import tsx --test src/shared/lib/sop-workflow/schema.test.ts`

Expected: all Task 1 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/lib/sop-workflow.ts src/shared/lib/sop-workflow
git commit -m "feat: define structured SOP analysis schema"
```

### Task 2: Deterministic n8n compiler

**Files:**
- Create: `src/shared/lib/sop-workflow/compiler.ts`
- Create: `src/shared/lib/sop-workflow/compiler.test.ts`
- Modify: `src/shared/lib/sop-workflow.ts`
- Modify: `src/shared/lib/sop-workflow.test.ts`

**Interfaces:**
- Consumes: `SopAnalysis` and graph validation from Task 1.
- Produces: `compileN8nWorkflow(analysis: SopAnalysis): N8nWorkflow`, `SopWorkflowResult`, `N8nNode`, and `N8nWorkflow`.

- [ ] **Step 1: Write failing compiler tests**

Cover schedule inference parameters, inventory true/false connections, a 5,000 threshold using `greaterThanOrEqual`, rejection-to-notification mapping, multi-case Switch output indexes, Merge connections, HTTP Request placeholders without secrets, and `active: false`.

- [ ] **Step 2: Run compiler tests and verify failure**

Run: `node --import tsx --test src/shared/lib/sop-workflow/compiler.test.ts`

Expected: FAIL because `compileN8nWorkflow` does not exist.

- [ ] **Step 3: Implement node mapping and typed condition compilation**

Implement `compileN8nWorkflow(analysis: SopAnalysis): N8nWorkflow` with stable IDs, deterministic columns/lanes, and the mapping defined in the spec. Compile condition operands to n8n expressions and map true/false/case/error edges to correct output indexes.

- [ ] **Step 4: Implement configuration markers**

Unknown endpoints, credentials, notification channels, and field maps must use explicit placeholders and add node-specific configuration requirements to the returned review result; never emit empty Code nodes as generic actions.

- [ ] **Step 5: Update legacy tests to use fixtures or compatibility exports**

Remove assertions tied to straight-line local parsing and preserve tests for valid n8n trigger structure, unique names/IDs, complete connection references, and localized review summaries.

- [ ] **Step 6: Run all workflow library tests**

Run: `node --import tsx --test src/shared/lib/sop-workflow.test.ts src/shared/lib/sop-workflow/*.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/lib/sop-workflow.ts src/shared/lib/sop-workflow.test.ts src/shared/lib/sop-workflow
git commit -m "feat: compile structured SOPs to n8n"
```

### Task 3: EvoLink client, anonymous quota, and analysis API

**Files:**
- Create: `src/shared/lib/sop-workflow/evolink.ts`
- Create: `src/shared/lib/sop-workflow/evolink.test.ts`
- Create: `src/shared/models/sop_workflow_quota.ts`
- Create: `src/shared/models/sop_workflow_quota.test.ts`
- Create: `src/app/api/sop-workflow/analyze/route.ts`
- Create: `src/app/api/sop-workflow/analyze/route.test.ts`
- Modify: `src/config/index.ts`

**Interfaces:**
- Consumes: Task 1 messages/schema/graph validation and existing `config` database table.
- Produces: `analyzeSopWithEvolink(input, deps?): Promise<SopAnalysisResponse>`, `consumeSopWorkflowQuota(input): Promise<QuotaDecision>`, and `POST(request: Request): Promise<Response>`.

- [ ] **Step 1: Write failing EvoLink client tests**

Mock `fetch` and assert the exact endpoint/model, bearer header presence without logging, JSON-only message payload, 6,000 output token cap, 45-second abort, usage normalization, Markdown-fence JSON extraction, and one bounded repair request after a schema-invalid successful response.

- [ ] **Step 2: Implement `analyzeSopWithEvolink`**

Use native server-side `fetch`, configurable `EVOLINK_API_URL`/`EVOLINK_MODEL`, server-only `EVOLINK_API_KEY`, `AbortController`, and Task 1 validation. Return only validated analysis plus normalized model/request/usage metadata.

- [ ] **Step 3: Run EvoLink client tests**

Run: `node --import tsx --test src/shared/lib/sop-workflow/evolink.test.ts`

Expected: PASS.

- [ ] **Step 4: Write failing durable quota tests**

Test atomic daily counter behavior for 10-second interval, 20/client/day, 200/global/day, UTC rollover, hashed client storage, and database-unavailable fail-closed behavior. Use an injected quota-store dependency so tests do not require production Postgres.

- [ ] **Step 5: Implement the quota model**

Implement `consumeSopWorkflowQuota({ clientHash, now, limits, store? })` with one UTC-day JSON document in the existing `config` table under `sop-workflow-quota:YYYY-MM-DD`. Lock/update atomically in a transaction, store only salted client hashes and counts, and prune stale day keys opportunistically.

- [ ] **Step 6: Write failing API route tests**

Test invalid content type, empty/over-4,000 SOP, unsupported locale/hint, too-frequent and exhausted quota, missing provider configuration, provider timeout, malformed model output, success response shape, `cache-control: no-store`, and absence of provider error/key details.

- [ ] **Step 7: Implement `POST /api/sop-workflow/analyze`**

Parse and validate input, derive a salted client hash from forwarded IP plus a first-party anonymous cookie, enforce quota before provider invocation, apply in-process concurrency 3 as defense-in-depth, call the EvoLink client, and return stable status/error codes. Log only request ID, model, duration, status, and token totals.

- [ ] **Step 8: Run Task 3 tests**

Run: `node --import tsx --test src/shared/lib/sop-workflow/evolink.test.ts src/shared/models/sop_workflow_quota.test.ts src/app/api/sop-workflow/analyze/route.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/config/index.ts src/shared/lib/sop-workflow src/shared/models/sop_workflow_quota.ts src/shared/models/sop_workflow_quota.test.ts src/app/api/sop-workflow/analyze
git commit -m "feat: add protected Evolink SOP analysis API"
```

### Task 4: Branch-aware review UI and confirmation-gated export

**Files:**
- Create: `src/themes/default/blocks/sop-workflow-graph.tsx`
- Create: `src/themes/default/blocks/sop-workflow-graph.test.tsx`
- Modify: `src/themes/default/blocks/sop-workflow-studio.tsx`
- Modify: `src/themes/default/blocks/sop-workflow-studio.module.css`
- Modify: `src/config/locale/messages/zh/pages/index.json`
- Modify: `src/config/locale/messages/en/pages/index.json`

**Interfaces:**
- Consumes: API response from Task 3 and `compileN8nWorkflow` from Task 2.
- Produces: branch-aware preview, review state, confirmation-gated copy/download, dynamic checklist/assumptions/missing information/risks/tests.
- Produces: branch-aware preview, editable analysis JSON, validation state, confirmation-gated copy/download, dynamic checklist/assumptions/missing information/risks/tests.

- [ ] **Step 1: Write failing graph component tests**

Assert an inventory fixture renders two labeled lanes, a multi-case fixture renders all Switch cases, an error edge is visually labeled, and no straight-line fallback replaces supplied branch data.

- [ ] **Step 2: Run graph tests and verify failure**

Run: `node --import tsx --test src/themes/default/blocks/sop-workflow-graph.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `SopWorkflowGraph`**

Render nodes from `steps` and edges from `steps[].next`, with semantic icons, true/false/case/error labels, desktop lanes, mobile stacked branches, merge/rework affordances, and accessible text equivalents.

- [ ] **Step 4: Replace local generation with the API call**

Make `generate` async, POST `{ sop, locale, triggerHint }`, map current trigger buttons to `auto/manual/schedule/webhook`, display safe API errors and retry timing, and reset review confirmation whenever input or result changes.

- [ ] **Step 5: Add human review gate**

Compile the n8n JSON after validated analysis arrives but disable copy/download until a localized “我已检查分支、假设和待配置项” checkbox is selected. Keep the result status as “待人工确认” until selected.

- [ ] **Step 6: Add structured JSON editing and revalidation**

Show the intermediate `SopAnalysis` JSON in an editable text area. Any edit changes status to “edited, validation required”, preserves the last valid preview, clears confirmation, and disables export. A validate action parses and runs Task 1 schema/graph validation; success replaces the active analysis and recompiles n8n, while failure shows actionable errors without destroying the last valid version.

- [ ] **Step 7: Render dynamic setup sections**

Show deployment checklist, assumptions, missing information, risk cards, and scenario tests from the API response. Remove static generated checklist assumptions from the browser library.

- [ ] **Step 8: Update localized product copy**

Replace “仅在浏览器本地处理” and deterministic-preview claims with accurate server-analysis/privacy copy in Chinese and English. Add localized errors, review/edit/validate labels and states, risks, missing-information, quota, timeout, and model-analysis states.

- [ ] **Step 9: Run component and locale tests**

Run: `node --import tsx --test src/themes/default/blocks/sop-workflow-graph.test.tsx src/config/locale/*.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/themes/default/blocks/sop-workflow-graph.tsx src/themes/default/blocks/sop-workflow-graph.test.tsx src/themes/default/blocks/sop-workflow-studio.tsx src/themes/default/blocks/sop-workflow-studio.module.css src/config/locale/messages/zh/pages/index.json src/config/locale/messages/en/pages/index.json
git commit -m "feat: add branch-aware SOP review workspace"
```

### Task 5: End-to-end fixtures, configuration, and release verification

**Files:**
- Create: `src/shared/lib/sop-workflow/fixtures.ts`
- Create: `src/shared/lib/sop-workflow/e2e.test.ts`
- Create: `src/shared/lib/sop-workflow/evaluation-cases.json`
- Create: `src/shared/lib/sop-workflow/evaluation.test.ts`
- Create: `docs/evaluation/sop-model-iteration-log.md`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: all Tasks 1-4.
- Produces: reproducible fixture coverage, documented server configuration, and verified production build.

- [ ] **Step 1: Add representative ERP fixtures**

Create typed fixtures for daily inventory branching, 5,000 expense approval boundary, approval rejection notification, comma-separated multi-step SOP, missing integration configuration, and malformed graph responses.

- [ ] **Step 2: Write end-to-end pure pipeline tests**

For every valid fixture, validate analysis, compile n8n JSON, assert every connection target exists, assert the expected If/Switch/HTTP/notification nodes, assert dynamic checklist/test content, and assert no secret-like value appears in serialized output.

- [ ] **Step 3: Add the lightweight evaluation set and iteration log**

Store redacted/synthetic cases with expected trigger, branch count, semantic operations, node types, and critical risks/tests. Include the initial bad-case categories: implicit condition omission, parallel work serialized, actor confusion, approval keyword misclassification, missing rejection path, fixed deployment copy, and empty Code-node export. Record `promptVersion` and `model` on every case and document the adjustment/regression history in `docs/evaluation/sop-model-iteration-log.md`.

- [ ] **Step 4: Add offline evaluation tests**

Validate saved normalized outputs against each case's expected invariants without calling EvoLink. Add a separately invoked `eval:sop:live` script placeholder that requires explicit `EVOLINK_API_KEY` and never runs under the default test command.

- [ ] **Step 5: Run the complete test suite**

Run: `node --import tsx --test src/**/*.test.ts src/**/*.test.tsx`

Expected: all tests PASS.

- [ ] **Step 6: Document environment configuration**

Add `EVOLINK_API_KEY`, `EVOLINK_API_URL`, `EVOLINK_MODEL`, and quota override variables to `.env.example` and `README.md`, explicitly marking the key server-only and documenting Vercel configuration without including a value.

- [ ] **Step 7: Run static verification**

Run: `pnpm exec tsc --noEmit`

Expected: exit 0.

Run: `pnpm lint`

Expected: exit 0 with no new errors.

Run: `pnpm build`

Expected: production build succeeds and includes `/api/sop-workflow/analyze`.

- [ ] **Step 8: Run a secret scan and diff check**

Run: `git diff --check && ! git grep -nE 'sk-[A-Za-z0-9_-]{20,}' -- ':!pnpm-lock.yaml'`

Expected: exit 0 and no key-like match.

- [ ] **Step 9: Perform local browser verification**

Verify Chinese and English: submit each representative SOP, inspect branch labels and dynamic setup data, edit analysis JSON, confirm export remains locked before revalidation, validate, confirm, download JSON, and import-check its node/connection structure.

- [ ] **Step 10: Commit**

```bash
git add .env.example README.md src/shared/lib/sop-workflow docs/evaluation/sop-model-iteration-log.md package.json
git commit -m "test: verify AI SOP workflow pipeline"
```

- [ ] **Step 11: Configure and deploy only after a fresh Key is supplied outside source control**

Set `EVOLINK_API_KEY` as a Vercel Production/Preview secret, deploy from `main`, verify HTTP 200 and the API's safe behavior, and inspect recent production logs for runtime errors and 5xx responses.

## Self-review

- Spec coverage: provider, schema, graph validation, branches, dynamic deployment content, compiler, human review, quota, privacy, localization, and verification are each owned by a task.
- Step scan: every implementation step names a file, interface, behavior, and focused verification command.
- Type consistency: `SopAnalysis` is the only model-to-UI/compiler contract; `compileN8nWorkflow` consumes it; the API returns it unchanged after validation.
- Review focus: all five high-risk classes have explicit tests assigned to Tasks 1-4.
- Proportion: plan describes boundaries and tests without transcribing function bodies.

