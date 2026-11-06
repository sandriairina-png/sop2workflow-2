import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeSopWithEvolink,
  EVOLINK_DEFAULT_MAX_TOKENS,
  EVOLINK_DEFAULT_TIMEOUT_MS,
  EVOLINK_PLAN_MAX_TOKENS,
  EVOLINK_SKELETON_MAX_TOKENS,
  EVOLINK_STEP_DETAIL_MAX_TOKENS,
} from './evolink';
import type { SopSkeleton } from './schema';

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
      source: 'source_text',
      operation: 'write',
      next: [{ targetStepId: 'review', label: '进入审批', branch: 'default' }],
    },
    {
      id: 'review',
      title: '金额判断',
      description: '按金额分支',
      operation: 'condition',
      next: [
        {
          targetStepId: 'done',
          label: '大额',
          branch: 'true',
          condition: {
            leftValue: '{{$json.amount}}',
            operator: 'greaterThanOrEqual',
            rightValue: 5000,
            explanation: '金额大于等于 5000',
          },
        },
        {
          targetStepId: 'done',
          label: '小额',
          branch: 'false',
          condition: {
            leftValue: '{{$json.amount}}',
            operator: 'lessThan',
            rightValue: 5000,
            explanation: '金额小于 5000',
          },
        },
      ],
    },
    {
      id: 'done',
      title: '完成',
      description: '流程结束',
      operation: 'end',
      next: [],
    },
  ],
};

const validDetails = {
  steps: [
    {
      id: 'submit',
      source: 'source_text',
      ownerActorId: 'employee',
      inputs: ['报销单'],
      outputs: ['审批任务'],
      errorHandling: [
        { kind: 'system', scenario: 'ERP 接口超时', action: '通知运维' },
      ],
    },
    { id: 'review', source: 'source_text', inputs: [], outputs: [] },
  ],
};

const validPlan = {
  assumptions: ['金额字段为人民币'],
  missingInformation: ['财务总监审批阈值'],
  confirmationQuestions: [
    {
      id: 'threshold',
      question: '财务总监审批阈值是多少？',
      options: [
        { value: '5000', label: '5000 元及以上' },
        { value: '10000', label: '10000 元及以上' },
      ],
      allowCustom: true,
    },
  ],
  deploymentChecklist: ['配置 ERP 凭证'],
  risks: [
    {
      level: 'medium',
      title: '重复提交',
      description: '同一单据被提交两次',
      mitigation: '按单号幂等',
    },
  ],
  tests: [{ name: '边界值', input: '5000', expected: '进入总监审批' }],
};

function response(content: string, finishReason = 'stop') {
  return new Response(
    JSON.stringify({
      id: 'provider-request',
      choices: [{ message: { content }, finish_reason: finishReason }],
      usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

type Body = {
  max_tokens: number;
  reasoning_effort?: string;
  temperature?: number;
  response_format: { type: string };
  messages: Array<{ role: string; content: string }>;
};

// Routes each request by stage, since the two detail requests run in parallel.
function provider(
  handlers: Partial<
    Record<'skeleton' | 'steps' | 'plan', (attempt: number) => Response>
  >
) {
  const bodies: Array<{ stage: string; body: Body; url: string }> = [];
  const attempts = { skeleton: 0, steps: 0, plan: 0 };
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Body;
    const task = JSON.parse(body.messages[1].content).task;
    const stage =
      task === 'outline_erp_sop'
        ? 'skeleton'
        : task === 'detail_erp_sop_steps'
          ? 'steps'
          : 'plan';
    bodies.push({ stage, body, url: String(url) });
    attempts[stage] += 1;
    const handler = handlers[stage];
    if (handler) return handler(attempts[stage]);
    return response(
      JSON.stringify(
        stage === 'skeleton'
          ? validSkeleton
          : stage === 'steps'
            ? validDetails
            : validPlan
      )
    );
  };
  return { fetch, bodies, attempts };
}

const input = {
  sop: '金额低于 5000 元由主管审批，否则由财务总监审批。',
  locale: 'zh' as const,
  triggerHint: 'manual' as const,
};

test('calls the configured EvoLink route with bounded JSON-only input', async () => {
  const mock = provider({});
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  assert.equal(
    mock.bodies[0].url,
    'https://direct.evolink.ai/v1/chat/completions'
  );
  for (const { body } of mock.bodies) {
    assert.equal(body.temperature, undefined);
    assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.response_format.type, 'json_object');
  }
  const limits = Object.fromEntries(
    mock.bodies.map(({ stage, body }) => [stage, body.max_tokens])
  );
  assert.deepEqual(limits, {
    skeleton: EVOLINK_SKELETON_MAX_TOKENS,
    steps: EVOLINK_STEP_DETAIL_MAX_TOKENS,
    plan: EVOLINK_PLAN_MAX_TOKENS,
  });
  assert.equal(result.meta.usage.totalTokens, 600);
  assert.equal(result.meta.detailsIncomplete, undefined);
  assert.equal(EVOLINK_DEFAULT_MAX_TOKENS, 6000);
  assert.equal(EVOLINK_DEFAULT_TIMEOUT_MS, 65_000);
});

test('merges the skeleton with step details and the rollout plan', async () => {
  const mock = provider({});
  const result = await analyzeSopWithEvolink(
    {
      ...input,
      clarifications: [
        { questionId: 'channel', question: '通知渠道？', answer: '企业微信' },
      ],
    },
    { apiKey: 'test-provider-key', fetch: mock.fetch }
  );
  assert.deepEqual(
    mock.bodies.map(({ stage }) => stage),
    ['skeleton', 'steps', 'plan']
  );
  for (const { body } of mock.bodies) {
    const request = JSON.parse(body.messages[1].content);
    assert.equal(request.clarifications[0].answer, '企业微信');
  }
  for (const { body } of mock.bodies.slice(1)) {
    const request = JSON.parse(body.messages[1].content);
    assert.equal(request.skeleton.steps[0].id, 'submit');
  }
  const [submit, review, done] = result.analysis.steps;
  assert.equal(submit.title, '提交报销');
  assert.equal(submit.ownerActorId, 'employee');
  assert.deepEqual(submit.inputs, ['报销单']);
  assert.equal(submit.errorHandling[0].kind, 'system');
  assert.equal(review.next.length, 2);
  assert.equal(done.source, 'ai_inferred');
  assert.equal(result.analysis.confirmationQuestions[0].id, 'threshold');
  assert.deepEqual(result.analysis.deploymentChecklist, ['配置 ERP 凭证']);
});

test('extracts JSON from fences and surrounding commentary', async () => {
  const mock = provider({
    skeleton: () =>
      response(`主干如下：\n${JSON.stringify(validSkeleton)}\n请确认。`),
    steps: () =>
      response(`\`\`\`json\n${JSON.stringify(validDetails)}\n\`\`\``),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  assert.equal(result.analysis.steps[0].ownerActorId, 'employee');
});

test('retries a truncated skeleton with a compact outline request', async () => {
  let retryPrompt = '';
  const mock = provider({
    skeleton: (attempt) => {
      if (attempt === 1)
        return response('{"schemaVersion":"1.0","steps":[', 'length');
      retryPrompt = mock.bodies.at(-1)!.body.messages.at(-1)!.content;
      return response(JSON.stringify(validSkeleton));
    },
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  assert.equal(mock.attempts.skeleton, 2);
  assert.match(retryPrompt, /不超过 10 个/);
  assert.match(retryPrompt, /finish_reason=length/);
  assert.equal(result.analysis.title, '报销审批');
});

test('retries a skeleton whose graph is invalid', async () => {
  const broken = {
    ...validSkeleton,
    steps: [{ ...validSkeleton.steps[1], next: [] }, validSkeleton.steps[2]],
  };
  const mock = provider({
    skeleton: (attempt) =>
      response(JSON.stringify(attempt === 1 ? broken : validSkeleton)),
  });
  await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  assert.equal(mock.attempts.skeleton, 2);
  assert.match(
    mock.bodies[1].body.messages.at(-1)!.content,
    /Skeleton graph is invalid/
  );
});

test('reports finish_reason when both skeleton attempts are unusable', async () => {
  const mock = provider({
    skeleton: () => response('{"schemaVersion":"1.0","steps":[', 'length'),
  });
  await assert.rejects(
    analyzeSopWithEvolink(input, {
      apiKey: 'test-provider-key',
      fetch: mock.fetch,
    }),
    /finish_reason=length, completion_tokens=80/
  );
});

test('normalizes localized skeleton enums and plain-name actors', async () => {
  const localized = {
    ...validSkeleton,
    trigger: { type: '手动触发', description: '员工提交报销申请' },
    actors: ['员工', '财务', null],
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
              operator: 'gte',
              rightValue: 5000,
              explanation: '金额达到门槛',
            },
          },
          {
            targetStepId: 'done',
            label: '否则',
            branch: 'no',
            condition: {
              leftValue: 'amount',
              operator: '小于',
              rightValue: 5000,
              explanation: '金额未达门槛',
            },
          },
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
  const mock = provider({
    skeleton: () => response(JSON.stringify(localized)),
    steps: () => response(JSON.stringify({ steps: [] })),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  const skeleton: SopSkeleton = JSON.parse(
    mock.bodies[1].body.messages[1].content
  ).skeleton;
  assert.equal(skeleton.trigger.type, 'manual');
  assert.deepEqual(skeleton.actors, [
    { name: '员工', id: 'actor_1', responsibility: '员工' },
    { name: '财务', id: 'actor_2', responsibility: '财务' },
  ]);
  const [check] = result.analysis.steps;
  assert.equal(check.operation, 'condition');
  assert.deepEqual(
    check.next.map((edge) => [edge.branch, edge.condition?.operator]),
    [
      ['true', 'greaterThanOrEqual'],
      ['false', 'lessThan'],
    ]
  );
});

test('classifies step error handling and drops system targets', async () => {
  const mock = provider({
    steps: () =>
      response(
        JSON.stringify({
          steps: [
            {
              id: 'submit',
              errorHandling: [
                {
                  scenario: '信用接口查询超时',
                  action: '告警',
                  targetStepId: 'done',
                },
                {
                  scenario: '审批超时',
                  source: 'source_text',
                  action: '催办上级',
                  targetStepId: 'review',
                },
                null,
              ],
            },
            { id: 'review', source: 'not-a-source' },
            'garbage',
          ],
        })
      ),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  const [submit, review] = result.analysis.steps;
  assert.deepEqual(submit.errorHandling, [
    {
      scenario: '信用接口查询超时',
      action: '告警',
      kind: 'system',
      source: 'ai_inferred',
    },
    {
      scenario: '审批超时',
      action: '催办上级',
      kind: 'business',
      source: 'source_text',
      targetStepId: 'review',
    },
  ]);
  assert.equal(review.source, 'ai_inferred');
});

test('keeps valid plan items and repairs question options', async () => {
  const mock = provider({
    plan: () =>
      response(
        JSON.stringify({
          missingInformation: ['通知渠道', ''],
          confirmationQuestions: [
            {
              id: 'channel',
              question: '通知渠道？',
              options: ['邮件', '企业微信', '短信', '电话'],
              allowCustom: false,
            },
            { id: 'bad', question: '只有一个选项', options: ['是'] },
          ],
          risks: [
            {
              level: 'HIGH',
              title: '重复',
              description: '重复付款',
              mitigation: '幂等',
            },
            { level: 'urgent', title: 'x' },
          ],
        })
      ),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  const { confirmationQuestions, missingInformation, risks } = result.analysis;
  assert.deepEqual(missingInformation, ['通知渠道']);
  assert.equal(confirmationQuestions.length, 1);
  assert.equal(confirmationQuestions[0].options.length, 3);
  assert.equal(confirmationQuestions[0].allowCustom, true);
  assert.deepEqual(
    risks.map((risk) => risk.level),
    ['high']
  );
  assert.equal(result.meta.detailsIncomplete, undefined);
});

test('repairs an unparsable part once', async () => {
  const mock = provider({
    plan: (attempt) =>
      attempt === 1
        ? response('计划如下：无')
        : response(JSON.stringify(validPlan)),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  assert.equal(mock.attempts.plan, 2);
  assert.match(mock.bodies.at(-1)!.body.messages.at(-1)!.content, /无法解析/);
  assert.equal(result.analysis.confirmationQuestions.length, 1);
});

test('still returns questions when only step details fail', async () => {
  const mock = provider({
    steps: () => response('{"steps":[', 'length'),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  assert.equal(mock.attempts.steps, 2);
  assert.equal(result.meta.detailsIncomplete, true);
  assert.equal(result.analysis.confirmationQuestions[0].id, 'threshold');
  assert.deepEqual(result.analysis.steps[0].inputs, []);
  assert.equal(result.analysis.missingInformation.length, 2);
});

test('returns the validated outline when both parts fail', async () => {
  const mock = provider({
    steps: () => new Response('busy', { status: 503 }),
    plan: () => new Response('busy', { status: 503 }),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  assert.equal(result.meta.detailsIncomplete, true);
  assert.deepEqual(
    result.analysis.steps.map((step) => [step.id, step.source]),
    [
      ['submit', 'source_text'],
      ['review', 'ai_inferred'],
      ['done', 'ai_inferred'],
    ]
  );
  assert.equal(result.analysis.confirmationQuestions.length, 0);
});

test('aborts provider work after the configured timeout', async () => {
  await assert.rejects(
    analyzeSopWithEvolink(input, {
      apiKey: 'test-provider-key',
      timeoutMs: 5,
      fetch: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    }),
    /timeout/i
  );
});

test('routes labelled condition branches without operands on decision', async () => {
  const unlabelled = {
    ...validSkeleton,
    steps: [
      {
        id: 'dedupe',
        title: '幂等校验',
        description: '检查单号',
        operation: 'condition',
        next: [
          { targetStepId: 'done', label: '新请求', branch: 'true' },
          { targetStepId: 'done', label: '重复请求', branch: 'false' },
        ],
      },
      validSkeleton.steps[2],
    ],
  };
  const mock = provider({
    skeleton: () => response(JSON.stringify(unlabelled)),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  assert.equal(mock.attempts.skeleton, 1);
  assert.deepEqual(
    result.analysis.steps[0].next.map((edge) => [
      edge.condition?.leftValue,
      edge.condition?.rightValue,
    ]),
    [
      ['{{$json.decision}}', '新请求'],
      ['{{$json.decision}}', '重复请求'],
    ]
  );
});

test('turns several default outcomes into exclusive branches', async () => {
  const outcomes = {
    ...validSkeleton,
    steps: [
      {
        id: 'stock',
        title: '查询库存',
        description: '调用 ERP 查询',
        operation: 'read',
        next: [
          { targetStepId: 'pick', label: '库存充足', branch: 'default' },
          { targetStepId: 'buy', label: '库存不足', branch: 'default' },
        ],
      },
      {
        id: 'pick',
        title: '领用',
        description: '仓库领用',
        operation: 'write',
        next: [
          { targetStepId: 'done', label: '同时通知仓库', branch: 'default' },
          { targetStepId: 'buy', label: '同时登记台账', branch: 'default' },
        ],
      },
      {
        id: 'buy',
        title: '审批',
        description: '按金额审批',
        operation: 'condition',
        next: [
          { targetStepId: 'done', label: '通过', branch: 'default' },
          { targetStepId: 'pick', label: '驳回', branch: 'default' },
        ],
      },
      validSkeleton.steps[2],
    ],
  };
  const mock = provider({
    skeleton: () => response(JSON.stringify(outcomes)),
  });
  const result = await analyzeSopWithEvolink(input, {
    apiKey: 'test-provider-key',
    fetch: mock.fetch,
  });
  const branches = result.analysis.steps.map((step) =>
    step.next.map((edge) => edge.branch)
  );
  assert.deepEqual(branches, [
    ['case', 'case'],
    ['default', 'default'],
    ['true', 'false'],
    [],
  ]);
  assert.equal(
    result.analysis.steps[2].next[0].condition?.leftValue,
    '{{$json.decision}}'
  );
});

test('corrects a manual trigger when the SOP states a daily time', async () => {
  const run = async (sop: string, triggerHint: 'auto' | 'webhook') => {
    const mock = provider({});
    const result = await analyzeSopWithEvolink(
      { sop, locale: 'zh', triggerHint },
      { apiKey: 'test-provider-key', fetch: mock.fetch }
    );
    return result.analysis.trigger;
  };
  assert.deepEqual(await run('每天晚上 10 点汇总退货单。', 'auto'), {
    type: 'schedule',
    description: '员工提交报销申请',
    schedule: { hour: 22, minute: 0, timezone: 'Asia/Shanghai' },
  });
  assert.equal((await run('员工提交报销。', 'auto')).type, 'manual');
  assert.equal((await run('每天 9 点检查。', 'webhook')).type, 'webhook');
});

test('stops at once when the account is out of credit', async () => {
  const mock = provider({
    skeleton: () => new Response('payment required', { status: 402 }),
  });
  await assert.rejects(
    analyzeSopWithEvolink(input, {
      apiKey: 'test-provider-key',
      fetch: mock.fetch,
    }),
    (error: any) => error.code === 'account_unavailable'
  );
  assert.equal(mock.attempts.skeleton, 1);
});
