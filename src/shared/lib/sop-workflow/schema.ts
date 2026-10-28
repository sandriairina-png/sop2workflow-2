import { z } from 'zod';

export const TriggerHintSchema = z.enum([
  'auto',
  'manual',
  'schedule',
  'webhook',
]);
export type TriggerHint = z.infer<typeof TriggerHintSchema>;

const ConditionSchema = z.object({
  leftValue: z.string().min(1),
  operator: z.enum([
    'equals',
    'notEquals',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'contains',
    'isEmpty',
    'isNotEmpty',
  ]),
  rightValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  explanation: z.string().min(1),
});

export const SopConnectionSchema = z.object({
  targetStepId: z.string().min(1),
  label: z.string().min(1),
  condition: ConditionSchema.optional(),
  branch: z.enum(['default', 'true', 'false', 'case', 'error']),
});
export type SopConnection = z.infer<typeof SopConnectionSchema>;

export const SopStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  ownerActorId: z.string().min(1).optional(),
  operation: z.enum([
    'read',
    'transform',
    'write',
    'approve',
    'notify',
    'wait',
    'condition',
    'merge',
    'end',
  ]),
  integration: z
    .object({
      system: z.string().min(1),
      action: z.string().min(1),
      credentialRequired: z.boolean(),
      endpointKnown: z.boolean(),
    })
    .optional(),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  next: z.array(SopConnectionSchema),
  errorHandling: z.array(
    z.object({
      scenario: z.string().min(1),
      action: z.string().min(1),
      targetStepId: z.string().min(1).optional(),
    })
  ),
});
export type SopStep = z.infer<typeof SopStepSchema>;

export const SopAnalysisSchema = z.object({
  schemaVersion: z.literal('1.0'),
  title: z.string().min(1),
  summary: z.string().min(1),
  trigger: z.object({
    type: z.enum(['manual', 'schedule', 'webhook']),
    description: z.string().min(1),
    schedule: z
      .object({
        hour: z.number().int().min(0).max(23),
        minute: z.number().int().min(0).max(59),
        timezone: z.string().min(1).optional(),
      })
      .optional(),
  }),
  actors: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      responsibility: z.string().min(1),
    })
  ),
  steps: z.array(SopStepSchema).min(1),
  assumptions: z.array(z.string()),
  missingInformation: z.array(z.string()),
  deploymentChecklist: z.array(z.string()),
  risks: z.array(
    z.object({
      level: z.enum(['low', 'medium', 'high']),
      title: z.string().min(1),
      description: z.string().min(1),
      mitigation: z.string().min(1),
    })
  ),
  tests: z.array(
    z.object({
      name: z.string().min(1),
      input: z.string(),
      expected: z.string().min(1),
    })
  ),
});

export type SopAnalysis = z.infer<typeof SopAnalysisSchema>;

export type SopAnalysisRequest = {
  sop: string;
  locale: 'zh' | 'en';
  triggerHint: TriggerHint;
};

export type SopAnalysisResponse = {
  analysis: SopAnalysis;
  meta: {
    model: string;
    promptVersion: string;
    requestId: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
};

