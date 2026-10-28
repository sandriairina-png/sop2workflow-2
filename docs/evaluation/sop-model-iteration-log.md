# SOP 模型迭代记录

本记录只使用脱敏或合成 SOP。线上请求不保存原始 SOP；问题复现时应由测试人员把最小化、脱敏后的样例加入 `evaluation-cases.json` 和 fixtures。

## 基线：2026-10-28

- 模型：`gemini-3.8-flash`
- Prompt：`2026-10-28.1`
- 目标：先生成结构化 `SopAnalysis`，经 Schema、图连通性和密钥模式校验后，再由确定性编译器生成 n8n JSON。
- 人工门禁：编辑会立即清除确认状态；重新校验成功并勾选人工确认后才允许导出。

| Bad case       | 基线风险                     | 当前约束 / 调整                                              | 回归样例                             |
| -------------- | ---------------------------- | ------------------------------------------------------------ | ------------------------------------ |
| 隐含条件漏抽   | “库存足则…否则…”被串成直线   | condition 至少两个分支，边必须包含条件和标签                 | `implicit-condition-omission`        |
| 并行步骤误串行 | 两个结果被同时执行或错误串联 | 保留每条显式连接；预览展示真实目标                           | `parallel-work-serialized`           |
| 角色混淆       | 主管、财务、仓库责任错配     | 独立 actors 与 ownerActorId，引用必须存在                    | `actor-confusion`                    |
| 审批关键词误判 | “驳回后通知”误生成为审批节点 | operation 使用语义枚举，通知映射通知节点                     | `approval-keyword-misclassification` |
| 缺失驳回路径   | 只保留通过分支               | condition 分支数与拒绝通知回归                               | `missing-rejection-path`             |
| 固定部署文案   | 不随 SOP 变化                | checklist、missingInformation、risks、tests 全部来自分析结果 | `fixed-deployment-copy`              |
| 空 Code 节点   | 只能看形状、无法运行         | 确定性映射为 If/Switch/HTTP/Set/Wait/Merge/通知占位          | `empty-code-node-export`             |

## 后续每轮记录格式

记录日期、模型、Prompt 版本、脱敏 case ID、旧输出与期望差异、修复策略、离线回归结果、人工验收结果。付费 live eval 必须显式运行，不能加入默认测试或 CI。
