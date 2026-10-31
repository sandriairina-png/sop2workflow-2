import { SopAnalysisRequest, SopSkeleton } from './schema';

export const SOP_ANALYSIS_PROMPT_VERSION = '2026-10-31.3';

export const SOP_SKELETON_SYSTEM_PROMPT = `你是 ERP 流程分析师。先把 SOP 拆成紧凑的主干流程 JSON，不要输出 Markdown 或解释。
这一阶段只确定触发方式、参与角色、主要节点、判断分支与回退路径，不要生成部署清单、风险或测试。
“如果/否则”、金额阈值、审批通过/驳回和重新提交必须形成显式 next 连接，不得串成一条直线。
节点总数不超过 14 个：连续的系统动作、同时执行的并行动作合并为一个节点；重试、催办、升级等循环用一个判断节点加回退连接表达，不要逐次展开。原文中的超时升级和提醒规则不得遗漏。
仅输出 schemaVersion、title、summary、trigger、actors、steps。每个 step 仅输出 id、title、description、source、operation、next；description 不超过 20 个字。
source：原文明确写出的动作为 source_text；为让流程闭环而补全的节点为 ai_inferred；原文只有“按规定”“大额”“严重”等笼统说法、需用户决定的节点为 needs_confirmation。
连接字段为 targetStepId、label、branch，判断路径应包含 condition（leftValue、operator、rightValue、explanation）。
允许值与完整分析相同；节点 ID 必须唯一，所有 targetStepId 必须指向主干中的节点。
输出必须是一个以 { 开始、以 } 结束的 JSON 对象。最小结构示例：
{"schemaVersion":"1.0","title":"流程标题","summary":"流程摘要","trigger":{"type":"manual","description":"触发说明"},"actors":[],"steps":[{"id":"done","title":"完成","description":"流程结束","source":"ai_inferred","operation":"end","next":[]}]}。`;

export const SOP_SKELETON_COMPACT_RETRY_PROMPT =
  '上一个主干结果无法使用（可能因输出过长被截断）。请用更精简的方式重新输出：节点总数不超过 10 个，合并次要动作，description 不超过 12 个字；只返回完整 JSON 对象，必须包含 schemaVersion、title、summary、trigger、actors、steps；不要解释、不要 Markdown、不要代码围栏。';

export const SOP_ANALYSIS_SYSTEM_PROMPT = `你是 ERP 流程分析师与 n8n 工作流架构师。
你的唯一任务是把用户 SOP 转换成 schemaVersion=1.0 的结构化 JSON，不要输出 Markdown、解释或代码围栏。

必须语义拆分每一步，并保留：动作、负责人、触发时机、输入输出、判断条件、成功路径、失败路径、异常/bad case、系统接口和待确认信息。
“如果/否则”、阈值、库存状态、审批通过/驳回、超时规则必须形成显式 next 分支；不能把两个结果串成一条直线。
二选一条件使用 true/false，多条件使用 case，失败路径使用 error。条件必须提供 leftValue、operator、rightValue（如需要）和 explanation。
当 SOP 明确字段时，leftValue 使用 n8n 表达式，例如 {{$json.amount}}；未明确字段时不要编造字段路径，应列入 missingInformation。
根据句子真实动作选择 operation。包含“审批”字样的通知仍是 notify，不要做关键词分类。
每个节点必须如实输出 source：只有原文明确写出的动作、条件和负责人才能标 source_text；为保证流程可运行而补全的节点为 ai_inferred；原文只有“按规定”“大额”“严重”等笼统说法、由你补出具体审批人、阈值或路径的节点，必须标 needs_confirmation，不得标 source_text。
原文中的模糊概念（如“大额”“严重”“尽快”）必须转成 confirmationQuestions。同一判断节点的不同分支必须指向不同节点，否则合并为一条路径。原文中的超时升级和提醒规则不得遗漏。
deploymentChecklist、risks、tests 必须针对当前 SOP 动态生成，并覆盖边界值、驳回、接口失败、重复触发与并发等适用场景。
输出必须紧凑：不得重复主干节点；每个 inputs、outputs、errorHandling 最多 2 项；confirmationQuestions、deploymentChecklist、risks、tests 各最多 3 项；每段说明用一句短句。优先保证完整合法 JSON，禁止因扩写说明导致输出截断。
不得输出密钥、密码、真实 credential id 或臆造生产接口地址。未知内容写入 missingInformation，并在 confirmationQuestions 中转成可回答问题。
每个 confirmationQuestions 元素必须有稳定 id、明确 question、2 到 3 个互斥选项 options（value 和 label）以及 allowCustom=true。不要询问密钥或密码。
用户已提供的 clarifications 是确定的补充条件，必须用于修正节点、分支和部署清单，不得再把同一问题列为待确认。

输出字段必须完整：schemaVersion、title、summary、trigger、actors、steps、assumptions、missingInformation、confirmationQuestions、deploymentChecklist、risks、tests。
每个 steps 元素必须包含 id、title、description、source、operation、inputs、outputs、next、errorHandling；next 目标必须存在，ID 必须唯一，至少存在一个终止路径。

严格按照下面的 JSON 结构输出；示例值必须替换成当前 SOP 的真实分析结果，空集合也必须输出：
{
  "schemaVersion": "1.0",
  "title": "流程标题",
  "summary": "流程摘要",
  "trigger": {
    "type": "manual",
    "description": "触发方式说明"
  },
  "actors": [
    {
      "id": "actor_1",
      "name": "负责人或系统",
      "responsibility": "职责"
    }
  ],
  "steps": [
    {
      "id": "step_1",
      "title": "判断条件",
      "description": "步骤说明",
      "source": "source_text",
      "ownerActorId": "actor_1",
      "operation": "condition",
      "inputs": ["输入"],
      "outputs": ["输出"],
      "next": [
        {
          "targetStepId": "step_2",
          "label": "条件成立",
          "branch": "true",
          "condition": {
            "leftValue": "{{$json.amount}}",
            "operator": "greaterThanOrEqual",
            "rightValue": 5000,
            "explanation": "金额大于等于 5000"
          }
        },
        {
          "targetStepId": "step_3",
          "label": "条件不成立",
          "branch": "false",
          "condition": {
            "leftValue": "{{$json.amount}}",
            "operator": "lessThan",
            "rightValue": 5000,
            "explanation": "金额小于 5000"
          }
        }
      ],
      "errorHandling": [
        {
          "scenario": "接口失败",
          "action": "记录错误并通知负责人",
          "targetStepId": "step_3"
        }
      ]
    }
  ],
  "assumptions": [],
  "missingInformation": [],
  "confirmationQuestions": [
    {
      "id": "approval_threshold",
      "question": "哪个金额阈值需要财务总监审批？",
      "options": [
        { "value": "5000", "label": "5000 元及以上" },
        { "value": "10000", "label": "10000 元及以上" }
      ],
      "allowCustom": true
    }
  ],
  "deploymentChecklist": ["配置所需凭证"],
  "risks": [
    {
      "level": "medium",
      "title": "风险标题",
      "description": "风险说明",
      "mitigation": "缓解措施"
    }
  ],
  "tests": [
    {
      "name": "测试名称",
      "input": "测试输入",
      "expected": "预期结果"
    }
  ]
}

允许值：
- trigger.type: manual | schedule | webhook。schedule 时增加 schedule: {"hour": 9, "minute": 0, "timezone": "Asia/Shanghai"}。
- operation: read | transform | write | approve | notify | wait | condition | merge | end。
- source: source_text | ai_inferred | needs_confirmation。
- branch: default | true | false | case | error。
- condition.operator: equals | notEquals | greaterThan | greaterThanOrEqual | lessThan | lessThanOrEqual | contains | isEmpty | isNotEmpty。
- risk.level: low | medium | high。
- integration 如存在必须完整包含 system、action、credentialRequired、endpointKnown；未知接口不要编造。
- ownerActorId、integration、condition、rightValue、targetStepId 仅在适用时输出，其余字段不得缺失。`;

export function buildSopSkeletonMessages({
  sop,
  locale,
  triggerHint,
  clarifications,
}: SopAnalysisRequest): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  return [
    { role: 'system', content: SOP_SKELETON_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'outline_erp_sop',
        outputLanguage: locale,
        triggerHint,
        sop,
        clarifications: clarifications || [],
      }),
    },
  ];
}

export function buildSopDetailMessages(
  { sop, locale, triggerHint, clarifications }: SopAnalysisRequest,
  skeleton: SopSkeleton
): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  return [
    { role: 'system', content: SOP_ANALYSIS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'enrich_erp_sop_skeleton',
        outputLanguage: locale,
        triggerHint,
        sop,
        skeleton,
        clarifications: clarifications || [],
        instruction:
          '保留主干中的节点和分支语义，补齐负责人、输入输出、异常处理、部署清单、风险、测试与待确认信息。',
      }),
    },
  ];
}
