const cards = [
  { label: "总资产", value: "等待首次采集" },
  { label: "股票仓位", value: "—" },
  { label: "源同步时间", value: "尚未连接" },
];

export default function Home() {
  return (
    <main>
      <header>
        <p className="eyebrow">PRIVATE PORTFOLIO</p>
        <h1>持仓仪表盘 Agent</h1>
        <p className="subtitle">先确认数据是否足够新，再理解组合发生了什么。</p>
      </header>

      <section className="grid" aria-label="组合概览">
        {cards.map((card) => (
          <article className="card" key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="empty-state">
        <span>技术验证阶段</span>
        <h2>等待第一次只读采集</h2>
        <p>登录凭证只保留在本机；云端仅接收标准化后的必要持仓字段。</p>
      </section>
    </main>
  );
}

