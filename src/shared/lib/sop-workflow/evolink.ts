import { z } from 'zod';

import { validateSopAnalysisGraph } from './graph';
import {
  buildSopPlanMessages,
  buildSopSkeletonMessages,
  buildSopStepDetailMessages,
  SOP_ANALYSIS_PROMPT_VERSION,
  SOP_SKELETON_COMPACT_RETRY_PROMPT,
} from './prompt';
import {
  classifyErrorHandling,
  ConfirmationQuestionSchema,
  SopAnalysis,
  SopAnalysisRequest,
  SopAnalysisResponse,
  SopAnalysisSchema,
  SopErrorHandlingSchema,
  SopSkeleton,
  SopSkeletonSchema,
  SopStepSchema,
  SopStepSourceSchema,
} from './schema';

export const EVOLINK_DEFAULT_URL =
  'https://direct.evolink.ai/v1/chat/completions';
export const EVOLINK_DEFAULT_MODEL = 'gemini-3.8-flash';
export const EVOLINK_DEFAULT_MAX_TOKENS = 6000;
export const EVOLINK_SKELETON_MAX_TOKENS = 4000;
export const EVOLINK_STEP_DETAIL_MAX_TOKENS = 3500;
export const EVOLINK_PLAN_MAX_TOKENS = 2500;
export const EVOLINK_DEFAULT_TIMEOUT_MS = 65_000;
const SKELETON_TIMEOUT_MS = 30_000;
const DETAIL_TIMEOUT_MS = 50_000;

export class EvolinkError extends Error {
  constructor(
    public code:
      | 'not_configured'
      | 'timeout'
      | 'provider_error'
      | 'invalid_output',
    message: string
  ) {
    super(message);
    this.name = 'EvolinkError';
  }
}

type FetchLike = typeof fetch;

type EvolinkDeps = {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  fetch?: FetchLike;
};

type ProviderPayload = {
  id?: string;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || content).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  return start >= 0 && end > start
    ? candidate.slice(start, end + 1)
    : candidate;
}

function outputDiagnostics(payload: ProviderPayload) {
  return ` (finish_reason=${payload.choices?.[0]?.finish_reason || 'unknown'}, completion_tokens=${payload.usage?.completion_tokens ?? 'unknown'})`;
}

function usageOf(payload: ProviderPayload) {
  return {
    inputTokens: payload.usage?.prompt_tokens || 0,
    outputTokens: payload.usage?.completion_tokens || 0,
    totalTokens:
      payload.usage?.total_tokens ||
      (payload.usage?.prompt_tokens || 0) +
        (payload.usage?.completion_tokens || 0),
  };
}

async function requestProvider(
  messages: Array<{ role: string; content: string }>,
  config: Required<
    Pick<EvolinkDeps, 'apiKey' | 'apiUrl' | 'model' | 'maxTokens' | 'timeoutMs'>
  > & { fetch: FetchLike },
  limits?: {
    maxTokens?: number;
    timeoutMs?: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
  }
) {
  const controller = new AbortController();
  const timeoutMs = limits?.timeoutMs || config.timeoutMs;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await config.fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: limits?.maxTokens || config.maxTokens,
        reasoning_effort: limits?.reasoningEffort || 'medium',
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new EvolinkError(
        'provider_error',
        `EvoLink returned status ${response.status}.`
      );
    }
    return (await response.json()) as ProviderPayload;
  } catch (error) {
    if (error instanceof EvolinkError) throw error;
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw new EvolinkError('timeout', 'EvoLink request timeout.');
    }
    throw new EvolinkError('provider_error', 'EvoLink request failed.');
  } finally {
    clearTimeout(timeout);
  }
}

function normalizedTrigger(value: unknown) {
  const text = String(value || '').toLowerCase();
  if (text === 'schedule' || /定时|计划|周期|cron/.test(text)) {
    return 'schedule';
  }
  if (text === 'webhook' || /事件|回调|接口|触发器/.test(text)) {
    return 'webhook';
  }
  return 'manual';
}

function normalizedOperation(value: unknown, title: unknown) {
  const exact = String(value || '').toLowerCase();
  const allowed = [
    'read',
    'transform',
    'write',
    'approve',
    'notify',
    'wait',
    'condition',
    'merge',
    'end',
  ];
  if (allowed.includes(exact)) return exact;
  const text = `${value || ''} ${title || ''}`.toLowerCase();
  if (/审批|审核|复核/.test(text)) return 'approve';
  if (/通知|提醒|消息|告警/.test(text)) return 'notify';
  if (/判断|条件|分支|校验/.test(text)) return 'condition';
  if (/合并|汇总|聚合/.test(text)) return 'merge';
  if (/等待|延迟|暂停/.test(text)) return 'wait';
  if (/结束|完成|终止/.test(text)) return 'end';
  if (/读取|获取|查询|检索/.test(text)) return 'read';
  if (/转换|计算|处理|格式化/.test(text)) return 'transform';
  return 'write';
}

function normalizedBranch(
  value: unknown,
  operation: string,
  index: number,
  count: number
) {
  const text = String(value || '').toLowerCase();
  if (['default', 'true', 'false', 'case', 'error'].includes(text)) {
    return text;
  }
  if (text === 'yes') return 'true';
  if (text === 'no') return 'false';
  if (/异常|错误|失败|驳回|拒绝|error/.test(text)) return 'error';
  if (/否则|不满足|假|否|false/.test(text)) return 'false';
  if (/满足|真|是|通过|true/.test(text)) return 'true';
  if (operation === 'condition') {
    if (count === 2) return index === 0 ? 'true' : 'false';
    return 'case';
  }
  return 'default';
}

const OPERATOR_ALIASES: Record<string, string> = {
  equals: 'equals',
  eq: 'equals',
  notequals: 'notEquals',
  ne: 'notEquals',
  neq: 'notEquals',
  greaterthan: 'greaterThan',
  gt: 'greaterThan',
  greaterthanorequal: 'greaterThanOrEqual',
  gte: 'greaterThanOrEqual',
  lessthan: 'lessThan',
  lt: 'lessThan',
  lessthanorequal: 'lessThanOrEqual',
  lte: 'lessThanOrEqual',
  contains: 'contains',
  isempty: 'isEmpty',
  empty: 'isEmpty',
  isnotempty: 'isNotEmpty',
  notempty: 'isNotEmpty',
};

function normalizedOperator(value: unknown) {
  const exact = String(value || '');
  const allowed = [
    'equals',
    'notEquals',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'contains',
    'isEmpty',
    'isNotEmpty',
  ];
  if (allowed.includes(exact)) return exact;
  const text = exact.toLowerCase();
  const alias = OPERATOR_ALIASES[text];
  if (alias) return alias;
  if (/不等于|不相等|!=|≠/.test(text)) return 'notEquals';
  if (/大于等于|不少于|至少|>=|≥/.test(text)) return 'greaterThanOrEqual';
  if (/小于等于|不超过|至多|<=|≤/.test(text)) return 'lessThanOrEqual';
  if (/大于|超过|>/.test(text)) return 'greaterThan';
  if (/小于|低于|</.test(text)) return 'lessThan';
  if (/不为空|非空/.test(text)) return 'isNotEmpty';
  if (/为空|空值/.test(text)) return 'isEmpty';
  if (/包含|含有|contains/.test(text)) return 'contains';
  return 'equals';
}

export const DECISION_FIELD = '{{$json.decision}}';

const PARALLEL_LABEL = /同时|并行|并且|同步执行|parallel|in parallel/i;

// Models often label mutually exclusive outcomes ("库存充足" / "库存不足")
// as plain "default" edges, which n8n would run all at once. When a step has
// several different targets, treat its default edges as exclusive branches,
// unless the label says they run in parallel.
function exclusiveBranches(connections: unknown[], operation: string) {
  const edges = connections.map((connection, index) => {
    const edge = (isRecord(connection) ? connection : {}) as Record<
      string,
      unknown
    >;
    return {
      edge,
      branch: normalizedBranch(
        edge.branch,
        operation,
        index,
        connections.length
      ),
    };
  });
  const targets = new Set(edges.map(({ edge }) => String(edge.targetStepId)));
  const parallel = edges.every(
    ({ edge, branch }) =>
      branch !== 'default' || PARALLEL_LABEL.test(String(edge.label || ''))
  );
  if (targets.size < 2 || parallel) return edges;
  let trueTaken = edges.some(({ branch }) => branch === 'true');
  return edges.map(({ edge, branch }) => {
    if (branch !== 'default' || PARALLEL_LABEL.test(String(edge.label || ''))) {
      return { edge, branch };
    }
    if (operation === 'condition' && edges.length === 2) {
      const next = trueTaken ? 'false' : 'true';
      trueTaken = true;
      return { edge, branch: next };
    }
    return { edge, branch: 'case' };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSkeleton(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const skeleton = raw as Record<string, unknown>;
  const trigger =
    skeleton.trigger && typeof skeleton.trigger === 'object'
      ? (skeleton.trigger as Record<string, unknown>)
      : {};
  // Models sometimes return actors as plain names (["客户", "财务"]).
  const actors = Array.isArray(skeleton.actors)
    ? skeleton.actors.flatMap((actor, index) => {
        const record: Record<string, unknown> =
          typeof actor === 'string'
            ? { name: actor }
            : isRecord(actor)
              ? actor
              : {};
        const name = String(
          record.name || record.role || record.title || record.id || ''
        ).trim();
        if (!name) return [];
        return [
          {
            ...record,
            id: String(record.id || `actor_${index + 1}`),
            name,
            responsibility: record.responsibility || name || '参与流程',
          },
        ];
      })
    : [];
  const steps = Array.isArray(skeleton.steps)
    ? skeleton.steps.map((step) => {
        const record = step as Record<string, unknown>;
        const operation = normalizedOperation(record.operation, record.title);
        const connections = Array.isArray(record.next) ? record.next : [];
        const source = SopStepSourceSchema.safeParse(record.source);
        return {
          ...record,
          source: source.success ? source.data : undefined,
          operation,
          next: exclusiveBranches(connections, operation).map(
            ({ edge: next, branch }) => {
              const condition =
                next.condition && typeof next.condition === 'object'
                  ? (next.condition as Record<string, unknown>)
                  : undefined;
              const explanation = String(
                condition?.explanation || next.label || ''
              );
              // A labelled condition branch without operands (e.g. "重复请求")
              // is routed on {{$json.decision}}, like approval outcomes.
              const decision =
                !condition && operation === 'condition' && branch !== 'default'
                  ? {
                      leftValue: DECISION_FIELD,
                      operator: 'equals',
                      rightValue: String(next.label || ''),
                      explanation: String(next.label || ''),
                    }
                  : undefined;
              return {
                ...next,
                ...(condition
                  ? {
                      condition: {
                        ...condition,
                        leftValue: condition.leftValue || explanation,
                        explanation,
                        operator: normalizedOperator(condition.operator),
                      },
                    }
                  : decision
                    ? { condition: decision }
                    : {}),
                branch,
              };
            }
          ),
        };
      })
    : [];
  return {
    ...skeleton,
    trigger: { ...trigger, type: normalizedTrigger(trigger.type) },
    actors,
    steps,
  };
}

function normalizedErrorKind(value: unknown) {
  const text = String(value || '').toLowerCase();
  if (text === 'system' || /系统|技术/.test(text)) return 'system' as const;
  if (text === 'business' || /业务/.test(text)) return 'business' as const;
  return undefined;
}

// Anything other than an explicit "from the SOP" counts as AI-added, so the
// user is asked to review it.
function normalizedErrorSource(value: unknown) {
  const text = String(value || '').toLowerCase();
  if (text === 'source_text' || /原文|sop/.test(text)) {
    return 'source_text' as const;
  }
  return 'ai_inferred' as const;
}

function parseSkeleton(payload: ProviderPayload) {
  const content = payload.choices?.[0]?.message?.content;
  if (!content)
    throw new EvolinkError('invalid_output', 'Model skeleton is empty.');

  try {
    const parsed = SopSkeletonSchema.safeParse(
      normalizeSkeleton(JSON.parse(extractJson(content)))
    );
    if (parsed.success) return parsed.data;
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');
    throw new EvolinkError(
      'invalid_output',
      `Skeleton validation failed: ${issues}`
    );
  } catch (error) {
    if (error instanceof EvolinkError) throw error;
    throw new EvolinkError(
      'invalid_output',
      `The skeleton response is not valid JSON.${outputDiagnostics(payload)}`
    );
  }
}

function remainingTimeout(deadline: number, phaseLimit: number) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new EvolinkError('timeout', 'EvoLink request timeout.');
  }
  return Math.max(1, Math.min(phaseLimit, remaining));
}

export async function analyzeSopWithEvolink(
  input: SopAnalysisRequest,
  deps: EvolinkDeps = {}
): Promise<SopAnalysisResponse> {
  const config = {
    apiKey: deps.apiKey || process.env.EVOLINK_API_KEY || '',
    apiUrl: deps.apiUrl || process.env.EVOLINK_API_URL || EVOLINK_DEFAULT_URL,
    model: deps.model || process.env.EVOLINK_MODEL || EVOLINK_DEFAULT_MODEL,
    maxTokens: deps.maxTokens || EVOLINK_DEFAULT_MAX_TOKENS,
    timeoutMs: deps.timeoutMs || EVOLINK_DEFAULT_TIMEOUT_MS,
    fetch: deps.fetch || fetch,
  };
  if (!config.apiKey) {
    throw new EvolinkError('not_configured', 'EvoLink is not configured.');
  }

  const deadline = Date.now() + config.timeoutMs;
  let usage = usageOf({});
  const skeletonMessages = buildSopSkeletonMessages(input);
  const skeletonLimits = () => ({
    maxTokens: Math.min(EVOLINK_SKELETON_MAX_TOKENS, config.maxTokens),
    timeoutMs: remainingTimeout(deadline, SKELETON_TIMEOUT_MS),
    reasoningEffort: 'low' as const,
  });
  // The skeleton fixes the workflow graph, so check it here while a retry is
  // still possible.
  const readSkeleton = (payload: ProviderPayload) => {
    const skeleton = parseSkeleton(payload);
    try {
      mergeAnalysis(skeleton, undefined, undefined, input.locale);
    } catch (error) {
      throw new EvolinkError(
        'invalid_output',
        `Skeleton graph is invalid: ${
          error instanceof Error ? error.message : 'unknown graph error'
        }`
      );
    }
    return skeleton;
  };
  let skeleton: SopSkeleton;
  try {
    const payload = await requestProvider(
      skeletonMessages,
      config,
      skeletonLimits()
    );
    usage = addUsage(usage, usageOf(payload));
    skeleton = readSkeleton(payload);
  } catch (error) {
    if (!(error instanceof EvolinkError) || error.code === 'not_configured') {
      throw error;
    }
    // Retrying with the same budget fails the same way, so ask for a smaller outline.
    console.warn('sop_workflow_skeleton_retry', {
      code: error.code,
      reason: error.message,
    });
    const payload = await requestProvider(
      [
        ...skeletonMessages,
        {
          role: 'user',
          content: `${SOP_SKELETON_COMPACT_RETRY_PROMPT}上次的问题：${error.message}`,
        },
      ],
      config,
      skeletonLimits()
    );
    usage = addUsage(usage, usageOf(payload));
    skeleton = readSkeleton(payload);
  }

  skeleton = resolveTrigger(skeleton, input);

  // Stage 2: node details and the rollout plan are independent, so they run in
  // parallel and the skeleton is never rewritten. A failed part degrades the
  // result instead of failing the request.
  const partLimits = (maxTokens: number) => () => ({
    maxTokens: Math.min(maxTokens, config.maxTokens),
    timeoutMs: remainingTimeout(deadline, DETAIL_TIMEOUT_MS),
    reasoningEffort: 'low' as const,
  });
  const requestPart = async <T>(
    messages: Array<{ role: string; content: string }>,
    limits: () => {
      maxTokens: number;
      timeoutMs: number;
      reasoningEffort: 'low';
    },
    read: (raw: Record<string, unknown>) => T
  ) => {
    const payload = await requestProvider(messages, config, limits());
    usage = addUsage(usage, usageOf(payload));
    try {
      return read(parsePartJson(payload));
    } catch (error) {
      if (!(error instanceof EvolinkError) || error.code !== 'invalid_output') {
        throw error;
      }
      const repaired = await requestProvider(
        [
          ...messages,
          {
            role: 'user',
            content: `上一个结果无法解析（${error.message}）。请按 system 消息中的结构只返回完整 JSON 对象，不要解释、不要 Markdown。`,
          },
        ],
        config,
        limits()
      );
      usage = addUsage(usage, usageOf(repaired));
      return read(parsePartJson(repaired));
    }
  };
  const [details, plan] = await Promise.allSettled([
    requestPart(
      buildSopStepDetailMessages(input, skeleton),
      partLimits(EVOLINK_STEP_DETAIL_MAX_TOKENS),
      readStepDetails
    ),
    requestPart(
      buildSopPlanMessages(input, skeleton),
      partLimits(EVOLINK_PLAN_MAX_TOKENS),
      readPlan
    ),
  ]);
  for (const [part, outcome] of [
    ['steps', details],
    ['plan', plan],
  ] as const) {
    if (outcome.status === 'fulfilled') continue;
    if (!(outcome.reason instanceof EvolinkError)) throw outcome.reason;
    console.warn('sop_workflow_detail_fallback', {
      part,
      code: outcome.reason.code,
      reason: outcome.reason.message,
    });
  }

  const analysis = mergeAnalysis(
    skeleton,
    details.status === 'fulfilled' ? details.value : undefined,
    plan.status === 'fulfilled' ? plan.value : undefined,
    input.locale
  );
  const incomplete =
    details.status === 'rejected' || plan.status === 'rejected';
  return {
    analysis,
    meta: {
      model: config.model,
      promptVersion: SOP_ANALYSIS_PROMPT_VERSION,
      requestId: crypto.randomUUID(),
      usage,
      ...(incomplete ? { detailsIncomplete: true } : {}),
    },
  };
}

const DAILY_TIME =
  /(?:每天|每日|每个工作日|工作日)\s*(上午|早上|中午|下午|晚上)?\s*(\d{1,2})\s*(?:点|时|:|：)\s*(?:(\d{1,2})\s*分?)?|every\s+(?:day|weekday)[^.]*?\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

// The user's explicit trigger choice wins. In auto mode, a "manual" guess is
// corrected when the SOP clearly states a daily time ("每天 9 点").
function resolveTrigger(
  skeleton: SopSkeleton,
  input: SopAnalysisRequest
): SopSkeleton {
  const trigger = { ...skeleton.trigger };
  if (input.triggerHint !== 'auto') {
    trigger.type = input.triggerHint;
  } else if (trigger.type === 'manual' && DAILY_TIME.test(input.sop)) {
    trigger.type = 'schedule';
  }
  if (trigger.type === 'schedule' && !trigger.schedule) {
    const match = input.sop.match(DAILY_TIME);
    let hour = Number(match?.[2] ?? match?.[4] ?? 9);
    const minute = Number(match?.[3] ?? match?.[5] ?? 0);
    const period = (match?.[1] || match?.[6] || '').toLowerCase();
    if (/下午|晚上|pm/.test(period) && hour < 12) hour += 12;
    trigger.schedule = {
      hour: Math.min(Math.max(hour, 0), 23),
      minute: Math.min(Math.max(minute, 0), 59),
      timezone: 'Asia/Shanghai',
    };
  }
  return { ...skeleton, trigger };
}

function parsePartJson(payload: ProviderPayload) {
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new EvolinkError('invalid_output', 'Model output is empty.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(content));
  } catch {
    throw new EvolinkError(
      'invalid_output',
      `The response is not valid JSON.${outputDiagnostics(payload)}`
    );
  }
  if (!isRecord(raw)) {
    throw new EvolinkError('invalid_output', 'The response is not an object.');
  }
  return raw;
}

const StepDetailSchema = z.object({
  id: z.string().min(1),
  source: SopStepSourceSchema.optional(),
  ownerActorId: z.string().min(1).optional(),
  integration: SopStepSchema.shape.integration,
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  errorHandling: z.array(SopErrorHandlingSchema).optional(),
});
type StepDetail = z.infer<typeof StepDetailSchema>;

type RolloutPlan = Pick<
  SopAnalysis,
  | 'assumptions'
  | 'missingInformation'
  | 'confirmationQuestions'
  | 'deploymentChecklist'
  | 'risks'
  | 'tests'
>;

// Keep every entry that validates instead of rejecting the whole part.
function validItems<T>(
  value: unknown,
  schema: z.ZodType<T>,
  prepare: (item: unknown) => unknown = (item) => item
): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = schema.safeParse(prepare(item));
    return parsed.success ? [parsed.data] : [];
  });
}

function readStepDetails(raw: Record<string, unknown>): StepDetail[] {
  if (!Array.isArray(raw.steps)) {
    throw new EvolinkError('invalid_output', 'Step details have no steps.');
  }
  return validItems(raw.steps, StepDetailSchema, (step) => {
    if (!isRecord(step)) return step;
    const source = SopStepSourceSchema.safeParse(step.source);
    return {
      ...step,
      source: source.success ? source.data : undefined,
      errorHandling: Array.isArray(step.errorHandling)
        ? step.errorHandling.filter(isRecord).map((item) => ({
            ...item,
            source: normalizedErrorSource(item.source),
            kind:
              normalizedErrorKind(item.kind) ||
              classifyErrorHandling({
                scenario: String(item.scenario || ''),
                action: String(item.action || ''),
              }),
          }))
        : undefined,
    };
  });
}

const PLAN_LIMIT = 5;

function readPlan(raw: Record<string, unknown>): RolloutPlan {
  const text = z.string().trim().min(1);
  const shape = SopAnalysisSchema.shape;
  return {
    assumptions: validItems(raw.assumptions, text).slice(0, PLAN_LIMIT),
    missingInformation: validItems(raw.missingInformation, text).slice(
      0,
      PLAN_LIMIT
    ),
    confirmationQuestions: validItems(
      raw.confirmationQuestions,
      ConfirmationQuestionSchema,
      (question) => {
        if (!isRecord(question)) return question;
        const options = Array.isArray(question.options)
          ? question.options
              .map((option) =>
                typeof option === 'string'
                  ? { value: option, label: option }
                  : option
              )
              .slice(0, 3)
          : question.options;
        return {
          ...question,
          id: question.id || question.question,
          options,
          allowCustom: true,
        };
      }
    ).slice(0, PLAN_LIMIT),
    deploymentChecklist: validItems(raw.deploymentChecklist, text).slice(
      0,
      PLAN_LIMIT
    ),
    risks: validItems(raw.risks, shape.risks.element, (risk) =>
      isRecord(risk)
        ? { ...risk, level: String(risk.level || 'medium').toLowerCase() }
        : risk
    ).slice(0, PLAN_LIMIT),
    tests: validItems(raw.tests, shape.tests.element).slice(0, PLAN_LIMIT),
  };
}

// Combine the skeleton (graph) with optional details and plan. Without them
// the result is still a valid, exportable outline.
function mergeAnalysis(
  skeleton: SopSkeleton,
  details: StepDetail[] | undefined,
  plan: RolloutPlan | undefined,
  locale: SopAnalysisRequest['locale']
): SopAnalysis {
  const zh = locale === 'zh';
  const byId = new Map((details || []).map((detail) => [detail.id, detail]));
  const actorIds = new Set(skeleton.actors.map((actor) => actor.id));
  const stepIds = new Set(skeleton.steps.map((step) => step.id));
  return validateSopAnalysisGraph({
    ...skeleton,
    steps: skeleton.steps.map(({ source, ...step }) => {
      const detail = byId.get(step.id);
      return {
        ...step,
        source: detail?.source || source || 'ai_inferred',
        ...(detail?.ownerActorId && actorIds.has(detail.ownerActorId)
          ? { ownerActorId: detail.ownerActorId }
          : {}),
        ...(detail?.integration ? { integration: detail.integration } : {}),
        inputs: detail?.inputs?.slice(0, 3) || [],
        outputs: detail?.outputs?.slice(0, 3) || [],
        // System errors go to the shared handler at export, so only a
        // business exception may keep a target step.
        errorHandling: (detail?.errorHandling || [])
          .slice(0, 3)
          .map(({ targetStepId, ...item }) =>
            targetStepId &&
            stepIds.has(targetStepId) &&
            classifyErrorHandling(item) === 'business'
              ? { ...item, targetStepId }
              : item
          ),
      };
    }),
    assumptions: plan?.assumptions || [],
    missingInformation: [
      ...(plan?.missingInformation || []),
      ...(details
        ? []
        : [
            zh
              ? '节点负责人、输入输出与异常处理尚未补全，可重新生成以补全细节。'
              : 'Owners, inputs, outputs and error handling are not filled in yet. Regenerate to complete them.',
          ]),
    ],
    confirmationQuestions: plan?.confirmationQuestions || [],
    deploymentChecklist: plan?.deploymentChecklist.length
      ? plan.deploymentChecklist
      : [
          zh
            ? '导入 n8n 后，为每个系统节点配置凭证与字段映射。'
            : 'After importing into n8n, configure credentials and field mappings for each system node.',
        ],
    risks: plan?.risks || [],
    tests: plan?.tests || [],
  });
}

function addUsage(
  first: ReturnType<typeof usageOf>,
  second: ReturnType<typeof usageOf>
) {
  return {
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
    totalTokens: first.totalTokens + second.totalTokens,
  };
}
