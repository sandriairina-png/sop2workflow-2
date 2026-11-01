import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileN8nWorkflow,
  SYSTEM_ERROR_HANDLER_ID,
  toN8nExpression,
} from './compiler';
import { SopAnalysis, SopStep } from './schema';

function step(
  overrides: Partial<SopStep> & Pick<SopStep, 'id' | 'operation'>
): SopStep {
  return {
    title: overrides.id,
    description: overrides.id,
    source: 'source_text',
    inputs: [],
    outputs: [],
    next: [],
    errorHandling: [],
    ...overrides,
    id: overrides.id,
    operation: overrides.operation,
  };
}

function analysis(steps: SopStep[]): SopAnalysis {
  return {
    schemaVersion: '1.0',
    title: '测试流程',
    summary: '测试结构化流程',
    trigger: {
      type: 'schedule',
      description: '每天 9 点',
      schedule: { hour: 9, minute: 0, timezone: 'Asia/Shanghai' },
    },
    actors: [],
    steps,
    assumptions: [],
    missingInformation: [],
    confirmationQuestions: [],
    deploymentChecklist: [],
    risks: [],
    tests: [],
  };
}

function condition(
  targetStepId: string,
  branch: 'true' | 'false' | 'case',
  operator: 'greaterThan' | 'greaterThanOrEqual' | 'lessThan',
  rightValue: number,
  label: string
) {
  return {
    targetStepId,
    branch,
    label,
    condition: {
      leftValue: '{{$json.amount}}',
      operator,
      rightValue,
      explanation: label,
    },
  } as const;
}

test('compiles a daily schedule trigger', () => {
  const result = compileN8nWorkflow(
    analysis([step({ id: 'done', operation: 'end' })])
  );
  assert.equal(result.nodes[0].type, 'n8n-nodes-base.scheduleTrigger');
  assert.deepEqual(result.nodes[0].parameters.rule, {
    interval: [
      {
        field: 'days',
        daysInterval: 1,
        triggerAtHour: 9,
        triggerAtMinute: 0,
      },
    ],
  });
});

test('compiles inventory outcomes to true and false outputs', () => {
  const source = analysis([
    step({
      id: 'check-stock',
      operation: 'condition',
      next: [
        condition('notify-warehouse', 'true', 'greaterThan', 0, '库存充足'),
        condition('notify-purchase', 'false', 'lessThan', 1, '库存不足'),
      ],
    }),
    step({ id: 'notify-warehouse', operation: 'notify' }),
    step({ id: 'notify-purchase', operation: 'notify' }),
  ]);
  const result = compileN8nWorkflow(source);
  const ifNode = result.nodes.find((node) => node.id === 'check-stock')!;
  assert.equal(ifNode.type, 'n8n-nodes-base.if');
  const outputs = (result.connections[ifNode.name] as any).main;
  assert.equal(outputs[0][0].node, 'notify-warehouse');
  assert.equal(outputs[1][0].node, 'notify-purchase');
});

test('preserves greater-than-or-equal 5000 in an If node', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'amount-check',
        operation: 'condition',
        next: [
          condition(
            'finance',
            'true',
            'greaterThanOrEqual',
            5000,
            '大于等于 5000'
          ),
          condition('manager', 'false', 'lessThan', 5000, '小于 5000'),
        ],
      }),
      step({ id: 'finance', operation: 'approve' }),
      step({ id: 'manager', operation: 'approve' }),
    ])
  );
  const node = result.nodes.find(
    (candidate) => candidate.id === 'amount-check'
  )!;
  const item = (node.parameters.conditions as any).conditions[0];
  assert.equal(item.operator.operation, 'gte');
  assert.equal(item.rightValue, 5000);
});

test('maps approval rejection follow-up to notification semantics', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'notify-rejection',
        title: '审批驳回后通知员工',
        operation: 'notify',
        integration: {
          system: 'Email',
          action: '发送驳回通知',
          credentialRequired: true,
          endpointKnown: false,
        },
      }),
    ])
  );
  assert.equal(
    result.nodes.find((node) => node.id === 'notify-rejection')?.type,
    'n8n-nodes-base.emailSend'
  );
});

test('maps three cases to Switch output indexes', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'route',
        operation: 'condition',
        next: [
          condition('a', 'case', 'lessThan', 1000, '低'),
          condition('b', 'case', 'lessThan', 5000, '中'),
          condition('c', 'case', 'greaterThanOrEqual', 5000, '高'),
        ],
      }),
      step({ id: 'a', operation: 'end' }),
      step({ id: 'b', operation: 'end' }),
      step({ id: 'c', operation: 'end' }),
    ])
  );
  const switchNode = result.nodes.find((node) => node.id === 'route')!;
  assert.equal(switchNode.type, 'n8n-nodes-base.switch');
  const outputs = (result.connections[switchNode.name] as any).main;
  assert.equal(outputs[0][0].node, 'a');
  assert.equal(outputs[1][0].node, 'b');
  assert.equal(outputs[2][0].node, 'c');
});

test('compiles explicit merge nodes and incoming connections', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'left',
        operation: 'transform',
        next: [{ targetStepId: 'join', label: '完成', branch: 'default' }],
      }),
      step({ id: 'join', operation: 'merge' }),
    ])
  );
  assert.equal(
    result.nodes.find((node) => node.id === 'join')?.type,
    'n8n-nodes-base.merge'
  );
  assert.equal((result.connections.left as any).main[0][0].node, 'join');
});

test('uses a disabled HTTP Request placeholder without secrets', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'erp-write',
        operation: 'write',
        integration: {
          system: 'ERP',
          action: '创建采购申请',
          credentialRequired: true,
          endpointKnown: false,
        },
      }),
    ])
  );
  const node = result.nodes.find((candidate) => candidate.id === 'erp-write')!;
  assert.equal(node.type, 'n8n-nodes-base.httpRequest');
  assert.equal(node.disabled, true);
  assert.match(String(node.parameters.url), /replace-me\.invalid/);
  assert.doesNotMatch(JSON.stringify(result), /sk-[a-z0-9_-]{16,}/i);
  assert.ok(result.configurationRequirements.length > 0);
});

test('exports inactive workflows', () => {
  const result = compileN8nWorkflow(
    analysis([step({ id: 'done', operation: 'end' })])
  );
  assert.equal(result.active, false);
});

// Every n8n error output (the slot after the business outputs) must point at
// the shared system error handler, never at a business step.
function errorTargets(result: ReturnType<typeof compileN8nWorkflow>) {
  return result.nodes
    .filter((node) => node.onError === 'continueErrorOutput')
    .map((node) => {
      const outputs = (result.connections[node.name] as any).main;
      return outputs[outputs.length - 1].map((link: any) => link.node);
    });
}

test('routes system errors to the shared handler instead of business steps', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'erp-read',
        operation: 'read',
        next: [{ targetStepId: 'done', label: '成功', branch: 'default' }],
        errorHandling: [
          {
            scenario: 'ERP 超时',
            action: '通知管理员',
            targetStepId: 'done',
          },
        ],
      }),
      step({ id: 'done', operation: 'end' }),
    ])
  );
  const source = result.nodes.find((node) => node.id === 'erp-read')!;
  assert.equal(source.onError, 'continueErrorOutput');
  const outputs = (result.connections[source.name] as any).main;
  assert.equal(outputs[0][0].node, 'done');
  assert.deepEqual(
    outputs[1].map((link: any) => link.node),
    ['系统异常处理']
  );
  const handlers = result.nodes.filter(
    (node) => node.id === SYSTEM_ERROR_HANDLER_ID
  );
  assert.equal(handlers.length, 1);
});

test('never gives condition nodes an error output', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'check-credit',
        operation: 'condition',
        next: [
          condition('create-order', 'true', 'greaterThan', 0, '额度充足'),
          condition('prepay', 'false', 'lessThan', 1, '额度不足'),
        ],
        errorHandling: [
          {
            scenario: '信用接口查询超时',
            action: '告警',
            targetStepId: 'prepay',
          },
          {
            scenario: '单据缺失',
            action: '冻结并通知采购员',
            targetStepId: 'prepay',
            kind: 'business',
          },
        ],
      }),
      step({ id: 'create-order', operation: 'end' }),
      step({ id: 'prepay', operation: 'end' }),
    ])
  );
  const ifNode = result.nodes.find((node) => node.id === 'check-credit')!;
  // n8n If nodes push failed items into the false branch when they continue
  // on error, so they must not have one.
  assert.equal(ifNode.onError, undefined);
  const outputs = (result.connections[ifNode.name] as any).main;
  assert.equal(outputs.length, 2);
  assert.deepEqual(
    outputs[0].map((link: any) => link.node),
    ['create-order']
  );
  assert.deepEqual(
    outputs[1].map((link: any) => link.node),
    ['prepay']
  );
  assert.ok(
    result.configurationRequirements.some((item) => item.includes('单据缺失'))
  );
});

test('routes every API error output to the handler only', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'fetch',
        operation: 'read',
        next: [{ targetStepId: 'check', label: '读取完成', branch: 'default' }],
      }),
      step({
        id: 'check',
        operation: 'condition',
        next: [
          condition('pay', 'true', 'greaterThan', 0, '通过'),
          condition('reject', 'false', 'lessThan', 1, '不通过'),
        ],
      }),
      step({
        id: 'pay',
        operation: 'write',
        next: [{ targetStepId: 'done', label: '完成', branch: 'default' }],
      }),
      step({
        id: 'reject',
        operation: 'notify',
        next: [{ targetStepId: 'done', label: '完成', branch: 'default' }],
      }),
      step({ id: 'done', operation: 'end' }),
    ])
  );
  const targets = errorTargets(result);
  assert.equal(targets.length, 2);
  for (const nodes of targets) assert.deepEqual(nodes, ['系统异常处理']);
});

test('does not add an error output for business-only exceptions', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'stock-check',
        operation: 'condition',
        next: [
          condition('ship', 'true', 'greaterThan', 0, '有货'),
          condition('purchase', 'false', 'lessThan', 1, '缺货'),
        ],
        errorHandling: [
          {
            scenario: '库存不足',
            action: '生成采购需求',
            targetStepId: 'purchase',
          },
        ],
      }),
      step({ id: 'ship', operation: 'end' }),
      step({ id: 'purchase', operation: 'end' }),
    ])
  );
  const node = result.nodes.find(
    (candidate) => candidate.id === 'stock-check'
  )!;
  assert.equal(node.onError, undefined);
  assert.equal((result.connections[node.name] as any).main.length, 2);
  assert.ok(
    !result.nodes.some((candidate) => candidate.id === SYSTEM_ERROR_HANDLER_ID)
  );
});

test('sends a business failure branch to the If false output', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'review',
        operation: 'condition',
        next: [
          {
            ...condition('resubmit', 'case', 'lessThan', 1, '驳回'),
            branch: 'error',
          },
          condition('pay', 'true', 'greaterThan', 0, '通过'),
        ],
      }),
      step({ id: 'resubmit', operation: 'end' }),
      step({ id: 'pay', operation: 'end' }),
    ])
  );
  const outputs = (result.connections.review as any).main;
  assert.equal(outputs[0][0].node, 'pay');
  assert.equal(outputs[1][0].node, 'resubmit');
});

test('routes approval outcomes through a Switch so only one branch runs', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'manager-approval',
        title: '经理审批',
        operation: 'approve',
        next: [
          { targetStepId: 'pay', label: '通过', branch: 'true' },
          { targetStepId: 'notify-reject', label: '驳回', branch: 'error' },
        ],
      }),
      step({ id: 'pay', operation: 'end' }),
      step({ id: 'notify-reject', operation: 'end' }),
    ])
  );
  const approval = (result.connections['manager-approval'] as any).main;
  assert.deepEqual(
    approval.map((targets: any[]) => targets.map((link) => link.node)),
    [['manager-approval_route']]
  );
  const router = result.nodes.find(
    (node) => node.id === 'manager-approval_route'
  )!;
  assert.equal(router.type, 'n8n-nodes-base.switch');
  const routed = (result.connections[router.name] as any).main;
  // The rejection rule is checked first.
  assert.deepEqual(
    routed.map((targets: any[]) => targets.map((link) => link.node)),
    [['notify-reject'], ['pay']]
  );
  const rule = (router.parameters.rules as any).values[0].conditions
    .conditions[0];
  assert.equal(rule.leftValue, '={{$json.decision}}');
  assert.equal(rule.rightValue, '驳回');
  assert.ok(
    result.configurationRequirements.some((item) => item.includes('经理审批'))
  );
});

test('checks rejection before amount rules that cover every amount', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'fm',
        operation: 'approve',
        next: [
          condition('cfo', 'case', 'greaterThanOrEqual', 100000, '金额>=10万'),
          condition('pay', 'case', 'lessThan', 100000, '金额<10万'),
          { targetStepId: 'reject', label: '驳回', branch: 'false' },
        ],
      }),
      step({ id: 'cfo', operation: 'end' }),
      step({ id: 'pay', operation: 'end' }),
      step({ id: 'reject', operation: 'end' }),
    ])
  );
  const routed = (result.connections.fm_route as any).main;
  assert.deepEqual(
    routed.map((targets: any[]) => targets.map((link) => link.node)),
    [['reject'], ['cfo'], ['pay']]
  );
});

test('sends a default success edge to the router fallback, not straight on', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'approve',
        operation: 'approve',
        next: [
          { targetStepId: 'pay', label: '审批通过', branch: 'default' },
          { targetStepId: 'reject', label: '审批驳回', branch: 'error' },
        ],
      }),
      step({ id: 'pay', operation: 'end' }),
      step({ id: 'reject', operation: 'end' }),
    ])
  );
  assert.deepEqual(
    (result.connections.approve as any).main.map((targets: any[]) =>
      targets.map((link) => link.node)
    ),
    [['approve_route']]
  );
  const router = result.nodes.find((node) => node.id === 'approve_route')!;
  assert.deepEqual(router.parameters.options, { fallbackOutput: 'extra' });
  assert.deepEqual(
    (result.connections.approve_route as any).main.map((targets: any[]) =>
      targets.map((link) => link.node)
    ),
    [['reject'], ['pay']]
  );
});

test('prefixes condition operands so n8n evaluates them', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'check',
        operation: 'condition',
        next: [
          condition('a', 'true', 'greaterThan', 0, '有'),
          {
            ...condition('b', 'false', 'lessThan', 1, '无'),
            condition: {
              leftValue: 'stock',
              operator: 'lessThan',
              rightValue: 1,
              explanation: '无',
            },
          },
        ],
      }),
      step({ id: 'a', operation: 'end' }),
      step({ id: 'b', operation: 'end' }),
    ])
  );
  const node = result.nodes.find((candidate) => candidate.id === 'check')!;
  assert.equal(
    (node.parameters.conditions as any).conditions[0].leftValue,
    '={{$json.amount}}'
  );
  assert.equal(toN8nExpression('stock'), '={{ $json.stock }}');
  assert.equal(
    toN8nExpression('$json.order.total'),
    '={{ $json.order.total }}'
  );
  assert.equal(toN8nExpression('={{ $json.x }}'), '={{ $json.x }}');
  assert.equal(toN8nExpression('金额达到门槛'), '金额达到门槛');
});

test('keeps generated router and handler names unique', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'a',
        operation: 'approve',
        next: [
          { targetStepId: 'a_route', label: '通过', branch: 'true' },
          {
            targetStepId: 'system_error_handler',
            label: '驳回',
            branch: 'false',
          },
        ],
      }),
      step({
        id: 'a_route',
        operation: 'read',
        next: [
          {
            targetStepId: 'system_error_handler',
            label: '完成',
            branch: 'default',
          },
        ],
      }),
      step({ id: 'system_error_handler', operation: 'end' }),
    ])
  );
  const names = result.nodes.map((node) => node.name);
  const ids = result.nodes.map((node) => node.id);
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(names.includes('a_route_2'));
  assert.deepEqual(
    (result.connections.a_route_2 as any).main.map((targets: any[]) =>
      targets.map((link) => link.node)
    ),
    [['system_error_handler'], ['a_route']]
  );
});

test('keeps parallel default edges on the main output', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'approved',
        operation: 'transform',
        next: [
          { targetStepId: 'create-order', label: '建单', branch: 'default' },
          { targetStepId: 'lock-stock', label: '锁库', branch: 'default' },
        ],
      }),
      step({ id: 'create-order', operation: 'end' }),
      step({ id: 'lock-stock', operation: 'end' }),
    ])
  );
  assert.deepEqual(
    (result.connections.approved as any).main[0].map((link: any) => link.node),
    ['create-order', 'lock-stock']
  );
  assert.ok(!result.nodes.some((node) => node.id === 'approved_route'));
});
