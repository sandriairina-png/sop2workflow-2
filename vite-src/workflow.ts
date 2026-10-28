export type TriggerMode = 'manual' | 'schedule' | 'webhook';
export type Step = { id: string; title: string; detail: string; kind: 'trigger' | 'verify' | 'approve' | 'sync' | 'notify' | 'action' };
export type Result = { title: string; summary: string; steps: Step[]; workflow: Record<string, unknown>; checklist: string[]; tests: string[]; assumptions: string[] };

// Prompt templates for a future server-side AI adapter. Never put API keys in the browser.
export const ERP_ANALYSIS_PROMPT = `你是熟悉订单、库存、采购、财务和主数据的 ERP 流程分析师。
把用户 SOP 拆成结构化步骤，逐条保留原文的业务动作、先后关系、判断条件和异常处理。
识别触发方式、涉及系统、输入输出字段、审批角色、人工交接与缺失信息。
对未说明的字段或规则列出假设，不要把猜测当成事实，不要自动跳过审批。`;

export const ERP_WORKFLOW_PROMPT = `你是 n8n 工作流架构师。根据结构化 ERP SOP 生成可导入 n8n 的 JSON 草稿。
使用有效的 n8n 节点类型、唯一节点 ID、确定的位置和正确的 connections；显式呈现条件分支与失败路径。
绝不编造凭据 ID、真实 API 地址或密钥；未知的外部操作使用清晰标注的待配置节点。
输出 workflow JSON、简短摘要、假设、需要配置的凭据与接口、部署步骤和上线前测试清单。
默认 active=false；外部写操作与审批不可在缺少真实配置时自动执行。`;

const examples = [
  '每天 9 点从 ERP 拉取待发货订单，检查库存。库存充足则通知仓库拣货；不足则通知采购，并记录异常。',
  '销售提交新客户资料后，先校验税号和必填字段，再交由主管审批。审批通过后同步到 ERP 客户主数据并通知销售。',
  '采购订单超过 10 万元时，需要财务和采购主管审批；通过后在 ERP 创建订单，失败时通知负责人。'
];

export const EXAMPLES = examples;

function cleanLine(line: string) {
  return line.replace(/^\s*(?:[-*•]|\d+[.、)）]|步骤\s*\d+[:：]?|Step\s*\d+[:：]?)\s*/i, '').trim();
}

function classify(text: string): Step['kind'] {
  if (/审批|审核|批准|复核|approval/i.test(text)) return 'approve';
  if (/通知|提醒|发送|邮件|消息|预警/i.test(text)) return 'notify';
  if (/校验|检查|核对|验证|判断|库存|条件/i.test(text)) return 'verify';
  if (/同步|写入|创建|更新|录入|回写|推送.*ERP/i.test(text)) return 'sync';
  return 'action';
}

function splitSop(sop: string) {
  const lines = sop.split(/\n+/).map(cleanLine).filter(Boolean);
  if (lines.length > 1) return lines.slice(0, 18);
  return sop.split(/[。；;]+/).map(cleanLine).filter(Boolean).slice(0, 18);
}

function short(text: string, max = 19) {
  const first = text.split(/[，,:：。]/)[0];
  return first.length > max ? first.slice(0, max) + '…' : first;
}

function scheduleTime(sop: string) {
  const match = sop.match(/(?:每天|每日|上午|下午|早上|晚上)?\s*(上午|下午|早上|晚上)?\s*(\d{1,2})\s*(?:[:：点时]\s*(\d{1,2})?)?/);
  if (!match || !/[点时:：]/.test(match[0])) return { hour: 9, minute: 0 };
  let hour = Number(match[2]);
  const minute = Number(match[3] || 0);
  if (hour > 23 || minute > 59) return { hour: 9, minute: 0 };
  if (/下午|晚上/.test(match[0]) && hour < 12) hour += 12;
  return { hour, minute };
}

function triggerNode(mode: TriggerMode, sop: string) {
  if (mode === 'schedule') return {
    id: 'trigger', name: '定时触发', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
    position: [240, 300], parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: scheduleTime(sop).hour, triggerAtMinute: scheduleTime(sop).minute }] } }
  };
  if (mode === 'webhook') return {
    id: 'trigger', name: 'Webhook 触发', type: 'n8n-nodes-base.webhook', typeVersion: 2,
    position: [240, 300], webhookId: 'sop2workflow-draft', parameters: { httpMethod: 'POST', path: 'erp-sop-draft', responseMode: 'onReceived', options: {} }
  };
  return { id: 'trigger', name: '手动触发', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [240, 300], parameters: {} };
}

export function generateWorkflow(sop: string, mode: TriggerMode): Result {
  const parts = splitSop(sop);
  if (!parts.length) throw new Error('请先输入至少一个 SOP 步骤。');
  const time = scheduleTime(sop);
  const clock = `${time.hour}:${String(time.minute).padStart(2, '0')}`;

  const steps: Step[] = [
    { id: 'trigger', title: mode === 'schedule' ? '定时触发' : mode === 'webhook' ? 'Webhook 触发' : '手动触发', detail: mode === 'schedule' ? `每天 ${clock} 运行；请在 n8n 中核对时区` : mode === 'webhook' ? '接收来自 ERP 或业务系统的事件' : '手动启动并检查输入数据', kind: 'trigger' },
    ...parts.map((detail, index) => ({ id: `step-${index + 1}`, title: short(detail), detail, kind: classify(detail) }))
  ];

  const nodes: Record<string, unknown>[] = [triggerNode(mode, sop)];
  for (let index = 1; index < steps.length; index++) {
    const step = steps[index];
    const task = JSON.stringify({ step: index, kind: step.kind, instruction: step.detail });
    nodes.push({
      id: step.id, name: `${String(index).padStart(2, '0')} · ${step.title}`,
      type: 'n8n-nodes-base.code', typeVersion: 2, position: [240 + index * 260, 300],
      parameters: { mode: 'runOnceForAllItems', jsCode: `const task = ${task};\nreturn $input.all().map(item => ({ json: { ...item.json, sopTask: task, sopStatus: 'needs_configuration' } }));` }
    });
  }
  const connections: Record<string, unknown> = {};
  for (let index = 0; index < nodes.length - 1; index++) {
    const from = nodes[index].name as string;
    const to = nodes[index + 1].name as string;
    connections[from] = { main: [[{ node: to, type: 'main', index: 0 }]] };
  }
  const workflow = {
    name: `ERP SOP · ${short(parts[0], 28)}`, nodes, connections,
    settings: { executionOrder: 'v1' }, active: false, pinData: {},
    meta: { templateCredsSetupCompleted: false }
  };
  const kinds = new Set(steps.map(step => step.kind));
  const checklist = [
    '在 n8n 中导入 JSON，核对节点顺序与字段映射。',
    '将每个「待配置」步骤替换或连接到真实 ERP / OA / 消息服务节点，并绑定凭据。',
    ...(kinds.has('approve') ? ['确认审批人、审批超时和驳回路径；上线前保留人工确认。'] : []),
    ...(mode === 'schedule' ? ['按实际业务时区设置运行时间，避免重复执行。'] : []),
    ...(mode === 'webhook' ? ['将 Webhook 地址配置到来源系统，并验证请求签名。'] : []),
    '补充失败重试、异常通知和幂等处理后再启用工作流。'
  ];
  return {
    title: workflow.name, summary: `已从 SOP 提取 ${parts.length} 个业务步骤，生成可导入 n8n 的流程骨架。`,
    steps, workflow, checklist,
    assumptions: ['按原文顺序执行；条件分支需结合真实业务字段配置。', 'ERP API 地址、凭据和字段结构尚未提供，因此外部操作以待配置任务表示。'],
    tests: ['用一条正常业务数据手动运行，核对每步输出。', '测试缺失字段、审批驳回和 ERP 接口失败。', '确认重复触发不会产生重复单据。']
  };
}
