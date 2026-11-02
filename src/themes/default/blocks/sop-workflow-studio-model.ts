import {
  ConfirmationQuestion,
  SopAnalysis,
  SopAnalysisSchema,
  SopClarification,
  SopStepSource,
  validateSopAnalysisGraph,
} from '@/shared/lib/sop-workflow';

export type WorkflowGraphRow = {
  step: SopAnalysis['steps'][number];
  edges: Array<{
    targetStepId: string;
    label: string;
    branch: string;
  }>;
};

export function buildWorkflowGraphRows(
  analysis: SopAnalysis
): WorkflowGraphRow[] {
  return analysis.steps.map((step) => ({
    step,
    edges: step.next.map((edge) => ({
      targetStepId: edge.targetStepId,
      label: edge.label,
      branch: edge.branch,
    })),
  }));
}

export function validateAnalysisDraft(draft: string) {
  return validateSopAnalysisGraph(SopAnalysisSchema.parse(JSON.parse(draft)));
}

type DraftErrorCopy = {
  syntax: string;
  schema: string;
  duplicate: string;
  unknownActor: string;
  tooFewBranches: string;
  unknownTarget: string;
  unlabelled: string;
  missingCondition: string;
  unknownErrorTarget: string;
  unreachable: string;
  noEnd: string;
  secret: string;
  generic: string;
};

// Turns validation failures from the advanced editor into business language.
// Templates use {step}, {branch} and {steps}; step ids become step titles.
export function describeDraftError(
  error: unknown,
  draft: string,
  copy: DraftErrorCopy
) {
  if (error instanceof SyntaxError) return copy.syntax;
  const message = error instanceof Error ? error.message : '';
  if (error && typeof error === 'object' && 'issues' in error) {
    return copy.schema;
  }
  let titles = new Map<string, string>();
  try {
    const parsed = JSON.parse(draft) as {
      steps?: Array<{ id?: string; title?: string }>;
    };
    titles = new Map(
      (parsed.steps || []).map((step) => [
        String(step.id),
        step.title || String(step.id),
      ])
    );
  } catch {
    // The message is still translated without titles.
  }
  const title = (id: string) => `「${titles.get(id) || id}」`;
  const fill = (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [
      /^Duplicate step id: (.+)$/,
      (m) => fill(copy.duplicate, { step: title(m[1]) }),
    ],
    [
      /^Step (\S+) references unknown actor/,
      (m) => fill(copy.unknownActor, { step: title(m[1]) }),
    ],
    [
      /^Condition (\S+) must have at least two branches/,
      (m) => fill(copy.tooFewBranches, { step: title(m[1]) }),
    ],
    [
      /^Step (\S+) error path references unknown step/,
      (m) => fill(copy.unknownErrorTarget, { step: title(m[1]) }),
    ],
    [
      /^Step (\S+) references unknown step/,
      (m) => fill(copy.unknownTarget, { step: title(m[1]) }),
    ],
    [
      /^Step (\S+) contains an unlabelled connection/,
      (m) => fill(copy.unlabelled, { step: title(m[1]) }),
    ],
    [
      /^Condition (\S+) branch (.+) requires operands/,
      (m) =>
        fill(copy.missingCondition, {
          step: title(m[1]),
          branch: `「${m[2]}」`,
        }),
    ],
    [
      /unreachable through next: ([^.]+)\./,
      (m) =>
        fill(copy.unreachable, {
          steps: m[1].split(', ').map(title).join('、'),
        }),
    ],
    [/reachable terminal path/, () => copy.noEnd],
    [/secret-like value/, () => copy.secret],
  ];
  for (const [pattern, render] of rules) {
    const match = message.match(pattern);
    if (match) return render(match);
  }
  return copy.generic;
}

export function resolveWorkflowError(
  code: string,
  copy: {
    fallback: string;
    timeout: string;
    provider: string;
    invalidOutput?: string;
    byCode?: Record<string, string | undefined>;
  }
) {
  const retryable = [
    'provider_timeout',
    'provider_error',
    'invalid_output',
    'internal_error',
    'transport_error',
    'busy',
    'too_frequent',
  ].includes(code);
  const message =
    copy.byCode?.[code] ||
    (code === 'provider_timeout'
      ? copy.timeout
      : code === 'invalid_output'
        ? copy.invalidOutput || copy.provider
        : ['provider_error', 'internal_error', 'transport_error'].includes(code)
          ? copy.provider
          : copy.fallback);

  return { message, retryable };
}

export function getStepSourceBadge(
  source: SopStepSource,
  labels: {
    sourceText: string;
    aiInferred: string;
    needsConfirmation: string;
  }
) {
  if (source === 'source_text') {
    return { label: labels.sourceText, tone: 'confirmed' as const };
  }
  if (source === 'ai_inferred') {
    return { label: labels.aiInferred, tone: 'inferred' as const };
  }
  return { label: labels.needsConfirmation, tone: 'warning' as const };
}

export function buildClarificationAnswers(
  questions: ConfirmationQuestion[],
  selected: Record<string, string>,
  custom: Record<string, string>
): SopClarification[] {
  return questions.flatMap((question) => {
    const selectedValue = selected[question.id];
    if (!selectedValue) return [];
    const answer =
      selectedValue === '__custom__'
        ? custom[question.id]?.trim()
        : question.options.find((option) => option.value === selectedValue)
            ?.label;
    if (!answer) return [];
    return [{ questionId: question.id, question: question.question, answer }];
  });
}

// The API accepts at most 20 clarifications per request.
const MAX_CLARIFICATIONS = 20;

// Answers accumulate across regeneration rounds; a newer answer to the same
// question replaces the older one.
export function mergeClarifications(
  existing: SopClarification[],
  next: SopClarification[]
): SopClarification[] {
  const merged = new Map<string, SopClarification>();
  for (const item of [...existing, ...next]) {
    merged.delete(item.questionId);
    merged.set(item.questionId, item);
  }
  return [...merged.values()].slice(-MAX_CLARIFICATIONS);
}

// Every pending item becomes an answerable card. When the model listed missing
// information without turning it into questions, offer generic options so the
// user can still answer it. Already answered questions are hidden.
export function resolveConfirmationQuestions(
  analysis: Pick<SopAnalysis, 'confirmationQuestions' | 'missingInformation'>,
  answered: SopClarification[],
  labels: { conventional: string; configureLater: string },
  options: { includeMissingInformation: boolean } = {
    includeMissingInformation: true,
  }
): ConfirmationQuestion[] {
  const answeredIds = new Set(answered.map((item) => item.questionId));
  const answeredText = new Set(answered.map((item) => item.question.trim()));
  const questions: ConfirmationQuestion[] = analysis.confirmationQuestions
    .length
    ? analysis.confirmationQuestions
    : options.includeMissingInformation
      ? analysis.missingInformation
          .filter((item) => !answeredText.has(item.trim()))
          .slice(0, 3)
          .map((item) => ({
            // Content-based id: positions shift between rounds, text does not.
            id: `missing:${item.trim().slice(0, 100)}`,
            question: item,
            options: [
              { value: 'conventional', label: labels.conventional },
              { value: 'configure_later', label: labels.configureLater },
            ],
            allowCustom: true,
          }))
      : [];
  return questions
    .filter(
      (question) =>
        !answeredIds.has(question.id) &&
        !answeredText.has(question.question.trim())
    )
    .map((question) => ({ ...question, allowCustom: true }));
}
