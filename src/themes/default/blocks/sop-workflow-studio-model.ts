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
