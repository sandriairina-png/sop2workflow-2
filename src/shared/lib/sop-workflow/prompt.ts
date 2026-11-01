import { SopAnalysisRequest, SopSkeleton } from './schema';

export const SOP_ANALYSIS_PROMPT_VERSION = '2026-11-02.2';

export const SOP_SKELETON_SYSTEM_PROMPT = `你是 ERP 流程分析师。先把 SOP 拆成紧凑的主干流程 JSON，不要输出 Markdown 或解释。
这一阶段只确定触发方式、参与角色、主要节点、判断分支与回退路径，不要生成部署清单、风险或测试。
“如果/否则”、金额阈值、审批通过/驳回和重新提交必须形成显式 next 连接，不得串成一条直线。
驳回、缺货等业务异常必须画成 next 分支；接口失败、接口超时等系统异常不要画成节点，导出时统一由“系统异常处理”节点承接。
节点总数不超过 14 个：连续的系统动作、同时执行的并行动作合并为一个节点；重试、催办、升级等循环用一个判断节点加回退连接表达，不要逐次展开。原文中的超时升级和提醒规则不得遗漏。
仅输出 schemaVersion、title、summary、trigger、actors、steps。每个 step 仅输出 id、title、description、source、operation、next；description 不超过 20 个字。
source：原文明确写出的动作为 source_text；为让流程闭环而补全的节点为 ai_inferred；原文只有“按规定”“大额”“严重”等笼统说法、需用户决定的节点为 needs_confirmation。
连接字段为 targetStepId、label、branch，判断路径应包含 condition（leftValue、operator、rightValue、explanation）。
允许值与完整分析相同；节点 ID 必须唯一，所有 targetStepId 必须指向主干中的节点。
用户提供的 clarifications 是确定的补充条件，必须据此调整节点和分支。
输出必须是一个以 { 开始、以 } 结束的 JSON 对象。最小结构示例：
{"schemaVersion":"1.0","title":"流程标题","summary":"流程摘要","trigger":{"type":"manual","description":"触发说明"},"actors":[{"id":"actor_1","name":"负责人或系统","responsibility":"职责"}],"steps":[{"id":"done","title":"完成","description":"流程结束","source":"ai_inferred","operation":"end","next":[]}]}。`;

export const SOP_SKELETON_COMPACT_RETRY_PROMPT =
  '上一个主干结果无法使用（可能因输出过长被截断）。请用更精简的方式重新输出：节点总数不超过 10 个，合并次要动作，description 不超过 12 个字；只返回完整 JSON 对象，必须包含 schemaVersion、title、summary、trigger、actors、steps；不要解释、不要 Markdown、不要代码围栏。';

// Stage 2 runs two small requests in parallel instead of rewriting the whole
// workflow: the skeleton already fixes titles, operations and branches.
export const SOP_STEP_DETAIL_SYSTEM_PROMPT = `你是 ERP 流程分析师与 n8n 工作流架构师。主干流程已经确定，你只为每个节点补充细节，不要输出 Markdown、解释或代码围栏。
不要重复节点的 title、description、operation、next，也不要增删节点；只输出下面结构，steps 按主干节点 id 一一对应：
{"steps":[{"id":"主干节点 id","source":"source_text","ownerActorId":"actor_1","inputs":["输入"],"outputs":["输出"],"errorHandling":[{"kind":"system","scenario":"接口失败或超时","action":"记录错误并通知运维"}]}]}
source 必须如实：只有原文明确写出的动作、条件和负责人才能标 source_text；为保证流程可运行而补全的节点为 ai_inferred；原文只有“按规定”“大额”“严重”等笼统说法、由你补出具体审批人、阈值或路径的节点，必须标 needs_confirmation。
ownerActorId 只能使用主干 actors 中的 id，不确定就省略。
errorHandling 只写系统异常（接口失败、接口超时、鉴权失效、限流、数据解析失败），kind 固定为 "system"，不要写 targetStepId；导出时它们统一连到单独的“系统异常处理”节点。缺货、审批驳回、金额不符、人工超时未处理等业务异常已经是主干里的 next 分支，不得写入 errorHandling。纯人工或纯判断节点通常没有系统异常，输出空数组。
如节点调用外部系统，可输出 integration：{"system":"系统名","action":"动作","credentialRequired":true,"endpointKnown":false}；未知接口不要编造地址。
输出必须紧凑：inputs、outputs、errorHandling 每项最多 2 条，每条不超过 15 个字。不得输出密钥或密码。`;

export const SOP_PLAN_SYSTEM_PROMPT = `你是 ERP 流程实施顾问。主干流程已经确定，你只输出上线前需要确认和准备的内容，不要输出 Markdown、解释或代码围栏。
只输出下面结构：
{"assumptions":["假设"],"missingInformation":["待补充信息"],"confirmationQuestions":[{"id":"approval_threshold","question":"哪个金额阈值需要财务总监审批？","options":[{"value":"5000","label":"5000 元及以上"},{"value":"10000","label":"10000 元及以上"}],"allowCustom":true}],"deploymentChecklist":["配置所需凭证"],"risks":[{"level":"medium","title":"风险标题","description":"风险说明","mitigation":"缓解措施"}],"tests":[{"name":"测试名称","input":"测试输入","expected":"预期结果"}]}
原文中的模糊概念（如“大额”“严重”“尽快”）、缺失的阈值、负责人、通知渠道和接口，必须写入 missingInformation，并且每一项都要在 confirmationQuestions 中有对应的可回答问题。
每个 confirmationQuestions 元素必须有稳定的英文 id、明确的 question、2 到 3 个互斥选项 options（value 和 label）以及 allowCustom=true。不要询问密钥或密码。
用户已提供的 clarifications 是确定的补充条件，不得再把同一问题列为待确认，并据此调整 deploymentChecklist、risks、tests。
deploymentChecklist、risks、tests 必须针对当前 SOP 生成，覆盖边界值、驳回、接口失败、重复触发等适用场景。
risk.level 只能是 low、medium、high。每个数组最多 3 项，每项一句短句。`;

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

function detailMessages(
  system: string,
  task: string,
  { sop, locale, triggerHint, clarifications }: SopAnalysisRequest,
  skeleton: SopSkeleton
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: JSON.stringify({
        task,
        outputLanguage: locale,
        triggerHint,
        sop,
        skeleton,
        clarifications: clarifications || [],
      }),
    },
  ];
}

export function buildSopStepDetailMessages(
  input: SopAnalysisRequest,
  skeleton: SopSkeleton
) {
  return detailMessages(
    SOP_STEP_DETAIL_SYSTEM_PROMPT,
    'detail_erp_sop_steps',
    input,
    skeleton
  );
}

export function buildSopPlanMessages(
  input: SopAnalysisRequest,
  skeleton: SopSkeleton
) {
  return detailMessages(
    SOP_PLAN_SYSTEM_PROMPT,
    'plan_erp_sop_rollout',
    input,
    skeleton
  );
}
