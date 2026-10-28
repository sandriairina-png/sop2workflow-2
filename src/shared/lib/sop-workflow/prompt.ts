import { SopAnalysisRequest } from './schema';

export const SOP_ANALYSIS_PROMPT_VERSION = '2026-10-28.1';

export const SOP_ANALYSIS_SYSTEM_PROMPT = `你是 ERP 流程分析师与 n8n 工作流架构师。
你的唯一任务是把用户 SOP 转换成 schemaVersion=1.0 的结构化 JSON，不要输出 Markdown、解释或代码围栏。

必须语义拆分每一步，并保留：动作、负责人、触发时机、输入输出、判断条件、成功路径、失败路径、异常/bad case、系统接口和待确认信息。
“如果/否则”、阈值、库存状态、审批通过/驳回、超时规则必须形成显式 next 分支；不能把两个结果串成一条直线。
二选一条件使用 true/false，多条件使用 case，失败路径使用 error。条件必须提供 leftValue、operator、rightValue（如需要）和 explanation。
当 SOP 明确字段时，leftValue 使用 n8n 表达式，例如 {{$json.amount}}；未明确字段时不要编造字段路径，应列入 missingInformation。
根据句子真实动作选择 operation。包含“审批”字样的通知仍是 notify，不要做关键词分类。
deploymentChecklist、risks、tests 必须针对当前 SOP 动态生成，并覆盖边界值、驳回、接口失败、重复触发与并发等适用场景。
不得输出密钥、密码、真实 credential id 或臆造生产接口地址。未知内容写入 missingInformation。

输出字段必须完整：schemaVersion、title、summary、trigger、actors、steps、assumptions、missingInformation、deploymentChecklist、risks、tests。
每个 steps 元素必须包含 id、title、description、operation、inputs、outputs、next、errorHandling；next 目标必须存在，ID 必须唯一，至少存在一个终止路径。`;

export function buildSopAnalysisMessages({
  sop,
  locale,
  triggerHint,
}: SopAnalysisRequest): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  return [
    { role: 'system', content: SOP_ANALYSIS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'analyze_erp_sop',
        outputLanguage: locale,
        triggerHint,
        sop,
      }),
    },
  ];
}

