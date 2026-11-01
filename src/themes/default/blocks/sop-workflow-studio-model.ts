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
