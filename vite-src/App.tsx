import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, Check, CheckCheck, ChevronDown, CircleHelp, Clipboard, Code2, Download, FileText, GitBranch, LoaderCircle, Play, RefreshCw, ShieldCheck, Sparkles, Workflow, X } from 'lucide-react';
import { EXAMPLES, generateWorkflow, type Result, type TriggerMode } from './workflow';

const kinds = {
  trigger: '触发', verify: '校验', approve: '审批', sync: '数据同步', notify: '通知', action: '业务处理'
};
const icons = { trigger: Play, verify: ShieldCheck, approve: CheckCheck, sync: RefreshCw, notify: Sparkles, action: GitBranch };

function RevealText({ text, className = '' }: { text: string; className?: string }) {
  return <span className={`reveal-text ${className}`} aria-label={text}>{Array.from(text).map((char, index) => <span key={index} style={{ animationDelay: `${index * 35}ms` }}>{char === ' ' ? '\u00a0' : char}</span>)}</span>;
}

function App() {
  const [sop, setSop] = useState('');
  const [mode, setMode] = useState<TriggerMode>('manual');
  const [result, setResult] = useState<Result | null>(null);
  const [activeTab, setActiveTab] = useState<'flow' | 'json' | 'setup'>('flow');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const count = useMemo(() => sop.length, [sop]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const generate = () => {
    if (!sop.trim()) { setError('请先输入你的 SOP，或选择一个示例。'); return; }
    setError('');
    setBusy(true);
    window.setTimeout(() => {
      try { setResult(generateWorkflow(sop.trim(), mode)); setActiveTab('flow'); }
      catch (err) { setError(err instanceof Error ? err.message : '生成失败，请检查 SOP 内容。'); }
      setBusy(false);
    }, 450);
  };
  const json = result ? JSON.stringify(result.workflow, null, 2) : '';
  const download = () => {
    if (!result) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'erp-sop-n8n-workflow.json'; link.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(json); setCopied(true); }
    catch { setError('复制失败，请切换到 JSON 标签后手动复制。'); }
  };

  return <div className="site-shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar wrap">
      <a className="brand" href="#top" aria-label="序流首页"><span className="brand-mark"><Workflow size={19} strokeWidth={2.2} /></span><span>序流<span className="brand-en"> / FLOWCRAFT</span></span></a>
      <nav className={menuOpen ? 'nav nav-open' : 'nav'} aria-label="主导航">
        <a href="#workspace" onClick={() => setMenuOpen(false)}>工作台</a><a href="#how" onClick={() => setMenuOpen(false)}>工作方式</a><a href="#about" onClick={() => setMenuOpen(false)}>关于产品</a>
      </nav>
      <a className="nav-cta" href="#workspace">打开工作台 <ArrowRight size={15} /></a>
      <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? '关闭菜单' : '打开菜单'}>{menuOpen ? <X size={21} /> : <ChevronDown size={21} />}</button>
    </header>

    <main id="top">
      <section className="hero wrap">
        <div className="eyebrow"><span className="signal-dot" /> ERP OPERATIONS, REIMAGINED <span className="eyebrow-line" /> 001 / SOP → WORKFLOW</div>
        <div className="hero-grid">
          <div className="hero-main"><h1><RevealText text="让流程，从文字" /><br /><span className="hero-gradient"><RevealText text="走向执行。" /></span></h1>
            <p className="hero-description">写下你的 ERP 业务 SOP。序流会拆解关键步骤，生成可审阅、可导入 n8n 的工作流草稿，让繁琐流程有迹可循。</p>
            <div className="hero-actions"><a className="primary-button" href="#workspace">开始构建工作流 <ArrowRight size={18} /></a><a className="text-link" href="#how">了解工作方式 <ArrowDown size={16} /></a></div>
          </div>
          <div className="hero-art" aria-hidden="true"><div className="orbit orbit-outer" /><div className="orbit orbit-inner" /><div className="art-line art-line-one" /><div className="art-line art-line-two" /><div className="art-node node-a"><FileText size={20} /></div><div className="art-node node-b"><GitBranch size={21} /></div><div className="art-node node-c"><Workflow size={22} /></div><div className="art-caption">INPUT: STANDARD OPERATING PROCEDURE<br />OUTPUT: STRUCTURED AUTOMATION</div></div>
        </div>
        <div className="hero-footer"><span>01 / 描述流程</span><span>02 / 审阅结构</span><span>03 / 导入 n8n</span><span className="hero-footer-note">FROM INTENT TO EXECUTION ↓</span></div>
      </section>

      <section className="workspace-section" id="workspace"><div className="wrap">
        <div className="section-heading"><div><div className="section-kicker">THE WORKSPACE / 01</div><h2>把你的 SOP 放在这里。</h2><p>从业务语言开始，逐步形成可交付的自动化流程。</p></div><span className="section-index">01 — 03</span></div>
        <div className="workspace-grid">
          <div className="panel input-panel">
            <div className="panel-heading"><div className="panel-title"><span className="panel-icon"><FileText size={17} /></span><div><strong>输入业务 SOP</strong><small>STANDARD OPERATING PROCEDURE</small></div></div><span className="panel-badge">SOURCE</span></div>
            <label className="field-label" htmlFor="sop">描述流程的触发条件、业务步骤和期望结果</label>
            <div className="textarea-shell"><textarea id="sop" value={sop} onChange={event => { setSop(event.target.value.slice(0, 4000)); setError(''); }} placeholder={'例如：每天 9 点从 ERP 获取待发货订单，检查库存。\n库存充足则通知仓库拣货；库存不足则通知采购。\n处理失败时记录异常并提醒负责人。'} maxLength={4000} /><div className="textarea-bottom"><span><span className="typing-cursor" /> 支持自然语言或分步骤粘贴</span><span>{count} / 4000</span></div></div>
            <div className="field-row"><span className="field-label">快速开始 <span className="label-muted">/ 选择业务场景</span></span></div>
            <div className="example-list">{EXAMPLES.map((example, index) => <button key={index} className="example-chip" onClick={() => { setSop(example); setError(''); }}><span>{['订单履约', '客户主数据', '采购审批'][index]}</span><ArrowRight size={14} /></button>)}</div>
            <div className="divider" />
            <div className="options-head"><span className="field-label">流程触发方式</span><span className="option-hint">可在 n8n 中继续调整</span></div>
            <div className="trigger-options">{([['manual', '手动触发'], ['schedule', '定时执行'], ['webhook', '事件触发']] as const).map(([value, label]) => <button key={value} className={mode === value ? 'trigger active' : 'trigger'} onClick={() => setMode(value)}><span className="radio-dot" />{label}</button>)}</div>
            {error && <div className="error-message" role="alert">{error}</div>}
            <button className="generate-button" onClick={generate} disabled={busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />} {busy ? '正在梳理流程…' : '生成工作流草稿'} <ArrowRight size={18} /></button>
            <p className="input-note"><ShieldCheck size={14} /> 基础版在浏览器本地解析，SOP 不会上传。</p>
          </div>

          <div className="panel output-panel">
            <div className="panel-heading output-heading"><div className="panel-title"><span className="panel-icon output-icon"><Workflow size={17} /></span><div><strong>生成结果</strong><small>WORKFLOW BLUEPRINT</small></div></div><span className={result ? 'status generated' : 'status'}><span /> {result ? '已生成草稿' : '等待输入'}</span></div>
            <div className="tabs" role="tablist" aria-label="结果视图"><button role="tab" aria-selected={activeTab === 'flow'} className={activeTab === 'flow' ? 'tab active' : 'tab'} onClick={() => setActiveTab('flow')}><GitBranch size={15} />流程预览</button><button role="tab" aria-selected={activeTab === 'json'} className={activeTab === 'json' ? 'tab active' : 'tab'} onClick={() => setActiveTab('json')}><Code2 size={15} />JSON</button><button role="tab" aria-selected={activeTab === 'setup'} className={activeTab === 'setup' ? 'tab active' : 'tab'} onClick={() => setActiveTab('setup')}><Clipboard size={15} />部署清单</button></div>
            {!result ? <div className="empty-state"><div className="empty-graphic"><div className="empty-node"><FileText size={20} /></div><span className="empty-connector" /><div className="empty-node empty-node-end"><Workflow size={21} /></div></div><span className="empty-tag">AWAITING INPUT</span><h3>你的流程蓝图，<br />即将在这里展开。</h3><p>输入 SOP 并点击生成，查看节点结构、n8n JSON 与配置清单。</p></div> :
              <div className="result-content">
                {activeTab === 'flow' && <><div className="result-intro"><div><span className="result-kicker">WORKFLOW / DRAFT</span><h3>{result.title}</h3><p>{result.summary}</p></div><span className="count-pill">{result.steps.length} NODES</span></div><div className="flow-list">{result.steps.map((step, index) => { const Icon = icons[step.kind]; return <div className="flow-item" key={step.id}><div className="flow-rail"><span className="flow-icon"><Icon size={16} /></span>{index !== result.steps.length - 1 && <span className="flow-line" />}</div><div className="flow-body"><div className="flow-meta"><span>STEP {String(index).padStart(2, '0')}</span><span>{kinds[step.kind]}</span></div><strong>{step.title}</strong><p>{step.detail}</p></div></div>; })}</div></>}
                {activeTab === 'json' && <><div className="json-top"><div><span className="result-kicker">EXPORT / N8N</span><h3>可导入的工作流 JSON</h3></div><span className="json-dot">JSON</span></div><div className="json-warning"><CircleHelp size={16} /> 节点记录 SOP 任务，真实 ERP 操作需按部署清单连接。</div><pre className="code-view"><code>{json}</code></pre></>}
                {activeTab === 'setup' && <div className="setup-content"><div className="setup-header"><span className="result-kicker">IMPLEMENTATION / GUIDE</span><h3>导入之后，还需完成这些配置。</h3></div><div className="setup-group"><h4>部署清单</h4>{result.checklist.map((item, index) => <div className="setup-item" key={index}><span>{String(index + 1).padStart(2, '0')}</span>{item}</div>)}</div><div className="setup-group"><h4>当前假设</h4>{result.assumptions.map((item, index) => <div className="setup-item" key={index}><span>—</span>{item}</div>)}</div><div className="setup-group"><h4>建议测试</h4>{result.tests.map((item, index) => <div className="setup-item" key={index}><span><Check size={14} /></span>{item}</div>)}</div></div>}
              </div>}
            <div className="output-footer"><span><span className="footer-square" /> {result ? '草稿已就绪 · 导入前请检查配置' : '等待生成工作流'}</span><div><button onClick={copy} disabled={!result} title="复制 JSON"><Clipboard size={16} />{copied ? '已复制' : '复制'}</button><button onClick={download} disabled={!result} className="download-button"><Download size={16} />导出 JSON</button></div></div>
          </div>
        </div>
      </div></section>
      <section className="how-section wrap" id="how"><div className="how-head"><span className="section-kicker">THE METHOD / 02</span><h2>从流程经验，到流程资产。</h2><p>让每一次业务梳理，都能沉淀为下一次自动化的起点。</p></div><div className="method-grid"><div><span>01 / CAPTURE</span><FileText size={24} /><h3>写下真实 SOP</h3><p>用熟悉的业务语言描述操作、判断和交接，无需先理解 n8n 节点。</p></div><div><span>02 / STRUCTURE</span><GitBranch size={24} /><h3>审阅流程结构</h3><p>检查拆解后的步骤、顺序与假设，先让业务逻辑清晰可见。</p></div><div><span>03 / ACTIVATE</span><Workflow size={24} /><h3>导入并完成接线</h3><p>下载 n8n JSON，在你的环境中配置 ERP 接口、凭据和异常路径。</p></div></div></section>
    </main>
    <footer id="about"><div className="wrap footer-inner"><div><div className="brand footer-brand"><span className="brand-mark"><Workflow size={18} /></span><span>序流<span className="brand-en"> / FLOWCRAFT</span></span></div><p>让复杂业务，拥有清晰的运行方式。</p></div><span>BUILT FOR THE SPACE BETWEEN SOP AND SYSTEM.</span><a href="#top">返回顶部 ↑</a></div></footer>
  </div>;
}

export default App;
