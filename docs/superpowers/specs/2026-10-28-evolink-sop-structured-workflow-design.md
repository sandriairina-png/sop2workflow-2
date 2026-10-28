# EvoLink SOP Structured Workflow Design

## Intent

Replace the deterministic browser-only SOP parser with a server-side AI analysis pipeline that converts a natural-language ERP SOP into a validated, reviewable workflow JSON document. The browser then compiles that document into an importable n8n workflow.

The first release is an anonymous model-debugging release. It does not require sign-in, but it must keep the EvoLink key server-side and protect the account with request, input, output, timeout, and concurrency limits.

## Goals

- Extract business meaning rather than matching isolated keywords.
- Preserve step order, ownership, triggers, decisions, branches, exception paths, and missing information.
- Show real branch topology in the preview.
- Generate deployment checks and risk warnings from the submitted SOP instead of static copy.
- Compile reviewed structured JSON into valid n8n node types and connections.
- Require human review before enabling JSON copy or download.
- Keep provider credentials out of the browser, generated output, logs, and Git history.

## Non-goals

- Connecting to a customer's ERP or validating customer credentials.
- Automatically activating an n8n workflow.
- Guaranteeing that a generated external-system integration runs without customer-specific endpoint and field configuration.
- Persisting SOP content or generated workflows in the debugging release.
- Building login, billing, or user credit deduction in this iteration.

## Provider and model

- Provider: EvoLink OpenAI-compatible Chat Completions endpoint.
- Endpoint: `https://direct.evolink.ai/v1/chat/completions`.
- Default model: `gemini-3.8-flash`.
- Key: server-only `EVOLINK_API_KEY` environment variable.
- Model ID and endpoint are configurable with server-only environment variables so a fallback model can be tested without changing browser code.
- Start with medium reasoning and a bounded output budget. Record only provider request metadata and token totals, never the raw SOP or API key.

`gemini-3.8-flash` is the initial choice because this workload is structured extraction plus multi-step workflow reasoning. It should still be evaluated against representative ERP SOPs before production promotion.

## User flow

1. The user pastes an SOP and chooses an optional trigger hint.
2. The browser sends the SOP, locale, and trigger hint to a dedicated same-origin API.
3. The API validates request size and applies anonymous quota protection.
4. EvoLink returns a fixed-format workflow analysis JSON document.
5. The server extracts JSON, validates it with Zod, normalizes identifiers, and rejects unsafe or malformed output.
6. The browser renders steps and true branch connections from the analysis document.
7. The browser renders SOP-specific assumptions, deployment checks, tests, and risks.
8. The user may edit the structured analysis JSON and run validation again.
9. Copy and download remain locked until the current edited version passes validation and the user explicitly confirms the review.
10. After confirmation, the compiler converts the validated analysis document into n8n workflow JSON and enables export.

## Dedicated API

Create `POST /api/sop-workflow/analyze`.

Request:

```json
{
  "sop": "string",
  "locale": "zh | en",
  "triggerHint": "auto | manual | schedule | webhook"
}
```

Response:

```json
{
  "analysis": {},
  "meta": {
    "model": "gemini-3.8-flash",
    "requestId": "opaque-id",
    "usage": {
      "inputTokens": 0,
      "outputTokens": 0,
      "totalTokens": 0
    }
  }
}
```

The endpoint must return stable error codes for invalid input, throttling, provider timeout, provider rejection, invalid model output, and unavailable configuration.

## Structured analysis schema

The model output is a versioned intermediate representation, not n8n JSON.

```ts
type SopAnalysis = {
  schemaVersion: '1.0';
  title: string;
  summary: string;
  trigger: {
    type: 'manual' | 'schedule' | 'webhook';
    description: string;
    schedule?: { hour: number; minute: number; timezone?: string };
  };
  actors: Array<{
    id: string;
    name: string;
    responsibility: string;
  }>;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    ownerActorId?: string;
    operation:
      | 'read'
      | 'transform'
      | 'write'
      | 'approve'
      | 'notify'
      | 'wait'
      | 'condition'
      | 'merge'
      | 'end';
    integration?: {
      system: string;
      action: string;
      credentialRequired: boolean;
      endpointKnown: boolean;
    };
    inputs: string[];
    outputs: string[];
    next: Array<{
      targetStepId: string;
      label: string;
      condition?: {
        leftValue: string;
        operator:
          | 'equals'
          | 'notEquals'
          | 'greaterThan'
          | 'greaterThanOrEqual'
          | 'lessThan'
          | 'lessThanOrEqual'
          | 'contains'
          | 'isEmpty'
          | 'isNotEmpty';
        rightValue?: string | number | boolean;
        explanation: string;
      };
      branch: 'default' | 'true' | 'false' | 'case' | 'error';
    }>;
    errorHandling: Array<{
      scenario: string;
      action: string;
      targetStepId?: string;
    }>;
  }>;
  assumptions: string[];
  missingInformation: string[];
  deploymentChecklist: string[];
  risks: Array<{
    level: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    mitigation: string;
  }>;
  tests: Array<{
    name: string;
    input: string;
    expected: string;
  }>;
};
```

Validation rules:

- IDs are unique and connections reference existing step IDs.
- At least one trigger and one terminal path exist.
- Condition steps have at least two outgoing branches.
- Branch labels and conditions are explicit.
- Executable conditions use typed operands, operators, and field paths; free-text explanations are review copy only.
- Every non-terminal step has a reachable next step.
- No disconnected or unreachable steps are silently accepted.
- Cycles are allowed only when explicitly described as retry or rework paths.
- Credentials, secrets, real credential IDs, and invented production URLs are forbidden.
- Unknown business rules are listed in `missingInformation` rather than guessed.

## Prompt behavior

The system prompt assigns two roles:

1. ERP process analyst: extract actions, owners, triggers, input/output data, approvals, decisions, exception cases, and missing rules.
2. Workflow architect: express the result in the fixed intermediate schema with explicit directed connections.

Prompt requirements:

- Preserve the SOP's business meaning and order.
- Infer a schedule trigger from phrases such as “每天 9 点” when unambiguous.
- Interpret `if / else`, thresholds, approval outcomes, stock states, and timeout rules as branches.
- Represent rejection, API failure, missing fields, retries, duplicate submissions, and other bad cases.
- Do not collapse two outcomes into one sequential line.
- Do not classify a notification as approval merely because the notification text mentions approval.
- Generate SOP-specific deployment checks, boundary tests, and risks.
- Return JSON only, with no Markdown fence or commentary.
- When a condition references data, use an n8n expression-compatible field path such as `{{$json.inventory}}`; do not invent a field path when the SOP does not establish one.

## Branch preview

The preview uses `steps[].next` as the source of truth.

- A two-way decision renders as an If node with true and false lanes.
- A multi-way decision renders as a Switch node with one lane per case.
- Error connections render separately from the happy path.
- Rework paths can connect back to an earlier node and are visually labeled.
- Merge steps are explicit when branches rejoin.
- The UI must not synthesize a straight line when branch information exists.

## n8n compiler

The compiler is deterministic and runs on validated analysis JSON. The model does not write the final n8n file directly.

Initial mapping:

- trigger manual -> `n8n-nodes-base.manualTrigger`
- trigger schedule -> `n8n-nodes-base.scheduleTrigger`
- trigger webhook -> `n8n-nodes-base.webhook`
- condition with two branches -> `n8n-nodes-base.if`
- condition with more than two branches -> `n8n-nodes-base.switch`
- external API read/write -> `n8n-nodes-base.httpRequest`
- data transform -> `n8n-nodes-base.set` when field mapping is known; otherwise a clearly marked configuration node
- email notification -> `n8n-nodes-base.emailSend`
- generic notification with unknown channel -> a clearly marked, disabled configuration node
- wait -> `n8n-nodes-base.wait`
- merge -> `n8n-nodes-base.merge`
- end -> `n8n-nodes-base.noOp`

The compiler generates stable unique node IDs, deterministic positions, correct output indexes, and n8n `connections`. Unknown customer-specific values use expressions or human-readable placeholders; they never contain secrets.

The exported file is expected to import successfully and execute all generic control-flow logic. Customer-specific HTTP endpoints, credentials, message channels, and field mappings remain clearly marked configuration requirements. The product must never claim that an external integration is immediately runnable when those values are unknown.

Export remains `active: false`. A configuration note identifies every node that still needs credentials, endpoints, channel selection, or field mapping.

## Human review

After generation, the result is marked “待人工确认”. The user can inspect flow, analysis JSON, deployment checklist, assumptions, missing information, risks, and tests.

The analysis tab provides an editable JSON text area. Editing changes the state to “已编辑，待校验”. A validate action parses the JSON, runs the Zod and graph validators, and shows field/graph errors without replacing the last valid result. A successful validation updates the preview and compiled n8n draft, marks the version “校验通过，待确认”, and resets any earlier confirmation. Copy/download buttons stay disabled until the current validated version is explicitly confirmed.

Direct visual graph editing is not part of this iteration. Users edit the structured analysis JSON or revise the source SOP and regenerate.

## Lightweight evaluation and iteration record

Maintain a small, versioned evaluation set that can grow as real SOPs and bad cases are supplied.

Each case records:

- case ID and category;
- synthetic or redacted SOP input;
- expected trigger, semantic steps, branch count, node types, and critical risks/tests;
- actual normalized result or failure summary;
- model ID and prompt version;
- discrepancy classification such as missing implicit condition, serialized parallel work, actor confusion, wrong semantic node, missing rejection path, or invalid n8n mapping;
- adjustment made and regression status.

Add an evaluation runner that validates stored expected invariants against saved normalized fixtures without calling the paid model by default. Live model evaluation is an explicit, separately invoked command so normal tests never consume EvoLink quota. Keep a human-readable iteration log summarizing prompt/schema/compiler changes and the cases they fixed or regressed.

## Anonymous quota protection

The debugging release allows anonymous calls but protects the provider account:

- Key is read only on the server.
- Same-origin POST only; reject unexpected content types.
- Maximum SOP length: 4,000 characters.
- Maximum request body size and bounded output tokens.
- Per-client minimum request interval.
- Per-client rolling quota and a global rolling quota.
- Small server-side concurrency limit.
- Provider timeout with abort control.
- No automatic retry on ambiguous provider errors; at most one schema-repair attempt for a successful but malformed response.
- `cache-control: no-store` on request and response.
- Generic client errors; detailed provider errors are not exposed.

For durable multi-instance limits, store hashed client identifiers and counters in the existing database or a rate-limit store. In-memory limits are defense-in-depth only and must not be described as a production guarantee.

Debugging defaults, all configurable through server-only environment variables:

- Minimum interval: 10 seconds per client.
- Per-client allowance: 20 requests per UTC day.
- Global allowance: 200 requests per UTC day.
- Maximum model output: 6,000 tokens.
- Provider timeout: 45 seconds.
- Best-effort in-process concurrency: 3 requests, backed by the durable global daily cap.

Use the existing Postgres database for atomic daily counters so Vercel instances share the same limits. Store only a salted hash of the client identity. Do not add an anti-bot challenge in this debugging iteration; the durable global hard cap is the spend backstop. Turnstile can be added before broader public access if abuse appears.

## Privacy and logging

- Do not persist SOP input or generated analysis in this release.
- Do not log request bodies, model response bodies, authorization headers, or secrets.
- Log request ID, model, duration, status, token usage, and normalized error code only.
- Update landing copy that currently claims processing is entirely local.

## Tests and acceptance

Use representative Chinese SOP fixtures:

1. Daily 09:00 inventory check: schedule trigger is inferred.
2. Stock sufficient / insufficient: preview and n8n connections split into two branches.
3. Expense below 5,000 / at least 5,000: correct approver paths and boundary tests for 4,999, 5,000, and 5,001.
4. Approval rejected: rejection follows a notification or rework path, not an approval node caused by keyword matching.
5. One long comma-separated SOP: multiple semantic steps are extracted.
6. Missing endpoint and credentials: deployment checklist is specific and export contains no invented secrets.
7. Invalid model JSON: schema repair or stable validation error, never a broken export.
8. Rate limit and timeout: stable 429/504 behavior without provider details.

Acceptance criteria:

- The UI calls the server API instead of the local deterministic generator.
- Flow preview visibly contains branches for branching SOPs.
- Deployment checklist, tests, and risks change with the SOP.
- Export contains real branch node types and meaningful integration node types.
- Download is disabled until human confirmation.
- The browser bundle and network response never contain `EVOLINK_API_KEY`.
- Tests, type checking, linting, and production build pass.

