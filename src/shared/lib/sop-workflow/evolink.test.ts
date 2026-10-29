import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeSopWithEvolink,
  EVOLINK_DEFAULT_MAX_TOKENS,
  EVOLINK_DEFAULT_TIMEOUT_MS,
} from './evolink';

const validAnalysis = {
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
};

function response(content: string) {
  return new Response(
    JSON.stringify({
      id: 'provider-request',
      choices: [{ message: { content } }],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 80,
        total_tokens: 200,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

test('calls the configured EvoLink route with bounded JSON-only input', async () => {
  let request: { url: string; init: RequestInit } | undefined;
  const result = await analyzeSopWithEvolink(
    { sop: '检查订单。', locale: 'zh', triggerHint: 'auto' },
    {
      apiKey: 'test-provider-key',
      fetch: async (url, init) => {
        request = { url: String(url), init: init || {} };
        return response(JSON.stringify(validAnalysis));
      },
    }
  );

  assert.equal(request?.url, 'https://direct.evolink.ai/v1/chat/completions');
  assert.equal(
    (request?.init.headers as Record<string, string>).Authorization,
    'Bearer test-provider-key'
  );
  const body = JSON.parse(String(request?.init.body));
  assert.equal(body.model, 'gemini-3.8-flash');
  assert.equal(body.max_tokens, 6000);
  assert.equal(body.temperature, 0.1);
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(result.meta.usage.totalTokens, 200);
  assert.equal(result.analysis.steps[0].id, 'done');
  assert.equal(EVOLINK_DEFAULT_MAX_TOKENS, 6000);
  assert.equal(EVOLINK_DEFAULT_TIMEOUT_MS, 45_000);
});

test('extracts JSON from a markdown fence', async () => {
  const result = await analyzeSopWithEvolink(
    { sop: '检查订单。', locale: 'zh', triggerHint: 'auto' },
    {
      apiKey: 'test-provider-key',
      fetch: async () =>
        response(`\`\`\`json\n${JSON.stringify(validAnalysis)}\n\`\`\``),
    }
  );
  assert.equal(result.analysis.title, '测试');
});

test('performs at most one repair request after invalid model JSON', async () => {
  let calls = 0;
  let repairMessages: Array<{ role?: string; content?: string }> = [];
  const result = await analyzeSopWithEvolink(
    { sop: '检查订单。', locale: 'zh', triggerHint: 'auto' },
    {
      apiKey: 'test-provider-key',
      fetch: async (_url, init) => {
        calls += 1;
        if (calls === 2) {
          const repairBody = JSON.parse(String(init?.body)) as {
            messages?: Array<{ role?: string; content?: string }>;
          };
          repairMessages = repairBody.messages || [];
        }
        return calls === 1
          ? response('{"schemaVersion":"1.0"}')
          : response(JSON.stringify(validAnalysis));
      },
    }
  );
  assert.equal(calls, 2);
  assert.equal(result.analysis.title, '测试');
  assert.match(
    repairMessages.at(-1)?.content || '',
    /title|summary|trigger|actors|steps/
  );
});

test('aborts provider work after the configured timeout', async () => {
  await assert.rejects(
    analyzeSopWithEvolink(
      { sop: '检查订单。', locale: 'zh', triggerHint: 'auto' },
      {
        apiKey: 'test-provider-key',
        timeoutMs: 5,
        fetch: async (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      }
    ),
    /timeout/i
  );
});
