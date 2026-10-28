import assert from 'node:assert/strict';
import test from 'node:test';

import { EvolinkError } from '@/shared/lib/sop-workflow/evolink';
import { SopAnalysisResponse } from '@/shared/lib/sop-workflow/schema';

import { createAnalyzeHandler } from './route';

const success: SopAnalysisResponse = {
  analysis: {
    schemaVersion: '1.0',
    title: '测试',
    summary: '测试',
    trigger: { type: 'manual', description: '人工触发' },
    actors: [],
    steps: [
      {
        id: 'done',
        title: '完成',
        description: '完成',
        operation: 'end',
        inputs: [],
        outputs: [],
        next: [],
        errorHandling: [],
      },
    ],
    assumptions: [],
    missingInformation: [],
    deploymentChecklist: [],
    risks: [],
    tests: [],
  },
  meta: {
    model: 'gemini-3.8-flash',
    promptVersion: 'test',
    requestId: 'request-id',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  },
};

function request(body: unknown, contentType = 'application/json') {
  return new Request('https://spwflow.online/api/sop-workflow/analyze', {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'x-forwarded-for': '203.0.113.9',
      origin: 'https://spwflow.online',
    },
    body: JSON.stringify(body),
  });
}

function handler(overrides: Parameters<typeof createAnalyzeHandler>[0] = {}) {
  return createAnalyzeHandler({
    analyze: async () => success,
    quota: async () => ({
      allowed: true,
      remainingClient: 19,
      remainingGlobal: 199,
    }),
    salt: 'test-salt',
    ...overrides,
  });
}

test('rejects invalid content type and request values', async () => {
  const invalidType = await handler()(request({}, 'text/plain'));
  assert.equal(invalidType.status, 415);

  for (const body of [
    { sop: '', locale: 'zh', triggerHint: 'auto' },
    { sop: 'x'.repeat(4001), locale: 'zh', triggerHint: 'auto' },
    { sop: 'ok', locale: 'fr', triggerHint: 'auto' },
    { sop: 'ok', locale: 'zh', triggerHint: 'magic' },
  ]) {
    const response = await handler()(request(body));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'invalid_request');
  }
});

test('returns a stable 429 for anonymous quota rejection', async () => {
  const response = await handler({
    quota: async () => ({
      allowed: false,
      code: 'too_frequent',
      retryAfterSeconds: 7,
    }),
  })(request({ sop: '检查订单', locale: 'zh', triggerHint: 'auto' }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '7');
  assert.equal((await response.json()).error, 'too_frequent');
});

test('maps safe provider errors without leaking details', async () => {
  const cases = [
    [new EvolinkError('not_configured', 'secret config path'), 503, 'not_configured'],
    [new EvolinkError('timeout', 'upstream host detail'), 504, 'provider_timeout'],
    [new EvolinkError('invalid_output', 'raw model output'), 502, 'invalid_output'],
  ] as const;
  for (const [error, status, code] of cases) {
    const response = await handler({
      analyze: async () => {
        throw error;
      },
    })(request({ sop: '检查订单', locale: 'zh', triggerHint: 'auto' }));
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.error, code);
    assert.doesNotMatch(JSON.stringify(body), /secret config|upstream host|raw model/);
  }
});

test('returns validated analysis with no-store and anonymous cookie', async () => {
  const response = await handler()(
    request({ sop: '检查订单', locale: 'zh', triggerHint: 'auto' })
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('set-cookie') || '', /sopwf_anon=/);
  assert.deepEqual(await response.json(), success);
});
