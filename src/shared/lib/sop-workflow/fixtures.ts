import { SopAnalysis, SopStep } from './schema';

function base(
  id: string,
  title: string,
  steps: SopStep[],
  trigger: SopAnalysis['trigger'] = {
    type: 'manual',
    description: '人工提交后触发',
  }
): SopAnalysis {
  return {
    schemaVersion: '1.0',
    title,
    summary: `${title}的结构化自动化草稿`,
    trigger,
    actors: [],
    steps,
    assumptions: ['业务字段名称需与实际 ERP 返回值核对。'],
    missingInformation: ['真实接口地址与字段映射。'],
    deploymentChecklist: ['配置凭据', '用测试数据完成一次分支验收'],
    risks: [
      {
        level: 'medium',
        title: '接口字段变化',
        description: 'ERP 升级可能改变返回字段。',
        mitigation: '上线前锁定接口版本并监控失败率。',
      },
    ],
    tests: [
      { name: `${id}-happy-path`, input: '正常数据', expected: '到达成功终点' },
    ],
  };
}

function step(
  id: string,
  operation: SopStep['operation'],
  next: SopStep['next'] = [],
  extra: Partial<SopStep> = {}
): SopStep {
  return {
    id,
    title: extra.title || id,
    description: extra.description || id,
    operation,
    inputs: [],
    outputs: [],
    next,
    errorHandling: [],
    ...extra,
  };
}

function amountEdge(
  targetStepId: string,
  label: string,
  branch: 'true' | 'false' | 'case',
  operator: 'greaterThanOrEqual' | 'lessThan',
  rightValue: number
) {
  return {
    targetStepId,
    label,
    branch,
    condition: {
      leftValue: '{{$json.amount}}',
      operator,
      rightValue,
      explanation: label,
    },
  } as const;
}

export const SOP_WORKFLOW_FIXTURES: Record<string, SopAnalysis> = {
  inventoryBranch: base(
    'inventory-branch',
    '每日库存分支',
    [
      step(
        'read-stock',
        'read',
        [{ targetStepId: 'check-stock', label: '读取完成', branch: 'default' }],
        {
          integration: {
            system: 'ERP',
            action: '读取库存',
            credentialRequired: true,
            endpointKnown: false,
          },
        }
      ),
      step('check-stock', 'condition', [
        {
          targetStepId: 'warehouse',
          label: '库存充足',
          branch: 'true',
          condition: {
            leftValue: '{{$json.stock}}',
            operator: 'greaterThan',
            rightValue: 0,
            explanation: '库存大于零',
          },
        },
        {
          targetStepId: 'procurement',
          label: '库存不足',
          branch: 'false',
          condition: {
            leftValue: '{{$json.stock}}',
            operator: 'lessThanOrEqual',
            rightValue: 0,
            explanation: '库存小于等于零',
          },
        },
      ]),
      step('warehouse', 'notify'),
      step('procurement', 'notify'),
    ],
    {
      type: 'schedule',
      description: '每天 9 点',
      schedule: { hour: 9, minute: 0, timezone: 'Asia/Shanghai' },
    }
  ),
  expenseBoundary: base('expense-boundary', '报销金额审批', [
    step('route-amount', 'condition', [
      amountEdge('manager', '小于 5000', 'false', 'lessThan', 5000),
      amountEdge(
        'finance',
        '大于等于 5000',
        'true',
        'greaterThanOrEqual',
        5000
      ),
    ]),
    step('manager', 'approve'),
    step('finance', 'approve'),
  ]),
  rejectionNotice: base('rejection-notice', '审批驳回通知', [
    step('approval', 'condition', [
      {
        targetStepId: 'approved',
        label: '审批通过',
        branch: 'true',
        condition: {
          leftValue: '{{$json.approved}}',
          operator: 'equals',
          rightValue: true,
          explanation: '审批通过',
        },
      },
      {
        targetStepId: 'notify-rejection',
        label: '审批驳回',
        branch: 'false',
        condition: {
          leftValue: '{{$json.approved}}',
          operator: 'equals',
          rightValue: false,
          explanation: '审批驳回',
        },
      },
    ]),
    step('approved', 'end'),
    step('notify-rejection', 'notify', [], {
      integration: {
        system: 'Email',
        action: '发送驳回原因',
        credentialRequired: true,
        endpointKnown: false,
      },
    }),
  ]),
  commaSeparated: base('comma-separated', '逗号分隔步骤', [
    step('read-order', 'read', [
      { targetStepId: 'transform', label: '继续', branch: 'default' },
    ]),
    step('transform', 'transform', [
      { targetStepId: 'write-result', label: '继续', branch: 'default' },
    ]),
    step('write-result', 'write'),
  ]),
  missingIntegration: base('missing-integration', '待配置 ERP 写入', [
    step('erp-write', 'write', [], {
      integration: {
        system: 'ERP',
        action: '创建采购申请',
        credentialRequired: true,
        endpointKnown: false,
      },
    }),
  ]),
};

export const MALFORMED_SOP_ANALYSIS = {
  ...SOP_WORKFLOW_FIXTURES.inventoryBranch,
  steps: [
    {
      ...SOP_WORKFLOW_FIXTURES.inventoryBranch.steps[0],
      next: [{ targetStepId: 'missing', label: '错误引用', branch: 'default' }],
    },
  ],
};
