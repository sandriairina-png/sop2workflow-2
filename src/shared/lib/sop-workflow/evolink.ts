import { validateSopAnalysisGraph } from './graph';
import {
  buildSopAnalysisMessages,
  SOP_ANALYSIS_PROMPT_VERSION,
} from './prompt';
import {
  SopAnalysisRequest,
  SopAnalysisResponse,
  SopAnalysisSchema,
} from './schema';

export const EVOLINK_DEFAULT_URL =
  'https://direct.evolink.ai/v1/chat/completions';
export const EVOLINK_DEFAULT_MODEL = 'gemini-3.8-flash';
export const EVOLINK_DEFAULT_MAX_TOKENS = 6000;
export const EVOLINK_DEFAULT_TIMEOUT_MS = 45_000;

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
  > & { fetch: FetchLike }
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
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
        max_tokens: config.maxTokens,
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

function parseAnalysis(payload: ProviderPayload) {
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new EvolinkError('invalid_output', 'Model output is empty.');
  try {
    const parsed = SopAnalysisSchema.parse(JSON.parse(extractJson(content)));
    return validateSopAnalysisGraph(parsed);
  } catch (error) {
    if (error instanceof EvolinkError) throw error;
    throw new EvolinkError('invalid_output', 'Model output failed validation.');
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

  const messages = buildSopAnalysisMessages(input);
  const first = await requestProvider(messages, config);
  try {
    return {
      analysis: parseAnalysis(first),
      meta: {
        model: config.model,
        promptVersion: SOP_ANALYSIS_PROMPT_VERSION,
        requestId: first.id || crypto.randomUUID(),
        usage: usageOf(first),
      },
    };
  } catch (error) {
    if (!(error instanceof EvolinkError) || error.code !== 'invalid_output') {
      throw error;
    }
  }

  const invalidContent = first.choices?.[0]?.message?.content || '';
  const repaired = await requestProvider(
    [
      ...messages,
      { role: 'assistant', content: invalidContent },
      {
        role: 'user',
        content:
          '上一个 JSON 不符合指定 schema 或图连通规则。只返回修复后的完整 JSON，不要解释。',
      },
    ],
    config
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
        inputTokens: firstUsage.inputTokens + repairUsage.inputTokens,
        outputTokens: firstUsage.outputTokens + repairUsage.outputTokens,
        totalTokens: firstUsage.totalTokens + repairUsage.totalTokens,
      },
    },
  };
}

