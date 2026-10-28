import { SopAnalysis, SopAnalysisSchema } from './schema';

const SECRET_PATTERNS = [
  /\bsk-[a-z0-9_-]{16,}\b/i,
  /\b(?:api[_ -]?key|access[_ -]?token|bearer)\s*[:=]\s*[^\s,;]{12,}/i,
  /\b(?:password|secret)\s*[:=]\s*[^\s,;]{8,}/i,
];

export function validateSopAnalysisGraph(input: SopAnalysis): SopAnalysis {
  const analysis = SopAnalysisSchema.parse(input);
  const serialized = JSON.stringify(analysis);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(serialized))) {
    throw new Error('Generated analysis contains a secret-like value.');
  }

  const ids = new Set<string>();
  for (const step of analysis.steps) {
    if (ids.has(step.id)) {
      throw new Error(`Duplicate step id: ${step.id}`);
    }
    ids.add(step.id);
  }

  const actorIds = new Set(analysis.actors.map((actor) => actor.id));
  for (const step of analysis.steps) {
    if (step.ownerActorId && !actorIds.has(step.ownerActorId)) {
      throw new Error(
        `Step ${step.id} references unknown actor ${step.ownerActorId}.`
      );
    }

    if (step.operation === 'condition' && step.next.length < 2) {
      throw new Error(`Condition ${step.id} must have at least two branches.`);
    }

    for (const connection of step.next) {
      if (!ids.has(connection.targetStepId)) {
        throw new Error(
          `Step ${step.id} references unknown step ${connection.targetStepId}.`
        );
      }
      if (!connection.label.trim()) {
        throw new Error(`Step ${step.id} contains an unlabelled connection.`);
      }
      if (
        step.operation === 'condition' &&
        connection.branch !== 'default' &&
        !connection.condition
      ) {
        throw new Error(
          `Condition ${step.id} branch ${connection.label} requires operands.`
        );
      }
    }

    for (const error of step.errorHandling) {
      if (error.targetStepId && !ids.has(error.targetStepId)) {
        throw new Error(
          `Step ${step.id} error path references unknown step ${error.targetStepId}.`
        );
      }
    }
  }

  const reachable = new Set<string>();
  const queue = [analysis.steps[0].id];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const step = analysis.steps.find((candidate) => candidate.id === id);
    if (!step) continue;
    for (const edge of step.next) queue.push(edge.targetStepId);
    for (const error of step.errorHandling) {
      if (error.targetStepId) queue.push(error.targetStepId);
    }
  }

  const unreachable = analysis.steps.filter((step) => !reachable.has(step.id));
  if (unreachable.length) {
    throw new Error(
      `Analysis contains unreachable steps: ${unreachable
        .map((step) => step.id)
        .join(', ')}.`
    );
  }

  const terminals = analysis.steps.filter((step) => step.next.length === 0);
  if (!terminals.length) {
    throw new Error('Analysis must contain a reachable terminal path.');
  }

  return analysis;
}

