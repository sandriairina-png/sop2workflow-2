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
  SopSkeletonSchema,
} from './schema';

export const EVOLINK_DEFAULT_URL =
  'https://direct.evolink.ai/v1/chat/completions';
export const EVOLINK_DEFAULT_MODEL = 'gemini-3.8-flash';
export const EVOLINK_DEFAULT_MAX_TOKENS = 6000;
export const EVOLINK_SKELETON_MAX_TOKENS = 2200;
export const EVOLINK_DEFAULT_TIMEOUT_MS = 105_000;
const SKELETON_TIMEOUT_MS = 30_000;
const DETAIL_TIMEOUT_MS = 60_000;

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
  return (fenced?.[1] || content).trim();
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
  limits?: { maxTokens?: number; timeoutMs?: number }
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
        temperature: 0.1,
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

function parseSkeleton(payload: ProviderPayload) {
  const content = payload.choices?.[0]?.message?.content;
  if (!content)
    throw new EvolinkError('invalid_output', 'Model skeleton is empty.');

  try {
    return SopSkeletonSchema.parse(JSON.parse(extractJson(content)));
  } catch {
    throw new EvolinkError(
      'invalid_output',
      'Model skeleton does not match the required contract.'
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
  const skeletonPayload = await requestProvider(
    buildSopSkeletonMessages(input),
    config,
    {
      maxTokens: Math.min(EVOLINK_SKELETON_MAX_TOKENS, config.maxTokens),
      timeoutMs: remainingTimeout(deadline, SKELETON_TIMEOUT_MS),
    }
  );
  const skeleton = parseSkeleton(skeletonPayload);
  const messages = buildSopDetailMessages(input, skeleton);
  const first = await requestProvider(messages, config, {
    maxTokens: config.maxTokens,
    timeoutMs: remainingTimeout(deadline, DETAIL_TIMEOUT_MS),
  });
  let repairReason = 'The response did not match the required contract.';
  try {
    return {
      analysis: parseAnalysis(first),
      meta: {
        model: config.model,
        promptVersion: SOP_ANALYSIS_PROMPT_VERSION,
        requestId: first.id || crypto.randomUUID(),
        usage: addUsage(usageOf(skeletonPayload), usageOf(first)),
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
      maxTokens: config.maxTokens,
      timeoutMs: remainingTimeout(deadline, DETAIL_TIMEOUT_MS),
    }
  );
  const skeletonUsage = usageOf(skeletonPayload);
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
