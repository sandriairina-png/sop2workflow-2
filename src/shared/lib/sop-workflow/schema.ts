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

export const SopStepSourceSchema = z.enum([
  'source_text',
  'ai_inferred',
  'needs_confirmation',
]);
export type SopStepSource = z.infer<typeof SopStepSourceSchema>;

export const SopErrorKindSchema = z.enum(['system', 'business']);
export type SopErrorKind = z.infer<typeof SopErrorKindSchema>;

export const SopErrorHandlingSchema = z.object({
  kind: SopErrorKindSchema.optional(),
  scenario: z.string().min(1),
  action: z.string().min(1),
  targetStepId: z.string().min(1).optional(),
});
export type SopErrorHandling = z.infer<typeof SopErrorHandlingSchema>;

// Strong signals that the system itself failed, checked before business words.
const STRONG_SYSTEM_PATTERN =
  /接口|api|网关|网络|数据库|鉴权|认证|凭证|token|限流|宕机|http|gateway|network/i;
// Words for what went wrong in the business. Role words (主管, 客户...) are left
// out because they usually name who gets notified, not what failed.
const BUSINESS_EXCEPTION_PATTERN =
  /审批|驳回|拒绝|缺货|库存不足|不符|不一致|差异|未付款|未处理|未及时|催办|reject|approv|out of stock/i;
const SYSTEM_EXCEPTION_PATTERN =
  /超时|timeout|不可用|无响应|调用失败|请求失败|读取|写入|同步失败|发送失败|解析|系统|服务|unavailable|failed/i;

function errorKindOf(text: string): SopErrorKind | undefined {
  if (STRONG_SYSTEM_PATTERN.test(text)) return 'system';
  if (BUSINESS_EXCEPTION_PATTERN.test(text)) return 'business';
  if (SYSTEM_EXCEPTION_PATTERN.test(text)) return 'system';
  return undefined;
}

// Business exceptions are routed through `next`; only system exceptions use
// the n8n error output. Older drafts have no `kind`, so infer it from the
// scenario first and only then from the remediation text.
export function classifyErrorHandling(item: SopErrorHandling): SopErrorKind {
  if (item.kind) return item.kind;
  return errorKindOf(item.scenario) || errorKindOf(item.action) || 'system';
}

export const SopStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  source: SopStepSourceSchema,
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
  errorHandling: z.array(SopErrorHandlingSchema),
});
export type SopStep = z.infer<typeof SopStepSchema>;

export const ConfirmationQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z
    .array(
      z.object({
        value: z.string().min(1),
        label: z.string().min(1),
      })
    )
    .min(2)
    .max(3),
  allowCustom: z.boolean(),
});
export type ConfirmationQuestion = z.infer<typeof ConfirmationQuestionSchema>;

export const SopClarificationSchema = z.object({
  questionId: z.string().min(1).max(120),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(1000),
});
export type SopClarification = z.infer<typeof SopClarificationSchema>;

export const SopSkeletonSchema = z.object({
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
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        source: SopStepSourceSchema.optional(),
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
        next: z.array(SopConnectionSchema),
      })
    )
    .min(1),
});
export type SopSkeleton = z.infer<typeof SopSkeletonSchema>;

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
  confirmationQuestions: z.array(ConfirmationQuestionSchema),
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
  clarifications?: SopClarification[];
};

export type SopAnalysisResponse = {
  analysis: SopAnalysis;
  meta: {
    model: string;
    promptVersion: string;
    requestId: string;
    detailsIncomplete?: boolean;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
};
