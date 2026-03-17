import React from 'react';

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(18, 45, 77, 0.12)',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 24px 80px rgba(24, 51, 89, 0.12)',
};

export default function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        background:
          'radial-gradient(circle at top left, rgba(244, 194, 102, 0.28), transparent 35%), linear-gradient(135deg, #f5efe2 0%, #dce7ef 48%, #f7f8fb 100%)',
        color: '#183359',
        fontFamily: '"IBM Plex Sans", "Noto Sans SC", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          padding: '64px 24px 80px',
          display: 'grid',
          gap: 20,
        }}
      >
        <section style={{ display: 'grid', gap: 14 }}>
          <div
            style={{
              display: 'inline-block',
              width: 'fit-content',
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(24, 51, 89, 0.08)',
              letterSpacing: '0.08em',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            REFACTOR IN PROGRESS
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(2.4rem, 5vw, 4.2rem)',
              lineHeight: 1.02,
              maxWidth: 780,
            }}
          >
            新架构已经和 legacy 实现脱钩，接下来以 `Vanilla.json` 兼容格式为核心推进。
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 760,
              fontSize: 18,
              lineHeight: 1.65,
              color: 'rgba(24, 51, 89, 0.82)',
            }}
          >
            当前页面只作为重构中的占位入口。新求解器会围绕 `Vanilla.json` 的 `items / recipes`
            数据结构建立规范，再由配套规则文件提供建筑、配方 modifier 和增产剂等级语义。
          </p>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18,
          }}
        >
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Canonical Input</h2>
            <p style={{ marginBottom: 0, lineHeight: 1.65 }}>
              以 `Vanilla.json` 兼容格式作为 catalog 文件标准，避免项目内部发明第二套原始数据格式。
            </p>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Rule Files</h2>
            <p style={{ marginBottom: 0, lineHeight: 1.65 }}>
              `Vanilla` 只是一份数据文件；缺失的建筑、modifier 和增产剂语义统一由配套规则文件提供。
            </p>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Legacy Status</h2>
            <p style={{ marginBottom: 0, lineHeight: 1.65 }}>
              `src/legacy` 仅保留为参考材料，不再作为当前架构的默认入口或对外导出面。
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
