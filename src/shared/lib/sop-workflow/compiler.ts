import { validateSopAnalysisGraph } from './graph';
import {
  classifyErrorHandling,
  SopAnalysis,
  SopConnection,
  SopStep,
} from './schema';

export type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  disabled?: boolean;
  webhookId?: string;
  onError?: 'continueErrorOutput';
};

export type N8nWorkflow = {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  settings: { executionOrder: 'v1'; timezone?: string };
  active: false;
  pinData: Record<string, never>;
  meta: { templateCredsSetupCompleted: false };
  configurationRequirements: string[];
};

export type SopWorkflowResult = {
  analysis: SopAnalysis;
  workflow: N8nWorkflow;
};

const operatorMap: Record<string, string> = {
  equals: 'equals',
  notEquals: 'notEquals',
  greaterThan: 'gt',
  greaterThanOrEqual: 'gte',
  lessThan: 'lt',
  lessThanOrEqual: 'lte',
  contains: 'contains',
  isEmpty: 'empty',
  isNotEmpty: 'notEmpty',
};

// n8n evaluates a parameter as an expression only when it starts with '='.
// Bare field names become $json lookups; other text stays literal.
export function toN8nExpression(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('=')) return trimmed;
  if (trimmed.includes('{{')) return `=${trimmed}`;
  if (/^[A-Za-z_$][\w$.]*$/.test(trimmed)) {
    return `={{ $json.${trimmed.replace(/^\$json\./, '')} }}`;
  }
  return trimmed;
}

function conditionItem(connection: SopConnection, index: number) {
  const condition = connection.condition;
  if (!condition) return null;
  const valueType =
    typeof condition.rightValue === 'number'
      ? 'number'
      : typeof condition.rightValue === 'boolean'
        ? 'boolean'
        : 'string';
  return {
    id: `condition-${index + 1}`,
    leftValue: toN8nExpression(condition.leftValue),
    rightValue: condition.rightValue ?? '',
    operator: {
      type: valueType,
      operation: operatorMap[condition.operator],
    },
  };
}

function conditionGroup(connection: SopConnection, index: number) {
  const item = conditionItem(connection, index);
  return {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 2,
      },
      conditions: item ? [item] : [],
      combinator: 'and',
    },
    renameOutput: true,
    outputKey: connection.label,
  };
}

// Node names and setup requirements are read by business users in n8n, so
// they follow the SOP's language instead of exposing internal step ids.
function isChinese(analysis: SopAnalysis) {
  return [analysis.title, ...analysis.steps.map((step) => step.title)].some(
    (text) => /[一-鿿]/.test(text)
  );
}

type Say = (zh: string, en: string) => string;

function quoted(labels: string[], zh: boolean) {
  return labels
    .map((label) => (zh ? `“${label}”` : `"${label}"`))
    .join(zh ? '、' : ', ');
}

function makeTrigger(analysis: SopAnalysis, say: Say): N8nNode {
  if (analysis.trigger.type === 'schedule') {
    const schedule = analysis.trigger.schedule || { hour: 9, minute: 0 };
    return {
      id: 'trigger',
      name: say('定时触发', 'Schedule Trigger'),
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [120, 320],
      parameters: {
        rule: {
          interval: [
            {
              field: 'days',
              daysInterval: 1,
              triggerAtHour: schedule.hour,
              triggerAtMinute: schedule.minute,
            },
          ],
        },
      },
    };
  }
  if (analysis.trigger.type === 'webhook') {
    return {
      id: 'trigger',
      name: say('Webhook 触发', 'Webhook Trigger'),
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [120, 320],
      webhookId: 'sop2workflow-draft',
      parameters: {
        httpMethod: 'POST',
        path: 'sop2workflow-draft',
        responseMode: 'onReceived',
        options: {},
      },
    };
  }
  return {
    id: 'trigger',
    name: say('手动触发', 'Manual Trigger'),
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [120, 320],
    parameters: {},
  };
}

function nodeForStep(
  step: SopStep,
  index: number,
  name: string,
  requirements: string[],
  say: Say
): N8nNode {
  const base = {
    id: step.id,
    name,
    position: [420 + index * 280, 320] as [number, number],
  };

  if (step.operation === 'condition') {
    if (step.next.length === 2) {
      const primary =
        step.next.find((edge) => edge.branch === 'true') || step.next[0];
      return {
        ...base,
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        parameters: {
          conditions: conditionGroup(primary, 0).conditions,
          options: {},
        },
      };
    }
    return {
      ...base,
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      parameters: {
        rules: {
          values: step.next.map(conditionGroup),
        },
        options: {},
      },
    };
  }

  if (step.operation === 'read' || step.operation === 'write') {
    const needsConfig =
      !step.integration?.endpointKnown ||
      Boolean(step.integration?.credentialRequired);
    if (needsConfig) {
      requirements.push(
        say(
          `${step.title}：配置${step.integration?.system || '业务系统'}的接口地址和登录凭证。`,
          `${step.title}: configure ${step.integration?.system || 'system'} endpoint and credentials.`
        )
      );
    }
    return {
      ...base,
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      disabled: needsConfig,
      parameters: {
        method: step.operation === 'read' ? 'GET' : 'POST',
        url: 'https://replace-me.invalid/api',
        sendBody: step.operation === 'write',
        options: {},
      },
    };
  }

  if (step.operation === 'notify') {
    if (/email|邮件|邮箱/i.test(step.integration?.system || '')) {
      requirements.push(
        say(
          `${step.title}：配置发件邮箱账号和收件人。`,
          `${step.title}: configure email credentials and recipient.`
        )
      );
      return {
        ...base,
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2.1,
        disabled: true,
        parameters: {
          fromEmail: 'replace-me@example.invalid',
          toEmail: 'replace-me@example.invalid',
          subject: step.title,
          emailFormat: 'text',
          text: step.description,
          options: {},
        },
      };
    }
    requirements.push(
      say(
        `${step.title}：选择并配置通知渠道，例如邮件、企业微信或短信。`,
        `${step.title}: choose and configure a notification channel.`
      )
    );
    return {
      ...base,
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      disabled: true,
      parameters: { notice: step.description },
    };
  }

  if (step.operation === 'transform') {
    return {
      ...base,
      type: 'n8n-nodes-base.set',
      typeVersion: 3.4,
      parameters: { assignments: { assignments: [] }, options: {} },
    };
  }

  if (step.operation === 'wait') {
    return {
      ...base,
      type: 'n8n-nodes-base.wait',
      typeVersion: 1.1,
      parameters: { amount: 1, unit: 'minutes' },
    };
  }

  if (step.operation === 'merge') {
    return {
      ...base,
      type: 'n8n-nodes-base.merge',
      typeVersion: 3.2,
      parameters: { mode: 'append' },
    };
  }

  if (step.operation === 'approve') {
    requirements.push(
      say(
        `${step.title}：配置审批方式和审批人。`,
        `${step.title}: configure the approval channel and assignee.`
      )
    );
  }
  return {
    ...base,
    type: 'n8n-nodes-base.noOp',
    typeVersion: 1,
    disabled: step.operation === 'approve',
    parameters:
      step.operation === 'approve' ? { notice: step.description } : {},
  };
}

export const SYSTEM_ERROR_HANDLER_ID = 'system_error_handler';

const ERROR_PRONE_NODE_TYPES = new Set([
  'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.emailSend',
]);

// IF/Switch outputs for a condition step. The `true` edge drives the If node's
// condition, so it owns output 0; every other edge (false, or a business
// failure such as a rejection) takes output 1.
function conditionOutputIndex(step: SopStep, index: number) {
  if (step.next.length > 2) return index;
  const primary = step.next.findIndex((edge) => edge.branch === 'true');
  return index === (primary === -1 ? 0 : primary) ? 0 : 1;
}

// Non-condition steps (approval, wait, write...) have a single main output in
// n8n, so labelled business branches need a Switch after them; otherwise every
// branch would run at once.
function needsRouter(step: SopStep) {
  return (
    step.operation !== 'condition' &&
    step.next.some((edge) => edge.branch !== 'default')
  );
}

const BRANCH_PRIORITY: Record<SopConnection['branch'], number> = {
  error: 0,
  false: 1,
  case: 2,
  true: 3,
  default: 4,
};

// Switch stops at the first matching rule, so failure branches (rejection,
// out of stock) are checked before amount or success rules that could
// otherwise swallow them.
function routedEdges(step: SopStep) {
  return step.next
    .filter((edge) => edge.branch !== 'default')
    .map((edge, order) => ({ edge, order }))
    .sort(
      (a, b) =>
        BRANCH_PRIORITY[a.edge.branch] - BRANCH_PRIORITY[b.edge.branch] ||
        a.order - b.order
    )
    .map(({ edge }) => edge);
}

function decisionRequirement(step: SopStep, labels: string[], zh: boolean) {
  return zh
    ? `${step.title}：在这一步的结果里写明处理结论（n8n 字段名 decision），取值为${quoted(labels, true)}之一，流程会据此只走对应的分支。`
    : `${step.title}: set {{$json.decision}} to one of ${quoted(labels, false)} so the workflow takes a single branch.`;
}

function routerNode(
  step: SopStep,
  id: string,
  name: string,
  position: [number, number],
  requirements: string[],
  zh: boolean
): N8nNode {
  const branches = routedEdges(step);
  const hasFallback = step.next.some((edge) => edge.branch === 'default');
  const decisionBranches = branches.filter((edge) => !edge.condition);
  if (decisionBranches.length) {
    requirements.push(
      decisionRequirement(
        step,
        decisionBranches.map((edge) => edge.label),
        zh
      )
    );
  }
  return {
    id,
    name,
    type: 'n8n-nodes-base.switch',
    typeVersion: 3.2,
    position,
    parameters: {
      rules: {
        values: branches.map((edge, index) =>
          conditionGroup(
            {
              ...edge,
              condition: edge.condition || {
                leftValue: '{{$json.decision}}',
                operator: 'equals',
                rightValue: edge.label,
                explanation: edge.label,
              },
            },
            index
          )
        ),
      },
      options: hasFallback ? { fallbackOutput: 'extra' } : {},
    },
  };
}

function uniqueName(base: string, taken: Set<string>) {
  let name = base;
  for (let suffix = 2; taken.has(name); suffix += 1) name = `${base}_${suffix}`;
  taken.add(name);
  return name;
}

function systemErrorHandlerNode(
  position: [number, number],
  takenIds: Set<string>,
  taken: Set<string>,
  say: Say
): N8nNode {
  return {
    id: uniqueName(SYSTEM_ERROR_HANDLER_ID, takenIds),
    name: uniqueName(say('系统异常处理', 'System Error Handler'), taken),
    type: 'n8n-nodes-base.noOp',
    typeVersion: 1,
    position,
    parameters: {},
  };
}

export function compileN8nWorkflow(input: SopAnalysis): N8nWorkflow {
  const analysis = validateSopAnalysisGraph(input);
  const zh = isChinese(analysis);
  const say: Say = (zhText, enText) => (zh ? zhText : enText);
  const requirements: string[] = [];
  const trigger = makeTrigger(analysis, say);
  // n8n requires unique node ids and unique node names (separately).
  const takenIds = new Set([
    trigger.id,
    ...analysis.steps.map((step) => step.id),
  ]);
  const taken = new Set([trigger.name]);
  const stepNodes = analysis.steps.map((step, index) =>
    nodeForStep(
      step,
      index,
      uniqueName(step.title.trim() || step.id, taken),
      requirements,
      say
    )
  );
  const routers = new Map<string, N8nNode>();
  analysis.steps.forEach((step, index) => {
    if (!needsRouter(step)) return;
    const [x] = stepNodes[index].position;
    routers.set(
      step.id,
      routerNode(
        step,
        uniqueName(`${step.id}_route`, takenIds),
        uniqueName(
          say(
            `${stepNodes[index].name} · 分支路由`,
            `${stepNodes[index].name} · Router`
          ),
          taken
        ),
        [x + 140, 500],
        requirements,
        zh
      )
    );
  });

  // n8n If/Switch nodes with "continue on error" push failed items into a
  // business output instead of the error output, so condition nodes never
  // get one. Their system errors come from the upstream API node, whose error
  // output reaches the handler.
  const handlesSystemErrors = analysis.steps.map((step, index) => {
    if (step.operation === 'condition') return false;
    return (
      ERROR_PRONE_NODE_TYPES.has(stepNodes[index].type) ||
      step.errorHandling.some(
        (item) => classifyErrorHandling(item) === 'system'
      )
    );
  });
  for (const step of analysis.steps) {
    const decisions = step.next.filter(
      (edge) =>
        step.operation === 'condition' &&
        edge.condition?.leftValue.replace(/\s/g, '') === '{{$json.decision}}'
    );
    if (decisions.length) {
      requirements.push(
        decisionRequirement(
          step,
          decisions.map((edge) => edge.label),
          zh
        )
      );
    }
    const business = step.errorHandling.filter(
      (item) => classifyErrorHandling(item) === 'business'
    );
    if (business.length) {
      const scenarios = business.map((item) => item.scenario);
      requirements.push(
        say(
          `${step.title}：业务异常${quoted(scenarios, true)}还没有对应的流程分支，建议在 SOP 中写明处理方式后重新生成。`,
          `${step.title}: business exception ${quoted(scenarios, false)} is not a workflow branch yet; add it to the SOP so it is routed explicitly.`
        )
      );
    }
  }
  const handler = handlesSystemErrors.some(Boolean)
    ? systemErrorHandlerNode(
        [420 + Math.max(stepNodes.length - 1, 0) * 140, 680],
        takenIds,
        taken,
        say
      )
    : undefined;
  if (handler) {
    requirements.push(
      say(
        `${handler.name}：为接口失败、超时等系统异常配置告警渠道，例如邮件或企业微信。`,
        `${handler.name}: send system errors (API failures, timeouts) to an alert channel such as email or IM.`
      )
    );
  }

  const nodes = [trigger, ...stepNodes, ...routers.values()];
  if (handler) nodes.push(handler);
  const connections: Record<string, { main: Array<Array<object>> }> = {
    [trigger.name]: {
      main: [[{ node: stepNodes[0].name, type: 'main', index: 0 }]],
    },
  };
  const link = (node: string) => ({ node, type: 'main', index: 0 });
  const nodeName = (stepId: string) =>
    stepNodes[analysis.steps.findIndex((step) => step.id === stepId)].name;

  analysis.steps.forEach((step, index) => {
    const node = stepNodes[index];
    const outputs: Array<Array<object>> = [];
    const router = routers.get(step.id);
    if (step.operation === 'condition') {
      step.next.forEach((edge, edgeIndex) => {
        const slot = conditionOutputIndex(step, edgeIndex);
        (outputs[slot] ||= []).push(link(nodeName(edge.targetStepId)));
      });
    } else if (router) {
      outputs[0] = [link(router.name)];
    } else {
      outputs[0] = step.next.map((edge) => link(nodeName(edge.targetStepId)));
    }

    if (handler && handlesSystemErrors[index]) {
      node.onError = 'continueErrorOutput';
      outputs[0] ||= [];
      outputs[1] = [link(handler.name)];
    }

    for (let slot = 0; slot < outputs.length; slot += 1) outputs[slot] ||= [];
    if (outputs.some((targets) => targets.length)) {
      connections[node.name] = { main: outputs };
    }

    if (router) {
      const routed = routedEdges(step).map((edge) => [
        link(nodeName(edge.targetStepId)),
      ]);
      const fallback = step.next
        .filter((edge) => edge.branch === 'default')
        .map((edge) => link(nodeName(edge.targetStepId)));
      connections[router.name] = {
        main: fallback.length ? [...routed, fallback] : routed,
      };
    }
  });

  return {
    name: analysis.title,
    nodes,
    connections,
    settings: {
      executionOrder: 'v1',
      ...(analysis.trigger.schedule?.timezone
        ? { timezone: analysis.trigger.schedule.timezone }
        : {}),
    },
    active: false,
    pinData: {},
    meta: { templateCredsSetupCompleted: false },
    configurationRequirements: requirements,
  };
}
