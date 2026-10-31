import { validateSopAnalysisGraph } from './graph';
import {
  buildSopDetailMessages,
  buildSopSkeletonMessages,
  SOP_ANALYSIS_PROMPT_VERSION,
} from './prompt';
import {
  SopAnalysisRequest,
  SopAnalysisResponse,
  SopAnalysisSchema,
  SopSkeleton,
  SopSkeletonSchema,
} from './schema';

export const EVOLINK_DEFAULT_URL =
  'https://direct.evolink.ai/v1/chat/completions';
export const EVOLINK_DEFAULT_MODEL = 'gemini-3.8-flash';
export const EVOLINK_DEFAULT_MAX_TOKENS = 6000;
export const EVOLINK_SKELETON_MAX_TOKENS = 4000;
export const EVOLINK_DETAIL_MAX_TOKENS = 6000;
export const EVOLINK_DEFAULT_TIMEOUT_MS = 65_000;
const SKELETON_TIMEOUT_MS = 23_000;
const DETAIL_TIMEOUT_MS = 40_000;

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
  choices?: Array<{ message?: { content?: string } }>;
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
  if (/异常|错误|失败|驳回|error/.test(text)) return 'error';
  if (/否则|不满足|假|否|false/.test(text)) return 'false';
  if (/满足|真|是|通过|true/.test(text)) return 'true';
  if (operation === 'condition') {
    if (count === 2) return index === 0 ? 'true' : 'false';
    return 'case';
  }
  return 'default';
}

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

function normalizeSkeleton(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const skeleton = raw as Record<string, unknown>;
  const trigger =
    skeleton.trigger && typeof skeleton.trigger === 'object'
      ? (skeleton.trigger as Record<string, unknown>)
      : {};
  const actors = Array.isArray(skeleton.actors)
    ? skeleton.actors.map((actor) => {
        const record = actor as Record<string, unknown>;
        return {
          ...record,
          responsibility: record.responsibility || record.name || '参与流程',
        };
      })
    : [];
  const steps = Array.isArray(skeleton.steps)
    ? skeleton.steps.map((step) => {
        const record = step as Record<string, unknown>;
        const operation = normalizedOperation(record.operation, record.title);
        const connections = Array.isArray(record.next) ? record.next : [];
        return {
          ...record,
          operation,
          next: connections.map((connection, index) => {
            const next = connection as Record<string, unknown>;
            const condition =
              next.condition && typeof next.condition === 'object'
                ? (next.condition as Record<string, unknown>)
                : undefined;
            return {
              ...next,
              ...(condition
                ? {
                    condition: {
                      ...condition,
                      operator: normalizedOperator(condition.operator),
                    },
                  }
                : {}),
              branch: normalizedBranch(
                next.branch,
                operation,
                index,
                connections.length
              ),
            };
          }),
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
      'The skeleton response is not valid JSON.'
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

function parseAnalysis(payload: ProviderPayload) {
  const content = payload.choices?.[0]?.message?.content;
  if (!content)
    throw new EvolinkError('invalid_output', 'Model output is empty.');

  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(content));
  } catch {
    throw new EvolinkError('invalid_output', 'The response is not valid JSON.');
  }

  const parsed = SopAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');
    throw new EvolinkError(
      'invalid_output',
      `Schema validation failed: ${issues}`
    );
  }

  try {
    return validateSopAnalysisGraph(parsed.data);
  } catch (error) {
    throw new EvolinkError(
      'invalid_output',
      `Graph validation failed: ${
        error instanceof Error ? error.message : 'unknown graph error'
      }`
    );
  }
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
  const skeletonMessages = buildSopSkeletonMessages(input);
  let skeletonPayload = await requestProvider(skeletonMessages, config, {
    maxTokens: Math.min(EVOLINK_SKELETON_MAX_TOKENS, config.maxTokens),
    timeoutMs: remainingTimeout(deadline, SKELETON_TIMEOUT_MS),
    reasoningEffort: 'low',
  });
  let skeletonUsage = usageOf(skeletonPayload);
  let skeleton: SopSkeleton;
  try {
    skeleton = parseSkeleton(skeletonPayload);
  } catch (error) {
    if (!(error instanceof EvolinkError) || error.code !== 'invalid_output') {
      throw error;
    }
    const repairedSkeleton = await requestProvider(
      [
        ...skeletonMessages,
        {
          role: 'user',
          content:
            '上一个主干结果不是可解析的 JSON。请只返回完整 JSON 对象，必须包含 schemaVersion、title、summary、trigger、actors、steps；不要解释、不要 Markdown、不要代码围栏。',
        },
      ],
      config,
      {
        maxTokens: Math.min(EVOLINK_SKELETON_MAX_TOKENS, config.maxTokens),
        timeoutMs: remainingTimeout(deadline, SKELETON_TIMEOUT_MS),
        reasoningEffort: 'low',
      }
    );
    skeletonPayload = repairedSkeleton;
    skeletonUsage = addUsage(skeletonUsage, usageOf(repairedSkeleton));
    skeleton = parseSkeleton(repairedSkeleton);
  }
  const messages = buildSopDetailMessages(input, skeleton);
  const first = await requestProvider(messages, config, {
    maxTokens: Math.min(EVOLINK_DETAIL_MAX_TOKENS, config.maxTokens),
    timeoutMs: remainingTimeout(deadline, DETAIL_TIMEOUT_MS),
    reasoningEffort: 'low',
  });
  let repairReason = 'The response did not match the required contract.';
  try {
    return {
      analysis: parseAnalysis(first),
      meta: {
        model: config.model,
        promptVersion: SOP_ANALYSIS_PROMPT_VERSION,
        requestId: first.id || crypto.randomUUID(),
        usage: addUsage(skeletonUsage, usageOf(first)),
      },
    };
  } catch (error) {
    if (!(error instanceof EvolinkError) || error.code !== 'invalid_output') {
      throw error;
    }
    repairReason = error.message;
  }

  const invalidContent = first.choices?.[0]?.message?.content || '';
  const repaired = await requestProvider(
    [
      ...messages,
      { role: 'assistant', content: invalidContent },
      {
        role: 'user',
        content: `上一个 JSON 不符合指定 schema 或图连通规则。校验错误：${repairReason}。请严格依据 system 消息中的 JSON 模板修复，补齐全部必填字段，并只返回完整 JSON。`,
      },
    ],
    config,
    {
      maxTokens: Math.min(EVOLINK_DETAIL_MAX_TOKENS, config.maxTokens),
      timeoutMs: remainingTimeout(deadline, DETAIL_TIMEOUT_MS),
      reasoningEffort: 'low',
    }
  );
  const firstUsage = usageOf(first);
  const repairUsage = usageOf(repaired);
  return {
    analysis: parseAnalysis(repaired),
    meta: {
      model: config.model,
      promptVersion: SOP_ANALYSIS_PROMPT_VERSION,
      requestId: repaired.id || first.id || crypto.randomUUID(),
      usage: {
        inputTokens:
          skeletonUsage.inputTokens +
          firstUsage.inputTokens +
          repairUsage.inputTokens,
        outputTokens:
          skeletonUsage.outputTokens +
          firstUsage.outputTokens +
          repairUsage.outputTokens,
        totalTokens:
          skeletonUsage.totalTokens +
          firstUsage.totalTokens +
          repairUsage.totalTokens,
      },
    },
  };
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
