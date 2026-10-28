import {
  SopAnalysis,
  SopAnalysisSchema,
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
