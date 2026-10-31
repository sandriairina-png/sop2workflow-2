import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeSopWithEvolink,
  EVOLINK_DEFAULT_MAX_TOKENS,
  EVOLINK_DEFAULT_TIMEOUT_MS,
  EVOLINK_DETAIL_MAX_TOKENS,
} from './evolink';
import type { SopSkeleton } from './schema';

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
      source: 'source_text',
      operation: 'end',
      inputs: [],
      outputs: [],
      next: [],
      errorHandling: [],
    },
  ],
  assumptions: [],
  missingInformation: [],
  confirmationQuestions: [],
  deploymentChecklist: [],
  risks: [],
  tests: [],
};

const validSkeleton = {
  schemaVersion: '1.0',
  title: '报销审批',
  summary: '按金额分级审批，驳回后可重新提交。',
  trigger: { type: 'manual', description: '员工提交报销申请' },
  actors: [
    { id: 'employee', name: '员工', responsibility: '提交和补充报销材料' },
  ],
  steps: [
    {
      id: 'submit',
      title: '提交报销',
      description: '提交金额与凭证',
      operation: 'write',
      next: [
        {
          targetStepId: 'review',
          label: '进入审批',
          branch: 'default',
        },
      ],
    },
    {
      id: 'review',
      title: '审批',
      description: '按金额进入对应审批路径',
      operation: 'condition',
      next: [],
    },
  ],
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
  let calls = 0;
  const result = await analyzeSopWithEvolink(
    { sop: '检查订单。', locale: 'zh', triggerHint: 'auto' },
    {
      apiKey: 'test-provider-key',
      fetch: async (url, init) => {
        calls += 1;
        request = { url: String(url), init: init || {} };
        return response(
          JSON.stringify(calls === 1 ? validSkeleton : validAnalysis)
        );
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
  assert.equal(body.max_tokens, 5000);
  assert.equal(body.temperature, undefined);
  assert.equal(body.reasoning_effort, 'low');
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(result.meta.usage.totalTokens, 400);
  assert.equal(result.analysis.steps[0].id, 'done');
  assert.equal(EVOLINK_DEFAULT_MAX_TOKENS, 6000);
  assert.equal(EVOLINK_DETAIL_MAX_TOKENS, 5000);
  assert.equal(EVOLINK_DEFAULT_TIMEOUT_MS, 65_000);
});

test('generates a compact skeleton before requesting node details', async () => {
  const bodies: Array<{
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
  }> = [];
  let calls = 0;

  const result = await analyzeSopWithEvolink(
    {
      sop: '金额低于 5000 元由主管审批，否则由财务总监审批；驳回后补充材料重新提交。',
      locale: 'zh',
      triggerHint: 'manual',
    },
    {
      apiKey: 'test-provider-key',
      fetch: async (_url, init) => {
        calls += 1;
        bodies.push(JSON.parse(String(init?.body)));
        return calls === 1
          ? response(JSON.stringify(validSkeleton))
          : response(JSON.stringify(validAnalysis));
      },
    }
  );

  assert.equal(calls, 2);
  assert.ok(bodies[0].max_tokens < bodies[1].max_tokens);
  assert.equal(
    (bodies[0] as { reasoning_effort?: string }).reasoning_effort,
    'low'
  );
  const detailRequest = JSON.parse(bodies[1].messages.at(-1)?.content || '{}');
  assert.equal(detailRequest.task, 'enrich_erp_sop_skeleton');
  assert.equal(detailRequest.skeleton.steps[0].id, 'submit');
  assert.equal(result.analysis.title, '测试');
  assert.equal(result.meta.usage.totalTokens, 400);
});

test('extracts JSON from a markdown fence', async () => {
  let calls = 0;
  const result = await analyzeSopWithEvolink(
    { sop: '检查订单。', locale: 'zh', triggerHint: 'auto' },
    {
      apiKey: 'test-provider-key',
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? response(JSON.stringify(validSkeleton))
          : response(`\`\`\`json\n${JSON.stringify(validAnalysis)}\n\`\`\``);
      },
    }
  );
  assert.equal(result.analysis.title, '测试');
});

test('extracts JSON objects surrounded by model commentary', async () => {
  let calls = 0;
  const result = await analyzeSopWithEvolink(
    { sop: '检查订单。', locale: 'zh', triggerHint: 'auto' },
    {
      apiKey: 'test-provider-key',
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? response(`主干如下：\n${JSON.stringify(validSkeleton)}\n请确认。`)
          : response(
              `完整结果如下：\n${JSON.stringify(validAnalysis)}\n完成。`
            );
      },
    }
  );
  assert.equal(result.analysis.title, '测试');
});

test('repairs invalid skeleton JSON once before requesting details', async () => {
  let calls = 0;
  let repairPrompt = '';
  const result = await analyzeSopWithEvolink(
    { sop: '检查订单。', locale: 'zh', triggerHint: 'auto' },
    {
      apiKey: 'test-provider-key',
      fetch: async (_url, init) => {
        calls += 1;
        if (calls === 2) {
          const body = JSON.parse(String(init?.body));
          repairPrompt = body.messages.at(-1)?.content || '';
        }
        if (calls === 1) return response('我需要更多信息才能输出。');
        if (calls === 2) return response(JSON.stringify(validSkeleton));
        return response(JSON.stringify(validAnalysis));
      },
    }
  );
  assert.equal(calls, 3);
  assert.match(repairPrompt, /JSON|schemaVersion/);
  assert.equal(result.analysis.title, '测试');
  assert.equal(result.meta.usage.totalTokens, 600);
});

test('normalizes localized skeleton enums before detail generation', async () => {
  const localizedSkeleton = {
    ...validSkeleton,
    trigger: { type: '手动触发', description: '员工提交报销申请' },
    actors: [{ id: 'employee', name: '员工' }],
    steps: [
      {
        id: 'check',
        title: '判断金额',
        description: '按金额分支',
        operation: '条件判断',
        next: [
          {
            targetStepId: 'done',
            label: '满足条件',
            branch: '是',
            condition: {
              leftValue: 'amount',
              operator: '大于等于',
              rightValue: 5000,
              explanation: '金额达到财务总监审批门槛',
            },
          },
          { targetStepId: 'done', label: '否则', branch: '否' },
        ],
      },
      {
        id: 'done',
        title: '完成',
        description: '结束流程',
        operation: '结束',
        next: [],
      },
    ],
  };
  let calls = 0;
  let detailSkeleton: SopSkeleton | undefined;
  const result = await analyzeSopWithEvolink(
    { sop: '检查金额。', locale: 'zh', triggerHint: 'auto' },
    {
      apiKey: 'test-provider-key',
      fetch: async (_url, init) => {
        calls += 1;
        if (calls === 1) return response(JSON.stringify(localizedSkeleton));
        const body = JSON.parse(String(init?.body));
        detailSkeleton = JSON.parse(body.messages.at(-1).content).skeleton;
        return response(JSON.stringify(validAnalysis));
      },
    }
  );
  assert.equal(calls, 2);
  assert.equal(detailSkeleton?.trigger.type, 'manual');
  assert.equal(detailSkeleton?.actors[0].responsibility, '员工');
  assert.equal(detailSkeleton?.steps[0].operation, 'condition');
  assert.equal(detailSkeleton?.steps[0].next[0].branch, 'true');
  assert.equal(
    detailSkeleton?.steps[0].next[0].condition?.operator,
    'greaterThanOrEqual'
  );
  assert.equal(detailSkeleton?.steps[0].next[1].branch, 'false');
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
        if (calls === 3) {
          const repairBody = JSON.parse(String(init?.body)) as {
            messages?: Array<{ role?: string; content?: string }>;
          };
          repairMessages = repairBody.messages || [];
        }
        if (calls === 1) return response(JSON.stringify(validSkeleton));
        return calls === 2
          ? response('{"schemaVersion":"1.0"}')
          : response(JSON.stringify(validAnalysis));
      },
    }
  );
  assert.equal(calls, 3);
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
