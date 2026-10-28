import { validateSopAnalysisGraph } from './graph';
import { SopAnalysis, SopConnection, SopStep } from './schema';

export type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  disabled?: boolean;
  webhookId?: string;
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
    leftValue: condition.leftValue,
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

function makeTrigger(analysis: SopAnalysis): N8nNode {
  if (analysis.trigger.type === 'schedule') {
    const schedule = analysis.trigger.schedule || { hour: 9, minute: 0 };
    return {
      id: 'trigger',
      name: 'Schedule Trigger',
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
      name: 'Webhook Trigger',
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
    name: 'Manual Trigger',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [120, 320],
    parameters: {},
  };
}

function nodeForStep(
  step: SopStep,
  index: number,
  requirements: string[]
): N8nNode {
  const base = {
    id: step.id,
    name: step.id,
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
        `${step.title}: configure ${step.integration?.system || 'system'} endpoint and credentials.`
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
      requirements.push(`${step.title}: configure email credentials and recipient.`);
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
    requirements.push(`${step.title}: choose and configure a notification channel.`);
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
    requirements.push(`${step.title}: configure the approval channel and assignee.`);
  }
  return {
    ...base,
    type: 'n8n-nodes-base.noOp',
    typeVersion: 1,
    disabled: step.operation === 'approve',
    parameters: step.operation === 'approve' ? { notice: step.description } : {},
  };
}

function outputIndex(step: SopStep, edge: SopConnection, index: number) {
  if (step.operation !== 'condition') return 0;
  if (step.next.length > 2) return index;
  if (edge.branch === 'false') return 1;
  return 0;
}

export function compileN8nWorkflow(input: SopAnalysis): N8nWorkflow {
  const analysis = validateSopAnalysisGraph(input);
  const requirements: string[] = [];
  const trigger = makeTrigger(analysis);
  const stepNodes = analysis.steps.map((step, index) =>
    nodeForStep(step, index, requirements)
  );
  const nodes = [trigger, ...stepNodes];
  const connections: Record<string, { main: Array<Array<object>> }> = {
    [trigger.name]: {
      main: [[{ node: stepNodes[0].name, type: 'main', index: 0 }]],
    },
  };

  for (const step of analysis.steps) {
    if (!step.next.length) continue;
    const outputs: Array<Array<object>> = [];
    step.next.forEach((edge, index) => {
      const slot = outputIndex(step, edge, index);
      outputs[slot] ||= [];
      outputs[slot].push({
        node: edge.targetStepId,
        type: 'main',
        index: 0,
      });
    });
    for (let index = 0; index < outputs.length; index += 1) {
      outputs[index] ||= [];
    }
    connections[step.id] = { main: outputs };
  }

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

