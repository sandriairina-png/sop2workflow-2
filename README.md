# SOP2Workflow

SOP2Workflow 是面向 ERP 场景的 SOP 自动化工作台：输入业务流程，生成可审阅、可下载并导入 n8n 的工作流草稿。正式产品基于 Next.js，入口位于 `src/app`；`vite-src` 保留为早期独立 React 原型。

```bash
pnpm dev                 # SOP2Workflow / Next.js 主应用，默认端口 3000
pnpm dev:prototype       # SOP2Workflow 原型，默认端口 5173
pnpm build:prototype     # 检查并构建原型
```

当前版本通过服务端 EvoLink `gemini-3.8-flash` 把 SOP 转为受 Schema 约束的流程 JSON，展示真实条件分支、异常路径、部署清单、风险和测试建议。用户可以编辑并重新校验结构 JSON；只有人工确认后才能导出由本地确定性编译器生成的 n8n JSON。ERP 接口地址和凭据仍需在 n8n 中配置，密钥不会进入生成文件。

## EvoLink 与额度保护

在本地 `.env.development` 或 Vercel 项目的 Environment Variables 中配置：

```bash
# 只允许服务端读取，不要使用 NEXT_PUBLIC_ 前缀
EVOLINK_API_KEY="你的新 Key"
EVOLINK_API_URL="https://direct.evolink.ai/v1/chat/completions"
EVOLINK_MODEL="gemini-3.8-flash"

# 建议使用与 AUTH_SECRET 不同的随机值
SOP_WORKFLOW_RATE_SALT="随机长字符串"
SOP_WORKFLOW_MIN_INTERVAL_MS="10000"
SOP_WORKFLOW_CLIENT_DAILY_LIMIT="20"
SOP_WORKFLOW_GLOBAL_DAILY_LIMIT="200"
```

线上请在 Vercel 的 Production、Preview 环境分别设置，并重新部署。不要把真实 Key 写入 Git、截图或聊天。API 采用匿名 Cookie + IP 哈希、调用间隔、单客户端日限额、全局日限额和并发上限保护额度；数据库只保存计数及哈希，不保存 SOP。

默认测试不会调用付费模型。只有明确需要 live 回归时才运行：

```bash
EVOLINK_API_KEY="..." pnpm eval:sop:live
```

离线 bad-case 基线与迭代记录位于 `docs/evaluation/sop-model-iteration-log.md`。

## ShipAny 模板资料

## Getting Started

read [ShipAny Document](https://shipany.ai/docs/quick-start) to start your AI SaaS project.

## Buy Templates

check [ShipAny Templates](https://shipany.ai/templates) to buy Business Templates.

## Feedback

submit your feedbacks on [Github Issues](https://github.com/shipanyai/shipany-template-two/issues)

## LICENSE

!!! Please do not publicly release ShipAny's Code. Illegal use will be prosecuted

[ShipAny LICENSE](./LICENSE)
