export type TriggerMode = 'manual' | 'schedule' | 'webhook';

export type WorkflowStepKind =
  | 'trigger'
  | 'verify'
  | 'approve'
  | 'sync'
  | 'notify'
  | 'action';

export type WorkflowStep = {
  id: string;
  title: string;
  detail: string;
  kind: WorkflowStepKind;
};

export type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  webhookId?: string;
};

export type SopWorkflowResult = {
  title: string;
  summary: string;
  steps: WorkflowStep[];
  workflow: {
    name: string;
    nodes: N8nNode[];
    connections: Record<string, unknown>;
    settings: { executionOrder: 'v1' };
    active: false;
    pinData: Record<string, never>;
    meta: { templateCredsSetupCompleted: false };
  };
  checklist: string[];
  assumptions: string[];
  tests: string[];
};

export const ERP_SOP_ANALYSIS_PROMPT = `你是熟悉订单、库存、采购、财务和主数据的 ERP 流程分析师。
把用户 SOP 拆成结构化步骤，逐条保留业务动作、先后关系、判断条件和异常处理。
识别触发方式、涉及系统、输入输出字段、审批角色、人工交接与缺失信息。
对未说明的字段或规则列出假设，不要把猜测当成事实，不要自动跳过审批。`;

export const N8N_WORKFLOW_PROMPT = `你是 n8n 工作流架构师。根据结构化 ERP SOP 生成可导入 n8n 的 JSON 草稿。
使用有效的 n8n 节点类型、唯一节点 ID、确定的位置和正确的 connections；显式呈现条件分支与失败路径。
绝不编造凭据 ID、真实 API 地址或密钥；未知的外部操作使用清晰标注的待配置节点。
输出 workflow JSON、简短摘要、假设、需要配置的凭据与接口、部署步骤和上线前测试清单。
默认 active=false；外部写操作与审批不可在缺少真实配置时自动执行。`;

export const SOP_EXAMPLES = [
  '每天 9 点从 ERP 拉取待发货订单，检查库存。库存充足则通知仓库拣货；库存不足则通知采购，并记录异常。',
  '销售提交新客户资料后，先校验税号和必填字段，再交由主管审批。审批通过后同步到 ERP 客户主数据并通知销售。',
  '采购订单超过 10 万元时，需要财务和采购主管审批；通过后在 ERP 创建订单，失败时通知负责人。',
];

export * from './sop-workflow/graph';
export * from './sop-workflow/compiler';
export * from './sop-workflow/evolink';
export * from './sop-workflow/prompt';
export * from './sop-workflow/schema';

function cleanLine(line: string) {
  return line
    .replace(
      /^\s*(?:[-*•]|\d+[.、)）]|步骤\s*\d+[:：]?|Step\s*\d+[:：]?)\s*/i,
      ''
    )
    .trim();
}

function splitSop(sop: string) {
  const lines = sop.split(/\n+/).map(cleanLine).filter(Boolean);
  if (lines.length > 1) return lines.slice(0, 18);
  return sop
    .split(/[。；;]+/)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 18);
}

function classify(text: string): WorkflowStepKind {
  if (/审批|审核|批准|复核|approval/i.test(text)) return 'approve';
  if (/通知|提醒|发送|邮件|消息|预警|notify/i.test(text)) return 'notify';
  if (/校验|检查|核对|验证|判断|库存|条件|validate/i.test(text)) {
    return 'verify';
  }
  if (/同步|写入|创建|更新|录入|回写|推送.*ERP|sync/i.test(text)) {
    return 'sync';
  }
  return 'action';
}

function short(text: string, max = 22) {
  const first = text.split(/[，,:：。]/)[0];
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

function scheduleTime(sop: string) {
  const match = sop.match(
    /(?:每天|每日|上午|下午|早上|晚上)?\s*(上午|下午|早上|晚上)?\s*(\d{1,2})\s*(?:[:：点时]\s*(\d{1,2})?)?/
  );
  if (!match || !/[点时:：]/.test(match[0])) return { hour: 9, minute: 0 };

  let hour = Number(match[2]);
  const minute = Number(match[3] || 0);
  if (hour > 23 || minute > 59) return { hour: 9, minute: 0 };
  if (/下午|晚上/.test(match[0]) && hour < 12) hour += 12;
  return { hour, minute };
}

function createTrigger(mode: TriggerMode, sop: string): N8nNode {
  if (mode === 'schedule') {
    const time = scheduleTime(sop);
    return {
      id: 'trigger',
      name: 'Schedule Trigger',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [240, 320],
      parameters: {
        rule: {
          interval: [
            {
              field: 'days',
              daysInterval: 1,
              triggerAtHour: time.hour,
              triggerAtMinute: time.minute,
            },
          ],
        },
      },
    };
  }

  if (mode === 'webhook') {
    return {
      id: 'trigger',
      name: 'Webhook Trigger',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 320],
      webhookId: 'sop2workflow-draft',
      parameters: {
        httpMethod: 'POST',
        path: 'erp-sop-draft',
        responseMode: 'onReceived',
        options: {},
      },
    };
  }

  return {
    id: 'trigger',
    name: 'Manual Trigger',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [240, 320],
    parameters: {},
  };
}

export function generateSopWorkflow(
  sop: string,
  mode: TriggerMode,
  language: 'zh' | 'en' = 'en'
): SopWorkflowResult {
  const normalized = sop.trim();
  if (!normalized) throw new Error('Please provide an SOP before generating.');

  const parts = splitSop(normalized);
  if (!parts.length) throw new Error('Please provide at least one SOP step.');

  const time = scheduleTime(normalized);
  const clock = `${time.hour}:${String(time.minute).padStart(2, '0')}`;
  const zh = language === 'zh';
  const steps: WorkflowStep[] = [
    {
      id: 'trigger',
      title:
        mode === 'schedule'
          ? zh
            ? '定时触发'
            : 'Scheduled trigger'
          : mode === 'webhook'
            ? zh
              ? 'Webhook 触发'
              : 'Webhook trigger'
            : zh
              ? '手动触发'
              : 'Manual trigger',
      detail:
        mode === 'schedule'
          ? zh
            ? `每天 ${clock} 运行；请在 n8n 中确认工作流时区。`
            : `Runs daily at ${clock}; confirm the workflow timezone in n8n.`
          : mode === 'webhook'
            ? zh
              ? '接收来自 ERP 或其他业务系统的事件。'
              : 'Receives an event from the ERP or another business system.'
            : zh
              ? '使用可审阅的输入数据手动启动。'
              : 'Starts manually with reviewable input data.',
      kind: 'trigger',
    },
    ...parts.map((detail, index) => ({
      id: `step-${index + 1}`,
      title: short(detail),
      detail,
      kind: classify(detail),
    })),
  ];

  const nodes: N8nNode[] = [createTrigger(mode, normalized)];
  for (let index = 1; index < steps.length; index += 1) {
    const step = steps[index];
    const task = JSON.stringify({
      step: index,
      kind: step.kind,
      instruction: step.detail,
    });
    nodes.push({
      id: step.id,
      name: `${String(index).padStart(2, '0')} · ${step.title}`,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [240 + index * 260, 320],
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `const task = ${task};\nreturn $input.all().map(item => ({ json: { ...item.json, sopTask: task, sopStatus: 'needs_configuration' } }));`,
      },
    });
  }

  const connections: Record<string, unknown> = {};
  for (let index = 0; index < nodes.length - 1; index += 1) {
    connections[nodes[index].name] = {
      main: [[{ node: nodes[index + 1].name, type: 'main', index: 0 }]],
    };
  }

  const workflow = {
    name: `ERP SOP · ${short(parts[0], 30)}`,
    nodes,
    connections,
    settings: { executionOrder: 'v1' as const },
    active: false as const,
    pinData: {},
    meta: { templateCredsSetupCompleted: false as const },
  };

  return {
    title: workflow.name,
    summary: zh
      ? `已将 ${parts.length} 个业务步骤转换为可导入 n8n 的流程草稿。`
      : `${parts.length} business steps were converted into an importable n8n draft.`,
    steps,
    workflow,
    checklist: zh
      ? [
          '将 JSON 导入 n8n，并确认节点顺序。',
          '把占位任务连接到真实的 ERP、审批或消息服务。',
          '映射生产字段，并在 n8n 中绑定凭据。',
          '激活前补充重试、幂等和失败通知规则。',
        ]
      : [
          'Import the JSON into n8n and confirm the node order.',
          'Connect each placeholder task to the real ERP, approval, or messaging service.',
          'Map production fields and bind credentials inside n8n.',
          'Add retry, idempotency, and failure notification rules before activation.',
        ],
    assumptions: zh
      ? [
          '除非在 n8n 中配置分支，否则步骤按输入顺序执行。',
          '尚未提供 ERP 接口、字段结构和账号凭据。',
        ]
      : [
          'Steps run in the order provided unless a branch is configured in n8n.',
          'ERP endpoints, field schemas, and credentials were not supplied.',
        ],
    tests: zh
      ? [
          '使用一条正常记录运行，并检查每个节点输出。',
          '测试字段缺失、审批拒绝和 ERP 接口失败。',
          '确认重复触发不会创建重复的 ERP 记录。',
        ]
      : [
          'Run one normal record and inspect every node output.',
          'Test missing fields, approval rejection, and ERP API failure.',
          'Confirm repeated triggers cannot create duplicate ERP records.',
        ],
  };
}
