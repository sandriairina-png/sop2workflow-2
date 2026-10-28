import { z } from 'zod';

import {
  analyzeSopWithEvolink,
  EvolinkError,
} from '@/shared/lib/sop-workflow/evolink';
import { TriggerHintSchema } from '@/shared/lib/sop-workflow/schema';
import {
  consumeSopWorkflowQuota,
  hashSopWorkflowClient,
  SOP_WORKFLOW_DEFAULT_LIMITS,
} from '@/shared/models/sop_workflow_quota';

const AnalyzeRequestSchema = z.object({
  sop: z.string().trim().min(1).max(4000),
  locale: z.enum(['zh', 'en']),
  triggerHint: TriggerHintSchema,
});

type Analyze = typeof analyzeSopWithEvolink;
type ConsumeQuota = typeof consumeSopWorkflowQuota;

type AnalyzeHandlerDeps = {
  analyze?: Analyze;
  quota?: ConsumeQuota;
  salt?: string;
  maxConcurrent?: number;
};

let activeRequests = 0;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function json(
  body: Record<string, unknown>,
  status: number,
  headers?: HeadersInit
) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  for (const entry of cookie.split(';')) {
    const [key, ...value] = entry.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function safeError(error: unknown) {
  if (!(error instanceof EvolinkError)) {
    return { status: 500, code: 'internal_error' };
  }
  switch (error.code) {
    case 'not_configured':
      return { status: 503, code: 'not_configured' };
    case 'timeout':
      return { status: 504, code: 'provider_timeout' };
    case 'invalid_output':
      return { status: 502, code: 'invalid_output' };
    default:
      return { status: 502, code: 'provider_error' };
  }
}

export function createAnalyzeHandler(deps: AnalyzeHandlerDeps = {}) {
  const analyze = deps.analyze || analyzeSopWithEvolink;
  const quota = deps.quota || consumeSopWorkflowQuota;
  const maxConcurrent = deps.maxConcurrent || 3;

  return async function POST(request: Request) {
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return json({ error: 'unsupported_media_type' }, 415);
    }

    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      return json({ error: 'invalid_origin' }, 403);
    }

    let input: z.infer<typeof AnalyzeRequestSchema>;
    try {
      input = AnalyzeRequestSchema.parse(await request.json());
    } catch {
      return json({ error: 'invalid_request' }, 400);
    }

    const salt =
      deps.salt ||
      process.env.SOP_WORKFLOW_RATE_SALT ||
      process.env.AUTH_SECRET;
    if (!salt) return json({ error: 'not_configured' }, 503);

    if (activeRequests >= maxConcurrent) {
      return json({ error: 'busy' }, 429, { 'retry-after': '5' });
    }

    activeRequests += 1;
    try {
      const forwardedFor = request.headers.get('x-forwarded-for') || 'unknown';
      const clientHash = hashSopWorkflowClient(
        forwardedFor.split(',')[0].trim(),
        salt
      );
      const decision = await quota({
        clientHash,
        limits: {
          intervalMs: positiveInteger(
            process.env.SOP_WORKFLOW_MIN_INTERVAL_MS,
            SOP_WORKFLOW_DEFAULT_LIMITS.intervalMs
          ),
          clientDaily: positiveInteger(
            process.env.SOP_WORKFLOW_CLIENT_DAILY_LIMIT,
            SOP_WORKFLOW_DEFAULT_LIMITS.clientDaily
          ),
          globalDaily: positiveInteger(
            process.env.SOP_WORKFLOW_GLOBAL_DAILY_LIMIT,
            SOP_WORKFLOW_DEFAULT_LIMITS.globalDaily
          ),
        },
      });
      if (!decision.allowed) {
        const retryAfter = decision.retryAfterSeconds;
        return json(
          { error: decision.code },
          429,
          retryAfter ? { 'retry-after': String(retryAfter) } : undefined
        );
      }

      const result = await analyze(input);
      const response = json(result as unknown as Record<string, unknown>, 200);
      if (!readCookie(request, 'sopwf_anon')) {
        const anonymousId = crypto.randomUUID();
        response.headers.append(
          'set-cookie',
          `sopwf_anon=${encodeURIComponent(anonymousId)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`
        );
      }
      return response;
    } catch (error) {
      const safe = safeError(error);
      return json({ error: safe.code }, safe.status);
    } finally {
      activeRequests -= 1;
    }
  };
}

export const POST = createAnalyzeHandler();
